import { App, Stack } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Match, Template } from "aws-cdk-lib/assertions";
import { generateKeyPairSync } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { AssetsCdn, type AssetsCdnProps } from "../../amplify/custom/assets-cdn/construct";

const { publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

type Props = Omit<AssetsCdnProps, "contentTable">;

const BASE: Props = {
  envName: "sandbox-test",
  isProduction: false,
  publicKeyPem: publicKey,
  userPoolId: "us-west-2_test",
  userPoolClientId: "client-test",
  allowedOrigins: ["http://localhost:3000"],
  allowedEmailDomain: "example.com",
};

const PRODUCTION: Props = {
  ...BASE,
  envName: "master",
  isProduction: true,
  allowedOrigins: ["https://content.example.com"],
  assetsDomain: "assets.example.com",
  certificateArn: "arn:aws:acm:us-east-1:111111111111:certificate/test",
  hostedZoneId: "Z123TEST",
  hostedZoneName: "example.com",
  budgetAlertEmail: "alerts@example.com",
};

function synth(props: Props) {
  // Skip esbuild: these tests check the template, not the bundle.
  const app = new App({ context: { "aws:cdk:bundling-stacks": [] } });
  const stack = new Stack(app, "Assets", { env: { account: "111111111111", region: "us-west-2" } });
  const contentTable = dynamodb.Table.fromTableName(stack, "Content", "Content-test");
  const assets = new AssetsCdn(stack, "AssetsCdn", { ...props, contentTable });
  return { assets, template: Template.fromStack(stack) };
}

/** The distribution whose comment starts with `Content Forge <kind> (`. */
function distributionConfig(template: Template, kind: "assets" | "demos") {
  const configs = Object.values(template.findResources("AWS::CloudFront::Distribution")).map(
    (d) => d.Properties.DistributionConfig,
  );
  const config = configs.find((c) => String(c.Comment).startsWith(`Content Forge ${kind} (`));
  if (!config) throw new Error(`no ${kind} distribution`);
  return config;
}

function behavior(template: Template, pattern: string, kind: "assets" | "demos" = "assets") {
  return distributionConfig(template, kind).CacheBehaviors.find((b: { PathPattern: string }) => b.PathPattern === pattern);
}

describe.each([
  ["production", PRODUCTION],
  ["sandbox", BASE],
])("AssetsCdn (%s)", (_, props) => {
  let template: Template;
  beforeAll(() => {
    template = synth(props).template;
  });

  it("blocks all public access to the bucket and enforces TLS", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      BucketEncryption: { ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } }] },
      LifecycleConfiguration: {
        Rules: [Match.objectLike({ Prefix: "a/", Transitions: [{ StorageClass: "INTELLIGENT_TIERING", TransitionInDays: 0 }] })],
      },
    });
    template.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Effect: "Deny", Condition: { Bool: { "aws:SecureTransport": "false" } } }),
        ]),
      },
    });
  });

  it("uses origin access control for S3 and for the Lambda URL", () => {
    template.hasResourceProperties("AWS::CloudFront::OriginAccessControl", {
      OriginAccessControlConfig: Match.objectLike({ OriginAccessControlOriginType: "s3" }),
    });
    template.hasResourceProperties("AWS::CloudFront::OriginAccessControl", {
      OriginAccessControlConfig: Match.objectLike({ OriginAccessControlOriginType: "lambda" }),
    });
  });

  it("protects /v/* and /a/* with the key group, and never caches archives", () => {
    const v = behavior(template, "/v/*");
    const a = behavior(template, "/a/*");
    expect(v.TrustedKeyGroups).toHaveLength(1);
    expect(a.TrustedKeyGroups).toHaveLength(1);
    expect(v.CachePolicyId).toBe("658327ea-f89d-4fab-a63d-7e88639e58f6"); // CachingOptimized
    expect(a.CachePolicyId).toBe("4135ea2d-6df8-44a3-9df3-4b5a84be39ad"); // CachingDisabled
  });

  it("sends HSTS and nosniff on every behavior", () => {
    template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
      ResponseHeadersPolicyConfig: Match.objectLike({
        SecurityHeadersConfig: {
          ContentTypeOptions: { Override: true },
          StrictTransportSecurity: { AccessControlMaxAgeSec: 31536000, IncludeSubdomains: false, Override: true },
        },
      }),
    });
    for (const kind of ["assets", "demos"] as const) {
      const config = distributionConfig(template, kind);
      for (const b of [config.DefaultCacheBehavior, ...config.CacheBehaviors]) {
        expect(b.ResponseHeadersPolicyId).toBeDefined();
      }
    }
  });

  it("sends /_session* to the function URL uncached, forwarding only the token and Origin", () => {
    const session = behavior(template, "/_session*");
    expect(session.CachePolicyId).toBe("4135ea2d-6df8-44a3-9df3-4b5a84be39ad");
    expect(session.AllowedMethods).toEqual(["GET", "HEAD", "OPTIONS"]);
    expect(session.TrustedKeyGroups).toBeUndefined();
    template.hasResourceProperties("AWS::CloudFront::OriginRequestPolicy", {
      OriginRequestPolicyConfig: Match.objectLike({
        HeadersConfig: { HeaderBehavior: "whitelist", Headers: ["X-Id-Token", "Origin"] },
        QueryStringsConfig: { QueryStringBehavior: "none" },
        CookiesConfig: { CookieBehavior: "none" },
      }),
    });
  });

  it("denies the default behavior twice, and serves HTTPS only (no redirect), HTTP/2 and 3", () => {
    template.hasResourceProperties("AWS::CloudFront::Function", {
      FunctionCode: Match.stringLikeRegexp("statusCode: 403"),
    });
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        HttpVersion: "http2and3",
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: "https-only",
          TrustedKeyGroups: [Match.anyValue()],
          FunctionAssociations: [Match.objectLike({ EventType: "viewer-request" })],
        }),
      }),
    });
    for (const pattern of ["/v/*", "/a/*", "/_session*"]) {
      expect(behavior(template, pattern).ViewerProtocolPolicy).toBe("https-only");
    }
  });

  it("creates no VPC, NAT gateway, or VPC-attached Lambda", () => {
    template.resourceCountIs("AWS::EC2::VPC", 0);
    template.resourceCountIs("AWS::EC2::NatGateway", 0);
    for (const fn of Object.values(template.findResources("AWS::Lambda::Function"))) {
      expect(fn.Properties.VpcConfig).toBeUndefined();
    }
  });

  it("puts the session function behind an IAM-authenticated URL, reserving concurrency only in production", () => {
    template.hasResourceProperties("AWS::Lambda::Url", { AuthType: "AWS_IAM" });
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs24.x",
      MemorySize: 256,
      Timeout: 5,
      ReservedConcurrentExecutions: props.isProduction ? 5 : Match.absent(),
    });
    template.hasResourceProperties("AWS::Lambda::Permission", {
      Action: "lambda:InvokeFunctionUrl",
      Principal: "cloudfront.amazonaws.com",
    });
  });

  it("lets the session function read only its three parameters, and decrypt only the private key", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "ssm:GetParameter",
            Resource: Match.arrayWith([
              Match.objectLike({ "Fn::Join": ["", Match.arrayWith([Match.stringLikeRegexp(`parameter/content-forge/${props.envName}/cloudfront/private-key$`)])] }),
            ]),
          }),
          Match.objectLike({
            Action: "kms:Decrypt",
            Condition: { StringEquals: { "kms:EncryptionContext:PARAMETER_ARN": Match.anyValue() } },
          }),
        ]),
      },
    });
    const getParameter = Object.values(template.findResources("AWS::IAM::Policy"))
      .flatMap((p) => p.Properties.PolicyDocument.Statement)
      .find((s: { Action: string }) => s.Action === "ssm:GetParameter");
    expect(getParameter.Resource).toHaveLength(3);
  });

  it("keeps logs for 14 days", () => {
    template.hasResourceProperties("AWS::Logs::LogGroup", { RetentionInDays: 14 });
    for (const fn of Object.values(template.findResources("AWS::Lambda::Function"))) {
      expect(fn.Properties.LoggingConfig?.LogGroup).toBeDefined();
    }
  });

  it("creates the download log as an on-demand table without PITR", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      KeySchema: [
        { AttributeName: "contentId", KeyType: "HASH" },
        { AttributeName: "downloadedAtEmail", KeyType: "RANGE" },
      ],
      BillingMode: "PAY_PER_REQUEST",
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: false },
    });
  });

  it("publishes the asset host and key-pair ID to SSM", () => {
    template.hasResourceProperties("AWS::SSM::Parameter", {
      Name: `/content-forge/${props.envName}/assets/domain`,
      Type: "String",
    });
    template.hasResourceProperties("AWS::SSM::Parameter", {
      Name: `/content-forge/${props.envName}/cloudfront/key-pair-id`,
      Value: Match.objectLike({ Ref: Match.anyValue() }),
    });
  });

  describe("demo host (research R20)", () => {
    it("serves demos from its own cloudfront.net host, confined to d/ and signed cookies", () => {
      const config = distributionConfig(template, "demos");
      expect(config.Aliases).toBeUndefined();
      expect(config.ViewerCertificate).toBeUndefined();
      expect(config.PriceClass).toBe("PriceClass_100");
      expect(config.Origins).toHaveLength(1);
      expect(config.Origins[0].OriginPath).toBe("/d");
      expect(config.Origins[0].OriginAccessControlId).toBeDefined();
      expect(config.DefaultCacheBehavior).toMatchObject({
        ViewerProtocolPolicy: "https-only",
        AllowedMethods: ["GET", "HEAD"],
        TrustedKeyGroups: [expect.anything()],
        CachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
      });
      expect(config.CacheBehaviors.map((b: { PathPattern: string }) => b.PathPattern)).toEqual(["/_launch/*"]);
    });

    it("answers /_launch/* with the launch function, without a key group or caching", () => {
      const launch = behavior(template, "/_launch/*", "demos");
      expect(launch.TrustedKeyGroups).toBeUndefined();
      expect(launch.ViewerProtocolPolicy).toBe("https-only");
      expect(launch.CachePolicyId).toBe("4135ea2d-6df8-44a3-9df3-4b5a84be39ad");
      expect(launch.FunctionAssociations).toEqual([
        { EventType: "viewer-request", FunctionARN: expect.anything() },
      ]);
      template.hasResourceProperties("AWS::CloudFront::Function", {
        FunctionCode: Match.stringLikeRegexp("Path=/' \\+ id \\+ '/; Secure; HttpOnly; SameSite=Lax"),
        FunctionConfig: Match.objectLike({ Runtime: "cloudfront-js-2.0" }),
      });
    });

    it("never routes demos through the asset host", () => {
      const assets = distributionConfig(template, "assets");
      for (const b of assets.CacheBehaviors) expect(b.PathPattern).not.toMatch(/^\/d\//);
      for (const origin of assets.Origins) expect(origin.OriginPath ?? "").toBe("");
    });

    it("denies the demo distribution any object outside d/", () => {
      const statements = Object.values(template.findResources("AWS::S3::BucketPolicy")).flatMap(
        (p) => p.Properties.PolicyDocument.Statement,
      );
      const deny = statements.find((st: { Sid?: string }) => st.Sid === "DemosDistributionReadsOnlyDemos");
      expect(deny).toMatchObject({
        Effect: "Deny",
        Action: "s3:GetObject",
        Principal: { Service: "cloudfront.amazonaws.com" },
        NotResource: { "Fn::Join": ["", [expect.anything(), "/d/*"]] },
      });
      expect(JSON.stringify(deny.Condition)).toContain("DemosDistribution");
    });

    it("lets the session function sign for the demo host and read catalog items, nothing more", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: {
          Variables: Match.objectLike({
            DEMOS_DOMAIN: { "Fn::GetAtt": [Match.stringLikeRegexp("^AssetsCdnDemosDistribution"), "DomainName"] },
            CONTENT_TABLE: "Content-test",
          }),
        },
      });
      const dynamo = Object.values(template.findResources("AWS::IAM::Policy"))
        .flatMap((p) => p.Properties.PolicyDocument.Statement)
        .filter((st: { Action: string | string[] }) => [st.Action].flat().some((a) => a.startsWith("dynamodb:")));
      expect(dynamo).toHaveLength(1);
      expect(dynamo[0].Action).toBe("dynamodb:GetItem");
    });
  });
});

