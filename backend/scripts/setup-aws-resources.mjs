import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb';
import {
  S3Client,
  CreateBucketCommand,
  PutBucketEncryptionCommand,
  PutPublicAccessBlockCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION || 'ap-southeast-1';
const tablePrefix = process.env.DYNAMODB_TABLE_PREFIX || 'BI_';
const bucketName = process.env.AWS_S3_BUCKET || 'bi-eservices-documents';
const endpoint = process.env.DYNAMODB_ENDPOINT;
const storageProvider = process.env.STORAGE_PROVIDER || 'local';

console.log(`\n======================================================`);
console.log(`🚀 Provisioning AWS DynamoDB Tables & S3 Bucket`);
console.log(`Region:           ${region}`);
console.log(`Table Prefix:     ${tablePrefix}`);
console.log(`DynamoDB Endpoint:${endpoint || 'AWS Default'}`);
console.log(`Storage Provider: ${storageProvider}`);
console.log(`S3 Bucket:        ${bucketName}`);
console.log(`======================================================\n`);

const clientConfig = {
  region,
  ...(endpoint ? { endpoint } : {}),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
  },
};

const ddb = new DynamoDBClient(clientConfig);
const s3 = new S3Client({
  region,
  ...(process.env.AWS_S3_ENDPOINT ? { endpoint: process.env.AWS_S3_ENDPOINT, forcePathStyle: true } : {}),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
  },
});

async function waitForDynamoDB(maxRetries = 20, delayMs = 1500) {
  console.log(`Checking DynamoDB connectivity at ${endpoint || 'AWS Default'}...`);
  for (let i = 1; i <= maxRetries; i++) {
    try {
      await ddb.send(new DescribeTableCommand({ TableName: '__healthcheck__' }));
      console.log(`✓ Connected to DynamoDB.`);
      return;
    } catch (e) {
      if (e.name === 'ResourceNotFoundException' || e.name === 'UnrecognizedClientException') {
        console.log(`✓ Connected to DynamoDB.`);
        return;
      }
      if (i === maxRetries) {
        throw new Error(`Failed to connect to DynamoDB after ${maxRetries} attempts: ${e.message}`);
      }
      console.log(`⏳ Waiting for DynamoDB (${i}/${maxRetries})...`);
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

async function tableExists(name) {
  try {
    await ddb.send(new DescribeTableCommand({ TableName: name }));
    return true;
  } catch (e) {
    if (e.name === 'ResourceNotFoundException') return false;
    throw e;
  }
}

async function createTable(def) {
  const name = def.TableName;
  if (await tableExists(name)) {
    console.log(`✓ DynamoDB Table '${name}' already exists.`);
    return;
  }
  console.log(`Creating DynamoDB Table '${name}'...`);
  await ddb.send(new CreateTableCommand(def));
  console.log(`✓ Created DynamoDB Table '${name}'.`);
}

async function setupTables() {
  // 0. Users
  await createTable({
    TableName: `${tablePrefix}Users`,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [{ AttributeName: 'email', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
  });

  // 1. Applications
  await createTable({
    TableName: `${tablePrefix}Applications`,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'owner', AttributeType: 'S' },
      { AttributeName: 'status', AttributeType: 'S' },
      { AttributeName: 'updated', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'owner-updated-index',
        KeySchema: [
          { AttributeName: 'owner', KeyType: 'HASH' },
          { AttributeName: 'updated', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'status-updated-index',
        KeySchema: [
          { AttributeName: 'status', KeyType: 'HASH' },
          { AttributeName: 'updated', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  });

  // 2. Profiles
  await createTable({
    TableName: `${tablePrefix}Profiles`,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [{ AttributeName: 'owner', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'owner', KeyType: 'HASH' }],
  });

  // 3. Documents
  await createTable({
    TableName: `${tablePrefix}Documents`,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'owner', AttributeType: 'S' },
      { AttributeName: 'application', AttributeType: 'S' },
      { AttributeName: 'created', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'application-index',
        KeySchema: [{ AttributeName: 'application', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'owner-created-index',
        KeySchema: [
          { AttributeName: 'owner', KeyType: 'HASH' },
          { AttributeName: 'created', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  });

  // 4. Activity
  await createTable({
    TableName: `${tablePrefix}Activity`,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'owner', AttributeType: 'S' },
      { AttributeName: 'application', AttributeType: 'S' },
      { AttributeName: 'created', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'owner-created-index',
        KeySchema: [
          { AttributeName: 'owner', KeyType: 'HASH' },
          { AttributeName: 'created', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'application-index',
        KeySchema: [{ AttributeName: 'application', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  });
}

async function setupS3() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`✓ S3 Bucket '${bucketName}' already exists.`);
  } catch (e) {
    console.log(`Creating S3 Bucket '${bucketName}'...`);
    await s3.send(
      new CreateBucketCommand({
        Bucket: bucketName,
        ...(region !== 'us-east-1'
          ? {
              CreateBucketConfiguration: {
                LocationConstraint: region,
              },
            }
          : {}),
      }),
    );
    console.log(`✓ Created S3 Bucket '${bucketName}'.`);
  }

  // Configure Encryption
  await s3.send(
    new PutBucketEncryptionCommand({
      Bucket: bucketName,
      ServerSideEncryptionConfiguration: {
        Rules: [
          {
            ApplyServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256',
            },
          },
        ],
      },
    }),
  );

  // Block Public Access
  await s3.send(
    new PutPublicAccessBlockCommand({
      Bucket: bucketName,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: true,
        RestrictPublicBuckets: true,
      },
    }),
  );
  console.log(`✓ Configured S3 encryption and blocked all public access.`);
}

async function main() {
  try {
    await waitForDynamoDB();
    await setupTables();
    if (storageProvider === 's3') {
      await setupS3();
    } else {
      console.log(`ℹ️ Storage provider is '${storageProvider}'. Skipping S3 bucket provisioning.`);
    }
    console.log(`\n🎉 AWS Resources configured successfully!\n`);
  } catch (err) {
    console.error(`\n❌ Setup error:`, err.message);
    process.exitCode = 1;
  }
}

main();
