import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { CatalogRecord, CatalogStore } from "../ports";

/** The catalog in the Amplify Data `Content` table (data-model.md). */
export function createDynamoCatalogStore(tableName: string, client: DynamoDBClient = new DynamoDBClient({})): CatalogStore {
  return {
    async get(id, fields) {
      // `id` is the key, so it isn't read back. Every name goes through a placeholder, since `status`
      // is a reserved word.
      const names = [...new Set(fields)].filter((name) => name !== "id");
      const placeholders = Object.fromEntries(names.map((name, i) => [`#f${i}`, name]));
      const { Item } = await client.send(
        new GetItemCommand({
          TableName: tableName,
          Key: { id: { S: id } },
          ProjectionExpression: Object.keys(placeholders).join(", ") || "id",
          ...(names.length > 0 && { ExpressionAttributeNames: placeholders }),
        }),
      );
      if (!Item) return undefined;
      return { id, ...unmarshall(Item) } as Pick<CatalogRecord, (typeof fields)[number] | "id">;
    },
  };
}
