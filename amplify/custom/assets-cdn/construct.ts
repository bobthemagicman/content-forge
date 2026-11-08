import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { fileURLToPath } from "node:url";

export interface AssetsCdnProps {
  /** `master`, or `sandbox-<username>` (research R19). Namespaces the SSM parameters. */
  envName: string;
  /** Production gets the custom domain, same-site cookies, and the account budget. */
  isProduction: boolean;
  /** This environment's CloudFront public key, from SSM `/content-forge/<envName>/cloudfront/public-key` (research R8). */
  publicKeyPem: string;
  userPoolId: string;
  userPoolClientId: string;
  /** Origins allowed to call `/_session` with credentials. */
  allowedOrigins: string[];
  /** Only ID tokens for `@<allowedEmailDomain>` get a session (FR-001). */
  allowedEmailDomain: string;
  /** The catalog table: the session function reads an item's status and demo entry path from it. */
  contentTable: dynamodb.ITable;
  /** Production only: `assets.<domain>`. */
  assetsDomain?: string;
  /** Production only: the us-east-1 certificate for `assetsDomain` (infra/edge-cert, research R10). */
  certificateArn?: string;
  /** Production only: the Route 53 zone that holds `assetsDomain`. */
  hostedZoneId?: string;
  hostedZoneName?: string;
  /** Production only: where the monthly budget alerts go. */
  budgetAlertEmail?: string;
}

interface ProductionSettings {
  assetsDomain: string;
  certificateArn: string;
  hostedZoneId: string;
  hostedZoneName: string;
  budgetAlertEmail: string;
}

function productionSettings(scope: Construct, props: AssetsCdnProps): ProductionSettings | undefined {
  if (!props.isProduction) return undefined;
  const required = ["assetsDomain", "certificateArn", "hostedZoneId", "hostedZoneName", "budgetAlertEmail"] as const;
  const missing = required.filter((key) => !props[key]);
  if (missing.length) {
    throw new Error(
      `AssetsCdn (${scope.node.path}): production needs ${missing.join(", ")}. ` +
        "Set ASSETS_CERT_ARN, HOSTED_ZONE_ID, and BUDGET_ALERT_EMAIL on the Amplify app (quickstart §2).",
    );
  }
  return props as AssetsCdnProps & ProductionSettings;
}

/**
 * The asset plane: a private bucket behind two CloudFront distributions (assets, and demos on a
 * separate site), the signing key group, the session Lambda, the download log, and the account
 * budget (contracts/assets-cdn.md, research R6–R8, R20).
 */
export class AssetsCdn extends Construct {
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;
  /** Template demos, on the distribution's own `*.cloudfront.net` host in every environment (R20). */
  readonly demosDistribution: cloudfront.Distribution;
  readonly downloadEventsTable: dynamodb.Table;
  readonly sessionFunction: NodejsFunction;
  /** `https://<asset host>`; reported to the app as `custom.assetsBaseUrl`. */
  readonly assetsBaseUrl: string;
  /** `https://<demo host>`. The app never builds demo URLs; launch links come from `/_session/demo`. */
  readonly demosBaseUrl: string;
  /** SSM parameters the session and download functions read at runtime (research R8, R19). */
  readonly parameterNames: { assetsDomain: string; keyPairId: string; privateKey: string };

