import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { EdgeCertStack } from "../../infra/edge-cert/lib/edge-cert-stack";

const app = new App();
const stack = new EdgeCertStack(app, "EdgeCert", {
  env: { account: "111111111111", region: "us-east-1" },
  domainName: "assets.example.com",
  hostedZoneId: "Z123TEST",
  hostedZoneName: "example.com",
});
const template = Template.fromStack(stack);

describe("edge-cert stack (research R10)", () => {
  it("lives in us-east-1, where CloudFront reads certificates", () => {
    expect(stack.region).toBe("us-east-1");
  });

  it("requests a DNS-validated certificate for the asset host in the given zone", () => {
    template.resourceCountIs("AWS::CertificateManager::Certificate", 1);
    template.hasResourceProperties("AWS::CertificateManager::Certificate", {
      DomainName: "assets.example.com",
      ValidationMethod: "DNS",
      DomainValidationOptions: [{ DomainName: "assets.example.com", HostedZoneId: "Z123TEST" }],
    });
  });

  it("outputs the certificate ARN", () => {
    template.hasOutput("AssetsCertArn", { Value: { Ref: Match.anyValue() } });
  });
});
