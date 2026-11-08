import { CfnOutput, Duration, RemovalPolicy, SecretValue, Stack, Token, type StackProps } from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

/** `dev` serves every personal sandbox (on localhost); `prod` serves the `master` deployment. */
export type AuthEnv = "dev" | "prod";

export interface AuthStackProps extends StackProps {
  authEnv: AuthEnv;
  /** The Workspace domain allowed to sign in (FR-001). */
  allowedEmailDomain: string;
  /** Where Cognito may send users back: the app origin for `prod`, localhost for `dev`. */
  appOrigin: string;
  /** Cognito's name for the Google provider; the app passes the same name to `signInWithRedirect`. */
  googleProviderName: string;
  /** Secrets Manager secret holding `{"clientId": ..., "clientSecret": ...}` for the Google client. */
  googleSecretName: string;
}

/**
 * The user pool for one auth environment, in the auth account (research R21). Everything the app's
 * own account needs from it is in the outputs, which scripts/auth/deploy.sh copies to
 * `amplify/auth-environments/<env>.json`.
 *
 * Google Workspace is the only way in (research R3):
 * - Google is a generic OIDC provider, not Cognito's built-in Google provider. Only OIDC providers
 *   let Cognito map claims from Google's ID token, which carries `hd`, the user's Workspace domain.
 *   Consumer Google accounts have no `hd`, so the pre-sign-up trigger and the session function
 *   refuse them.
 * - There's no self-service sign-up. Accounts come only from federated sign-in, which the
 *   pre-sign-up trigger limits to the allowed domain.
 * - The app client gives out tokens only through Google: no Cognito sign-in form, and no SRP or
 *   custom-auth flows. Those flows always add `aws.cognito.signin.user.admin`, the scope that lets
 *   a user rewrite their own attributes, and `custom:hd` and `email` must stay writable by this
 *   client because Cognito rewrites mapped attributes on every Google sign-in.
 */
export class AuthStack extends Stack {
  readonly userPool: cognito.UserPool;
  readonly client: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);
    if (Token.isUnresolved(this.account)) {
      throw new Error("AuthStack needs a concrete account (env.account): the domain prefix is derived from it.");
    }
    const production = props.authEnv === "prod";

    const preSignUpLogs = new logs.LogGroup(this, "PreSignUpLogs", {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const preSignUp = new NodejsFunction(this, "PreSignUp", {
      entry: fileURLToPath(new URL("./pre-sign-up.ts", import.meta.url)),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 128,
      // Cognito waits 5 seconds for a trigger.
      timeout: Duration.seconds(5),
      logGroup: preSignUpLogs,
      environment: { ALLOW_DOMAIN: props.allowedEmailDomain },
      bundling: { minify: true, sourceMap: false },
    });

    this.userPool = new cognito.UserPool(this, "UserPool", {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      // Google's hosted-domain claim. Mutable, because Cognito rewrites mapped attributes on every
      // federated sign-in.
      customAttributes: { hd: new cognito.StringAttribute({ maxLen: 253, mutable: true }) },
      accountRecovery: cognito.AccountRecovery.NONE,
      mfa: cognito.Mfa.OFF,
      lambdaTriggers: { preSignUp },
      // Replacing the production pool would delete every user.
      deletionProtection: production,
      removalPolicy: production ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // The secret is read by CloudFormation at deploy time, so it never appears in the template.
    const googleClientSecret = SecretValue.secretsManager(props.googleSecretName, { jsonField: "clientSecret" });
    const googleClientId = SecretValue.secretsManager(props.googleSecretName, { jsonField: "clientId" });
    const provider = new cognito.UserPoolIdentityProviderOidc(this, "Google", {
      userPool: this.userPool,
      name: props.googleProviderName,
      clientId: googleClientId.unsafeUnwrap(),
      clientSecret: googleClientSecret.unsafeUnwrap(),
      issuerUrl: "https://accounts.google.com",
      scopes: ["openid", "email", "profile"],
      attributeMapping: {
        email: cognito.ProviderAttribute.other("email"),
        emailVerified: cognito.ProviderAttribute.other("email_verified"),
        fullname: cognito.ProviderAttribute.other("name"),
        profilePicture: cognito.ProviderAttribute.other("picture"),
        custom: { "custom:hd": cognito.ProviderAttribute.other("hd") },
      },
    });

    const callback = `${props.appOrigin}/auth/callback/`;
    this.client = this.userPool.addClient("AppClient", {
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [callback],
        logoutUrls: [`${props.appOrigin}/`],
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.custom(props.googleProviderName)],
      // Refresh tokens last 7 days (research R3).
      refreshTokenValidity: Duration.days(7),
      preventUserExistenceErrors: true,
    });
    this.client.node.addDependency(provider);
    // Only refresh, no SRP or custom auth. CDK leaves ExplicitAuthFlows unset when no flow is chosen,
    // and Cognito's default for an unset value includes SRP and custom auth.
    (this.client.node.defaultChild as cognito.CfnUserPoolClient).explicitAuthFlows = ["ALLOW_REFRESH_TOKEN_AUTH"];

    // A stable prefix that names neither the account nor the owner. Prefixes are global per region.
    const domainPrefix = `content-forge-${props.authEnv}-${createHash("sha256").update(this.account).digest("hex").slice(0, 10)}`;
    this.userPool.addDomain("Domain", { cognitoDomain: { domainPrefix } });

    new CfnOutput(this, "Region", { value: this.region });
    new CfnOutput(this, "UserPoolId", { value: this.userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: this.client.userPoolClientId });
    new CfnOutput(this, "Domain", { value: `${domainPrefix}.auth.${this.region}.amazoncognito.com` });
    new CfnOutput(this, "AppOrigin", { value: props.appOrigin });
    new CfnOutput(this, "GoogleRedirectUri", {
      value: `https://${domainPrefix}.auth.${this.region}.amazoncognito.com/oauth2/idpresponse`,
      description: "Add to the Google OAuth client's authorized redirect URIs",
    });
  }
}