  constructor(scope: Construct, id: string, props: AssetsCdnProps) {
    super(scope, id);
    const production = productionSettings(this, props);
    const stack = Stack.of(this);
    const prefix = `/content-forge/${props.envName}`;
    this.parameterNames = {
      assetsDomain: `${prefix}/assets/domain`,
      keyPairId: `${prefix}/cloudfront/key-pair-id`,
      // Created by scripts/bootstrap/create-signing-keys.sh: CloudFormation can't make SecureStrings.
      privateKey: `${prefix}/cloudfront/private-key`,
    };

    // --- Bucket -------------------------------------------------------------------------------
    this.bucket = new s3.Bucket(this, "Bucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      // Archives are large and rarely read.
      lifecycleRules: [
        {
          id: "archives-intelligent-tiering",
          prefix: "a/",
          transitions: [{ storageClass: s3.StorageClass.INTELLIGENT_TIERING, transitionAfter: Duration.days(0) }],
        },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // --- Signing keys -------------------------------------------------------------------------
    const publicKey = new cloudfront.PublicKey(this, "PublicKey", {
      encodedKey: props.publicKeyPem,
      comment: `Content Forge ${props.envName} asset signing key`,
    });
    const keyGroup = new cloudfront.KeyGroup(this, "KeyGroup", { items: [publicKey] });

    const securityHeaders = new cloudfront.ResponseHeadersPolicy(this, "SecurityHeaders", {
      comment: "Content Forge assets: HSTS and no MIME sniffing",
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: false, override: true },
      },
    });

    // --- Demo distribution (research R20) -----------------------------------------------------
    // Third-party template code, so it gets a site of its own: `*.cloudfront.net` is on the Public
    // Suffix List, so this host shares no cookies or same-site trust with the owner's domain.
    // Adding a demo is only an upload under d/<id>/; nothing here changes per demo.
    const demoLaunch = new cloudfront.Function(this, "DemoLaunchFunction", {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: "Content Forge: launch link to per-demo signed cookies",
      code: cloudfront.FunctionCode.fromFile({ filePath: fileURLToPath(new URL("./demo-launch.js", import.meta.url)) }),
    });
    // The origin path confines this distribution to d/, so demo URLs are /<id>/<path>.
    const demoOrigin = origins.S3BucketOrigin.withOriginAccessControl(this.bucket, { originPath: "/d" });
    // No minimumProtocolVersion: CloudFront applies one only to a custom certificate, and this host
    // always uses the default *.cloudfront.net one, which allows TLS 1.0 and 1.1 (research R20).
    this.demosDistribution = new cloudfront.Distribution(this, "DemosDistribution", {
      comment: `Content Forge demos (${props.envName})`,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: demoOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        trustedKeyGroups: [keyGroup],
        responseHeadersPolicy: securityHeaders,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        // Answered entirely by the function, which never reaches the origin. No key group: the
        // request carries the values that become the cookies.
        "/_launch/*": {
          origin: demoOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          responseHeadersPolicy: securityHeaders,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          functionAssociations: [{ function: demoLaunch, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
        },
      },
    });
    const demosHost = this.demosDistribution.distributionDomainName;
    this.demosBaseUrl = `https://${demosHost}`;

    // Belt and braces for the origin path: the demo distribution can't read outside d/, whatever
    // path reaches S3.
    this.bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "DemosDistributionReadsOnlyDemos",
        effect: iam.Effect.DENY,
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["s3:GetObject"],
        notResources: [this.bucket.arnForObjects("d/*")],
        conditions: {
          StringEquals: {
            "AWS:SourceArn": stack.formatArn({
              service: "cloudfront",
              region: "",
              resource: "distribution",
              resourceName: this.demosDistribution.distributionId,
            }),
          },
        },
      }),
    );

    // --- Session function ---------------------------------------------------------------------
    const sessionLogs = new logs.LogGroup(this, "SessionLogs", {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.sessionFunction = new NodejsFunction(this, "SessionFunction", {
      entry: fileURLToPath(new URL("./session-handler.ts", import.meta.url)),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(5),
      // Caps what a flood of requests can cost (research R7). Production only: Lambda keeps 10
      // unreserved executions per account, so an account still on the 10-execution default quota
      // (common for new accounts) can't reserve any. Sandboxes are capped by that quota anyway.
      ...(production && { reservedConcurrentExecutions: 5 }),
      logGroup: sessionLogs,
      environment: {
        USER_POOL_ID: props.userPoolId,
        USER_POOL_CLIENT_ID: props.userPoolClientId,
        ALLOWED_ORIGINS: props.allowedOrigins.join(","),
        ALLOW_DOMAIN: props.allowedEmailDomain,
        COOKIE_MODE: production ? "same-site" : "cross-site",
        ASSETS_DOMAIN_PARAM: this.parameterNames.assetsDomain,
        PRIVATE_KEY_PARAM: this.parameterNames.privateKey,
        KEY_PAIR_ID_PARAM: this.parameterNames.keyPairId,
        DEMOS_DOMAIN: demosHost,
        CONTENT_TABLE: props.contentTable.tableName,
      },
      // Bundle the SDK too: the signer isn't in the Lambda runtime, and pinning everything keeps
      // the deployed code identical to what the tests ran against.
      bundling: { bundleAwsSDK: true, minify: true, sourceMap: false },
    });

    const parameterArn = (name: string) =>
      stack.formatArn({ service: "ssm", resource: "parameter", resourceName: name.replace(/^\//, "") });
    const privateKeyArn = parameterArn(this.parameterNames.privateKey);
    this.sessionFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: Object.values(this.parameterNames).map(parameterArn),
      }),
    );
    // SecureString decryption, limited to the private key parameter by its encryption context.
    this.sessionFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["kms:Decrypt"],
        resources: [stack.formatArn({ service: "kms", resource: "key", resourceName: "*" })],
        conditions: { StringEquals: { "kms:EncryptionContext:PARAMETER_ARN": privateKeyArn } },
      }),
    );
    // An item's status and demo entry path, for demo launch links. Nothing else in the catalog.
    this.sessionFunction.addToRolePolicy(
      new iam.PolicyStatement({ actions: ["dynamodb:GetItem"], resources: [props.contentTable.tableArn] }),
    );
    const sessionUrl = this.sessionFunction.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.AWS_IAM });

    // --- Distribution -------------------------------------------------------------------------
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(this.bucket);
    const denyAll = new cloudfront.Function(this, "DenyFunction", {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: "Content Forge: 403 for every path without its own behavior",
      code: cloudfront.FunctionCode.fromInline(
        "function handler(event) { return { statusCode: 403, statusDescription: 'Forbidden' }; }",
      ),
    });
    const sessionRequests = new cloudfront.OriginRequestPolicy(this, "SessionRequests", {
      comment: "Content Forge /_session: forward the ID token and Origin only",
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList("X-Id-Token", "Origin"),
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.none(),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
    });

    // HTTPS only, with no redirect: a plain-HTTP request carrying a signed URL or an ID token would
    // already have exposed it before any redirect.
    const signedOnly = {
      origin: s3Origin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      trustedKeyGroups: [keyGroup],
      responseHeadersPolicy: securityHeaders,
    };

    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `Content Forge assets (${props.envName})`,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      // North America and Europe edges only: cheapest, and the audience is one Workspace (Principle I).
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      // Denied twice over: the function answers 403, and the key group would refuse unsigned
      // requests even if the function were ever detached.
      defaultBehavior: {
        ...signedOnly,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        functionAssociations: [{ function: denyAll, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      additionalBehaviors: {
        // Thumbnails, previews, and clips: signed cookies; keys are content-hashed, so cache hard.
        // Demos are never served here: they live under d/, which only the demo distribution reads.
        "/v/*": { ...signedOnly, cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED },
        // Original archives: signed URLs only (the cookie policy covers /v/* alone), never cached.
        "/a/*": { ...signedOnly, cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED },
        "/_session*": {
          origin: origins.FunctionUrlOrigin.withOriginAccessControl(sessionUrl),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          responseHeadersPolicy: securityHeaders,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: sessionRequests,
        },
      },
      ...(production && {
        domainNames: [production.assetsDomain],
        certificate: acm.Certificate.fromCertificateArn(this, "Certificate", production.certificateArn),
      }),
    });

    const assetHost = production?.assetsDomain ?? this.distribution.distributionDomainName;
    this.assetsBaseUrl = `https://${assetHost}`;

    if (production) {
      const zone = route53.HostedZone.fromHostedZoneAttributes(this, "Zone", {
        hostedZoneId: production.hostedZoneId,
        zoneName: production.hostedZoneName,
      });
      const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution));
      new route53.ARecord(this, "AliasA", { zone, recordName: production.assetsDomain, target });
      new route53.AaaaRecord(this, "AliasAaaa", { zone, recordName: production.assetsDomain, target });
    }

    // Read at runtime rather than referenced, which avoids a cycle: the distribution already
    // depends on the session function, whose URL is one of its origins (research R19).
    new ssm.StringParameter(this, "AssetsDomainParam", {
      parameterName: this.parameterNames.assetsDomain,
      stringValue: assetHost,
    });
    new ssm.StringParameter(this, "KeyPairIdParam", {
      parameterName: this.parameterNames.keyPairId,
      stringValue: publicKey.publicKeyId,
    });

    // --- Download log -------------------------------------------------------------------------
    this.downloadEventsTable = new dynamodb.Table(this, "DownloadEvents", {
      partitionKey: { name: "contentId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "downloadedAtEmail", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },
      removalPolicy: production ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // --- Budget (account-wide, so production only) --------------------------------------------
    if (production) {
      new budgets.CfnBudget(this, "MonthlyBudget", {
        budget: {
          budgetName: "content-forge-monthly",
          budgetType: "COST",
          timeUnit: "MONTHLY",
          budgetLimit: { amount: 5, unit: "USD" },
        },
        notificationsWithSubscribers: [80, 100].map((threshold) => ({
          notification: {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            threshold,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [{ subscriptionType: "EMAIL", address: production.budgetAlertEmail }],
        })),
      });
    }
  }
}
