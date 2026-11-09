import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { AuthStack, type AuthEnv } from "../../infra/auth/lib/auth-stack";

// The user pools in the auth account (research R3, R21). A user who got an access token with
// `aws.cognito.signin.user.admin` could rewrite their own `custom:hd` and email, which the session
// function trusts. That scope comes with the client's non-OAuth flows (SRP, custom auth) and can be
// requested through OAuth only if the client allows it, so these tests pin the client down.

const ACCOUNT = "111111111111";

function synth(authEnv: AuthEnv) {
  const app = new App({ context: { "aws:cdk:bundling-stacks": [] } });
  const stack = new AuthStack(app, `Auth-${authEnv}`, {
    env: { account: ACCOUNT, region: "us-west-2" },
    authEnv,
    allowedEmailDomain: "example.com",
    appOrigin: authEnv === "prod" ? "https://content.example.com" : "http://localhost:3000",
    googleProviderName: "GoogleWorkspace",
    googleSecretName: "content-forge/google-oauth-client",
  });
  return Template.fromStack(stack);
}

const dev = synth("dev");
const prod = synth("prod");
const client = (t: Template) => Object.values(t.findResources("AWS::Cognito::UserPoolClient"))[0].Properties;

describe.each([
  ["dev", dev],
  ["prod", prod],
])("auth stack (%s)", (_, template) => {
  it("has exactly one app client, so AppSync's OIDC issuer check needs no client ID", () => {
    template.resourceCountIs("AWS::Cognito::UserPool", 1);
    template.resourceCountIs("AWS::Cognito::UserPoolClient", 1);
  });

  it("can't grant the scope that lets users write their own attributes", () => {
    expect(client(template).AllowedOAuthScopes).toEqual(["openid", "email", "profile"]);
  });

  it("uses only the authorization-code flow, with no client secret", () => {
    expect(client(template).AllowedOAuthFlows).toEqual(["code"]);
    expect(client(template).GenerateSecret).toBe(false);
  });

  it("allows no sign-in flow outside OAuth, only refresh", () => {
    expect(client(template).ExplicitAuthFlows).toEqual(["ALLOW_REFRESH_TOKEN_AUTH"]);
  });

  it("offers Google and not Cognito's own sign-in form", () => {
    expect(client(template).SupportedIdentityProviders).toEqual(["GoogleWorkspace"]);
  });

  it("keeps refresh tokens to 7 days", () => {
    expect(client(template).RefreshTokenValidity).toBe(7 * 24 * 60);
    expect(client(template).TokenValidityUnits).toMatchObject({ RefreshToken: "minutes" });
  });

  it("maps Google's hd claim to custom:hd, and keeps mapped attributes writable", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolIdentityProvider", {
      ProviderName: "GoogleWorkspace",
      ProviderType: "OIDC",
      AttributeMapping: Match.objectLike({ "custom:hd": "hd", email: "email", email_verified: "email_verified" }),
      ProviderDetails: Match.objectLike({ oidc_issuer: "https://accounts.google.com" }),
    });
    // No WriteAttributes means Cognito's default: every attribute is writable by this client. If
    // someone narrows it later, the mapped ones must stay, or Google sign-in fails.
    const write = client(template).WriteAttributes as string[] | undefined;
    if (write) expect(write).toEqual(expect.arrayContaining(["custom:hd", "email"]));
  });

  it("reads the Google client from Secrets Manager at deploy time, never from the template", () => {
    const details = Object.values(template.findResources("AWS::Cognito::UserPoolIdentityProvider"))[0].Properties
      .ProviderDetails as Record<string, string>;
    expect(details.client_id).toBe("{{resolve:secretsmanager:content-forge/google-oauth-client:SecretString:clientId::}}");
    expect(details.client_secret).toBe(
      "{{resolve:secretsmanager:content-forge/google-oauth-client:SecretString:clientSecret::}}",
    );
  });

  it("has no self-service sign-up, and a mutable custom:hd", () => {
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
      Schema: Match.arrayWith([Match.objectLike({ Name: "hd", Mutable: true, AttributeDataType: "String" })]),
    });
  });

  it("runs the pre-sign-up trigger with the allowed domain and 2-week logs", () => {
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      LambdaConfig: { PreSignUp: { "Fn::GetAtt": [Match.stringLikeRegexp("PreSignUp"), "Arn"] } },
    });
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: { Variables: { ALLOW_DOMAIN: "example.com" } },
    });
    template.hasResourceProperties("AWS::Logs::LogGroup", { RetentionInDays: 14 });
  });

  it("outputs that domain, so the app's session function allows the same one", () => {
    template.hasOutput("AllowedEmailDomain", { Value: "example.com" });
  });

  it("uses a Cognito domain that doesn't contain the account ID", () => {
    const domain = Object.values(template.findResources("AWS::Cognito::UserPoolDomain"))[0].Properties.Domain as string;
    expect(domain).toMatch(/^content-forge-(dev|prod)-[0-9a-f]{10}$/);
    expect(domain).not.toContain(ACCOUNT);
  });
});

describe("auth environments", () => {
  it("send dev users back to localhost and prod users to the app origin, and nowhere else", () => {
    expect(client(dev).CallbackURLs).toEqual(["http://localhost:3000/auth/callback/"]);
    expect(client(dev).LogoutURLs).toEqual(["http://localhost:3000/"]);
    expect(client(prod).CallbackURLs).toEqual(["https://content.example.com/auth/callback/"]);
    expect(client(prod).LogoutURLs).toEqual(["https://content.example.com/"]);
  });

  it("protect the production pool from deletion and replacement, but not the dev pool", () => {
    prod.hasResource("AWS::Cognito::UserPool", {
      DeletionPolicy: "Retain",
      Properties: Match.objectLike({ DeletionProtection: "ACTIVE" }),
    });
    dev.hasResource("AWS::Cognito::UserPool", { DeletionPolicy: "Delete" });
  });

  it("give each environment its own domain prefix", () => {
    const domain = (t: Template) => Object.values(t.findResources("AWS::Cognito::UserPoolDomain"))[0].Properties.Domain;
    expect(domain(dev)).not.toBe(domain(prod));
  });
});
