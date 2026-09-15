import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-southeast-1',
});

export const ddb = DynamoDBDocumentClient.from(client);

export const TABLES = {
  applications: process.env.DYNAMODB_TABLE_APPLICATIONS || 'bi-applications',
  profiles: process.env.DYNAMODB_TABLE_PROFILES || 'bi-profiles',
  documents: process.env.DYNAMODB_TABLE_DOCUMENTS || 'bi-documents',
  activity: process.env.DYNAMODB_TABLE_ACTIVITY || 'bi-activity',
};
