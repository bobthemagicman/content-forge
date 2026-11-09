import { GetParameterCommand, ParameterNotFound, SSMClient } from "@aws-sdk/client-ssm";
import { SettingNotFoundError, type SettingsStore } from "../ports";

/** Deployment settings in SSM Parameter Store; secrets are SecureString parameters (research R22). */
export function createSsmSettings(client: SSMClient = new SSMClient({})): SettingsStore {
  return {
    async get(name, { secret = false } = {}) {
      try {
        const { Parameter } = await client.send(new GetParameterCommand({ Name: name, ...(secret && { WithDecryption: true }) }));
        if (!Parameter?.Value) throw new SettingNotFoundError(name);
        return Parameter.Value;
      } catch (error) {
        if (error instanceof ParameterNotFound) throw new SettingNotFoundError(name);
        throw error;
      }
    },
  };
}
