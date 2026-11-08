import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import type { Construct } from "constructs";

export interface EdgeCertStackProps extends StackProps {
  /** The asset host, `assets.<domain>`. */
  domainName: string;
  hostedZoneId: string;
  hostedZoneName: string;
}

/**
 * The certificate CloudFront serves for the asset host. CloudFront only takes us-east-1
 * certificates, and Amplify's custom stacks are nested in the app's region, so this lives in its
 * own app, deployed once (research R10). Its `AssetsCertArn` output becomes `ASSETS_CERT_ARN`.
 */
export class EdgeCertStack extends Stack {
  constructor(scope: Construct, id: string, props: EdgeCertStackProps) {
    super(scope, id, props);

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, "Zone", {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.hostedZoneName,
    });

    const certificate = new acm.Certificate(this, "AssetsCert", {
      domainName: props.domainName,
      validation: acm.CertificateValidation.fromDns(zone),
    });

    new CfnOutput(this, "AssetsCertArn", {
      value: certificate.certificateArn,
      description: "Set as the Amplify app's ASSETS_CERT_ARN",
    });
  }
}
