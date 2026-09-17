import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

@Injectable()
export class DynamoDBService implements OnModuleInit {
  private readonly logger = new Logger(DynamoDBService.name);
  private client: DynamoDBClient;
  private docClient: DynamoDBDocumentClient;
  private tablePrefix: string;

  onModuleInit() {
    const region = process.env.AWS_REGION || 'ap-southeast-1';
    this.tablePrefix = process.env.DYNAMODB_TABLE_PREFIX || 'BI_';

    const clientConfig: any = { region };
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }
    if (process.env.DYNAMODB_ENDPOINT) {
      clientConfig.endpoint = process.env.DYNAMODB_ENDPOINT;
    }

    this.client = new DynamoDBClient(clientConfig);
    this.docClient = DynamoDBDocumentClient.from(this.client, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: true,
      },
    });
    this.logger.log(`DynamoDB client initialized for region ${region} with table prefix ${this.tablePrefix}`);
  }

  get doc(): DynamoDBDocumentClient {
    return this.docClient;
  }

  getTableName(baseName: string): string {
    const envKey = `DYNAMODB_TABLE_${baseName.toUpperCase()}`;
    if (process.env[envKey]) {
      return process.env[envKey]!;
    }
    // If prefix is lowercase or ends with a hyphen (like 'bi-'), lowercase the baseName
    if (this.tablePrefix.endsWith('-') || this.tablePrefix.toLowerCase() === this.tablePrefix) {
      return `${this.tablePrefix}${baseName.toLowerCase()}`;
    }
    return `${this.tablePrefix}${baseName}`;
  }

  // --- Users Table Helpers ---
  async getUser(email: string): Promise<any> {
    const res = await this.docClient.send(
      new GetCommand({
        TableName: this.getTableName('Users'),
        Key: { email: email.toLowerCase() },
      }),
    );
    return res.Item;
  }

  async saveUser(user: any): Promise<void> {
    await this.docClient.send(
      new PutCommand({
        TableName: this.getTableName('Users'),
        Item: {
          ...user,
          email: user.email.toLowerCase(),
        },
      }),
    );
  }

  async listUsers(limit = 100): Promise<any[]> {
    const res = await this.docClient.send(
      new ScanCommand({
        TableName: this.getTableName('Users'),
        Limit: limit,
      }),
    );
    return res.Items || [];
  }

  // --- Applications Table Helpers ---
  async getApplication(id: string): Promise<any> {
    const res = await this.docClient.send(
      new GetCommand({
        TableName: this.getTableName('Applications'),
        Key: { id },
      }),
    );
    return res.Item;
  }

  async saveApplication(item: any): Promise<void> {
    await this.docClient.send(
      new PutCommand({
        TableName: this.getTableName('Applications'),
        Item: item,
      }),
    );
  }

  async updateApplicationWithVersion(id: string, data: any, updated: string, expectedVersion: number): Promise<boolean> {
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.getTableName('Applications'),
          Key: { id },
          UpdateExpression: 'SET #d = :data, #u = :updated, #v = #v + :inc',
          ConditionExpression: '#v = :expectedVersion',
          ExpressionAttributeNames: {
            '#d': 'data',
            '#u': 'updated',
            '#v': 'version',
          },
          ExpressionAttributeValues: {
            ':data': data,
            ':updated': updated,
            ':inc': 1,
            ':expectedVersion': expectedVersion,
          },
        }),
      );
      return true;
    } catch (err: any) {
      if (err.name === 'ConditionalCheckFailedException') {
        return false;
      }
      throw err;
    }
  }

  async updateApplicationStatus(id: string, status: string, updated: string): Promise<void> {
    await this.docClient.send(
      new UpdateCommand({
        TableName: this.getTableName('Applications'),
        Key: { id },
        UpdateExpression: 'SET #s = :status, #u = :updated, #v = #v + :inc',
        ExpressionAttributeNames: {
          '#s': 'status',
          '#u': 'updated',
          '#v': 'version',
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':updated': updated,
          ':inc': 1,
        },
      }),
    );
  }

  async updateApplicationStatusAndData(id: string, status: string, data: any, updated: string): Promise<void> {
    await this.docClient.send(
      new UpdateCommand({
        TableName: this.getTableName('Applications'),
        Key: { id },
        UpdateExpression: 'SET #s = :status, #d = :data, #u = :updated, #v = #v + :inc',
        ExpressionAttributeNames: {
          '#s': 'status',
          '#d': 'data',
          '#u': 'updated',
          '#v': 'version',
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':data': data,
          ':updated': updated,
          ':inc': 1,
        },
      }),
    );
  }

  async queryUserApplications(owner: string, limit = 200): Promise<any[]> {
    const res = await this.docClient.send(
      new QueryCommand({
        TableName: this.getTableName('Applications'),
        IndexName: 'owner-updated-index',
        KeyConditionExpression: '#o = :owner',
        ExpressionAttributeNames: { '#o': 'owner' },
        ExpressionAttributeValues: { ':owner': owner },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return res.Items || [];
  }

  async queryReviewerQueue(limit = 200): Promise<any[]> {
    // Scan or query all non-draft applications
    const res = await this.docClient.send(
      new ScanCommand({
        TableName: this.getTableName('Applications'),
        FilterExpression: '#s <> :draft',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':draft': 'Draft' },
        Limit: limit,
      }),
    );
    return (res.Items || []).sort((a: any, b: any) => (b.updated || '').localeCompare(a.updated || ''));
  }

  async queryReviewerQueueByPassport(passport: string, limit = 100): Promise<any[]> {
    const clean = passport.trim().toUpperCase();
    const res = await this.docClient.send(
      new ScanCommand({
        TableName: this.getTableName('Applications'),
        FilterExpression: '#s <> :draft',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':draft': 'Draft' },
        Limit: limit * 2,
      }),
    );
    const items = (res.Items || []).filter((app: any) => {
      const pass = (app.data?.passportNumber || app.data?.guardianPassport || '').toUpperCase();
      const id = (app.id || '').toUpperCase();
      const name = `${app.data?.firstName || ''} ${app.data?.lastName || ''}`.toUpperCase();
      return pass.includes(clean) || id.includes(clean) || name.includes(clean);
    });
    return items.sort((a: any, b: any) => (b.updated || '').localeCompare(a.updated || ''));
  }

  // --- Profiles Table Helpers ---
  async getProfile(owner: string): Promise<any> {
    const res = await this.docClient.send(
      new GetCommand({
        TableName: this.getTableName('Profiles'),
        Key: { owner },
      }),
    );
    return res.Item?.data || {};
  }

  async saveProfile(owner: string, data: any, updated: string): Promise<void> {
    await this.docClient.send(
      new PutCommand({
        TableName: this.getTableName('Profiles'),
        Item: {
          owner,
          data,
          updated,
        },
      }),
    );
  }

  // --- Documents Table Helpers ---
  async saveDocumentMetadata(doc: any): Promise<void> {
    await this.docClient.send(
      new PutCommand({
        TableName: this.getTableName('Documents'),
        Item: doc,
      }),
    );
  }

  async getDocumentMetadata(id: string): Promise<any> {
    const res = await this.docClient.send(
      new GetCommand({
        TableName: this.getTableName('Documents'),
        Key: { id },
      }),
    );
    return res.Item;
  }

  async queryApplicationDocuments(application: string): Promise<any[]> {
    const res = await this.docClient.send(
      new QueryCommand({
        TableName: this.getTableName('Documents'),
        IndexName: 'application-index',
        KeyConditionExpression: '#app = :app',
        ExpressionAttributeNames: { '#app': 'application' },
        ExpressionAttributeValues: { ':app': application },
      }),
    );
    return res.Items || [];
  }

  async queryUserDocuments(owner: string): Promise<any[]> {
    const res = await this.docClient.send(
      new QueryCommand({
        TableName: this.getTableName('Documents'),
        IndexName: 'owner-created-index',
        KeyConditionExpression: '#o = :owner',
        ExpressionAttributeNames: { '#o': 'owner' },
        ExpressionAttributeValues: { ':owner': owner },
        ScanIndexForward: false,
      }),
    );
    return res.Items || [];
  }

  async deleteDocumentMetadata(id: string): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({
        TableName: this.getTableName('Documents'),
        Key: { id },
      }),
    );
  }

  // --- Activity Table Helpers ---
  async logActivity(item: any): Promise<void> {
    await this.docClient.send(
      new PutCommand({
        TableName: this.getTableName('Activity'),
        Item: item,
      }),
    );
  }

  async queryUserActivity(owner: string, limit = 100): Promise<any[]> {
    const res = await this.docClient.send(
      new QueryCommand({
        TableName: this.getTableName('Activity'),
        IndexName: 'owner-created-index',
        KeyConditionExpression: '#o = :owner',
        ExpressionAttributeNames: { '#o': 'owner' },
        ExpressionAttributeValues: { ':owner': owner },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return res.Items || [];
  }

  async queryApplicationActivity(application: string): Promise<any[]> {
    const res = await this.docClient.send(
      new QueryCommand({
        TableName: this.getTableName('Activity'),
        IndexName: 'application-index',
        KeyConditionExpression: '#app = :app',
        ExpressionAttributeNames: { '#app': 'application' },
        ExpressionAttributeValues: { ':app': application },
      }),
    );
    return (res.Items || []).sort((a: any, b: any) => (b.created || '').localeCompare(a.created || ''));
  }

  async markActivityRead(owner: string): Promise<void> {
    const activities = await this.queryUserActivity(owner, 50);
    for (const act of activities.filter((a) => !a.seen)) {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.getTableName('Activity'),
          Key: { id: act.id },
          UpdateExpression: 'SET #s = :seen',
          ExpressionAttributeNames: { '#s': 'seen' },
          ExpressionAttributeValues: { ':seen': 1 },
        }),
      );
    }
  }
}
