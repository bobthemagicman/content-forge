import { getSignedCookies, getSignedUrl } from "@aws-sdk/cloudfront-signer";
import type { AssetSigner, SettingsStore } from "../ports";

export interface CloudFrontSignerSettings {
  /** SSM names of the asset host, the key pair ID and the private key (research R8, R19). */
  assetHostSetting: string;
  keyPairIdSetting: string;
  privateKeySetting: string;
  /** The demo distribution's host name (research R20). */
  demosHost: string;
}

interface SigningConfig {
  assetHost: string;
  keyPairId: string;
  privateKey: string;
}

const COOKIE_NAMES = ["CloudFront-Policy", "CloudFront-Signature", "CloudFront-Key-Pair-Id"] as const;

/** A custom policy for every URL under `resource`, valid until `expiresAt`. */
function customPolicy(resource: string, expiresAt: Date): string {
  const epoch = Math.floor(expiresAt.getTime() / 1000);
  return JSON.stringify({ Statement: [{ Resource: resource, Condition: { DateLessThan: { "AWS:EpochTime": epoch } } }] });
}

/**
 * CloudFront signed cookies and URLs: the AWS adapter for the AssetSigner port. The signing settings
 * are read once per container; a failed read isn't cached, so the next call retries.
 */
export function createCloudFrontSigner(settings: SettingsStore, names: CloudFrontSignerSettings): AssetSigner {
  let config: Promise<SigningConfig> | undefined;
  const load = (): Promise<SigningConfig> => {
    config ??= Promise.all([
      settings.get(names.assetHostSetting),
      settings.get(names.keyPairIdSetting),
      settings.get(names.privateKeySetting, { secret: true }),
    ])
      .then(([assetHost, keyPairId, privateKey]) => ({ assetHost, keyPairId, privateKey }))
      .catch((error: unknown) => {
        config = undefined;
        throw error;
      });
    return config;
  };

  const cookies = async (resource: (c: SigningConfig) => string, expiresAt: Date): Promise<Record<string, string>> => {
    const signing = await load();
    const signed = getSignedCookies({ keyPairId: signing.keyPairId, privateKey: signing.privateKey, policy: customPolicy(resource(signing), expiresAt) });
    return Object.fromEntries(
      COOKIE_NAMES.map((name) => {
        const value = signed[name];
        if (!value) throw new Error(`cloudfront-signer: the signer returned no ${name}`);
        return [name, value];
      }),
    );
  };

  return {
    cookieNames: COOKIE_NAMES,

    sessionCookies: (expiresAt) => cookies(({ assetHost }) => `https://${assetHost}/v/*`, expiresAt),

    // The demo host's `/_launch/*` function turns these values into cookies scoped to `/<id>/` and
    // redirects to the entry page (amplify/custom/assets-cdn/demo-launch.js). They're URL-safe base64
    // and key IDs, so they need no encoding (URLSearchParams would turn `~` into `%7E`, which the
    // launch function would then copy into the cookie).
    async demoLaunchUrl(id, entryPath, expiresAt) {
      const signed = await cookies(() => `https://${names.demosHost}/${id}/*`, expiresAt);
      const query = `p=${signed["CloudFront-Policy"]}&s=${signed["CloudFront-Signature"]}&k=${signed["CloudFront-Key-Pair-Id"]}`;
      return `https://${names.demosHost}/_launch/${id}/${entryPath}?${query}`;
    },

    // A canned policy: one URL, so CloudFront can check it without a policy document (contracts/
    // assets-cdn.md `/a/*`).
    async downloadUrl(key, expiresAt) {
      const segments = key.split("/");
      if (segments[0] !== "a" || segments.length < 3 || segments.some((s) => s === "" || s === "." || s === "..")) {
        throw new Error(`cloudfront-signer: not an archive key: ${key}`);
      }
      const { assetHost, keyPairId, privateKey } = await load();
      const url = `https://${assetHost}/${segments.map(encodeURIComponent).join("/")}`;
      return getSignedUrl({ url, keyPairId, privateKey, dateLessThan: expiresAt.toISOString() });
    },
  };
}