describe("AssetsCdn production only", () => {
  const { template, assets } = synth(PRODUCTION);

  it("creates the $5 monthly budget with 80% and 100% alerts, counting only content-forge's tag", () => {
    template.hasResourceProperties("AWS::Budgets::Budget", {
      Budget: {
        BudgetName: "content-forge-monthly",
        BudgetType: "COST",
        TimeUnit: "MONTHLY",
        BudgetLimit: { Amount: 5, Unit: "USD" },
        CostFilters: { TagKeyValue: ["user:project$content-forge"] },
      },
      NotificationsWithSubscribers: [80, 100].map((threshold) => ({
        Notification: Match.objectLike({ Threshold: threshold, ThresholdType: "PERCENTAGE", NotificationType: "ACTUAL" }),
        Subscribers: [{ SubscriptionType: "EMAIL", Address: "alerts@example.com" }],
      })),
    });
  });

  it("serves the custom domain with the imported certificate and Route 53 aliases", () => {
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Aliases: ["assets.example.com"],
        ViewerCertificate: Match.objectLike({
          AcmCertificateArn: PRODUCTION.certificateArn,
          MinimumProtocolVersion: "TLSv1.2_2021",
        }),
      }),
    });
    for (const type of ["A", "AAAA"]) {
      template.hasResourceProperties("AWS::Route53::RecordSet", {
        Name: "assets.example.com.",
        Type: type,
        HostedZoneId: "Z123TEST",
      });
    }
    template.hasResourceProperties("AWS::SSM::Parameter", {
      Name: "/content-forge/master/assets/domain",
      Value: "assets.example.com",
    });
    expect(assets.assetsBaseUrl).toBe("https://assets.example.com");
  });

  it("issues same-site cookies", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: { Variables: Match.objectLike({ COOKIE_MODE: "same-site", ALLOWED_ORIGINS: "https://content.example.com" }) },
    });
  });

  it.each(["certificateArn", "hostedZoneId", "budgetAlertEmail"] as const)("refuses to build without %s", (key) => {
    expect(() => synth({ ...PRODUCTION, [key]: undefined })).toThrow(new RegExp(`production needs ${key}`));
  });
});

describe("AssetsCdn sandbox only", () => {
  const { template } = synth(BASE);

  it("has no budget, alias, or DNS record", () => {
    template.resourceCountIs("AWS::Budgets::Budget", 0);
    template.resourceCountIs("AWS::Route53::RecordSet", 0);
    for (const kind of ["assets", "demos"] as const) {
      expect(distributionConfig(template, kind).Aliases).toBeUndefined();
    }
  });

  it("issues cross-site cookies for localhost", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: { Variables: Match.objectLike({ COOKIE_MODE: "cross-site", ALLOWED_ORIGINS: "http://localhost:3000" }) },
    });
  });

  it("reports the distribution's own domain as the asset host", () => {
    template.hasResourceProperties("AWS::SSM::Parameter", {
      Name: "/content-forge/sandbox-test/assets/domain",
      Value: { "Fn::GetAtt": [Match.stringLikeRegexp("^AssetsCdnDistribution"), "DomainName"] },
    });
  });
});
