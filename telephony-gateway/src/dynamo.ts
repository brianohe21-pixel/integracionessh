import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const tableName = process.env.TABLE_NAME ?? "";
const region = process.env.AWS_REGION ?? "us-east-1";

const client = new DynamoDBClient({ region });
export const docClient = DynamoDBDocumentClient.from(client);
