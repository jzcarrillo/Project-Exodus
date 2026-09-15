import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  PayloadTooLargeException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { DynamoDBService } from '../aws/dynamodb.service';
import { S3Service } from '../aws/s3.service';
import { UserIdentity } from '../common/types';
import { SERVICES } from '../common/services.data';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { Readable } from 'stream';

@Injectable()
export class DocumentsService implements OnModuleInit {
  private uploadDir: string;

  constructor(
    private readonly dbService: DatabaseService,
    private readonly dynamoService: DynamoDBService,
    private readonly s3Service: S3Service,
  ) {}

  onModuleInit() {
    this.uploadDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  private get isDynamo(): boolean {
    return (process.env.DB_PROVIDER || 'sqlite').toLowerCase() === 'dynamodb';
  }

  private get isS3(): boolean {
    return (process.env.STORAGE_PROVIDER || 'local').toLowerCase() === 's3';
  }

  private get sqlite() {
    return this.dbService.instance;
  }

  async uploadDocument(
    user: UserIdentity,
    applicationId: string,
    kind: string,
    filename: string,
    fileBuffer: Buffer,
    contentType?: string,
  ) {
    if (!applicationId) {
      throw new BadRequestException('Application ID is required.');
    }

    // Verify application eligibility
    let app: any;
    if (this.isDynamo) {
      app = await this.dynamoService.getApplication(applicationId);
    } else {
      app = this.sqlite.prepare('SELECT * FROM applications WHERE id = ? AND owner = ?').get(applicationId, user.userId) as any;
    }

    if (!app || app.owner !== user.userId || !['Draft', 'For correction'].includes(app.status)) {
      throw new BadRequestException('Save an editable draft before uploading.');
    }

    const service = SERVICES.find((s) => s.id === app.service);
    if (!service || !service.documents.includes(kind)) {
      throw new BadRequestException('Invalid document category for this service.');
    }

    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    if (
      !ext ||
      !mimeMap[ext] ||
      (kind.includes('.xlsx') && ext !== 'xlsx') ||
      (kind === 'Facial image' && !['jpg', 'jpeg', 'png'].includes(ext))
    ) {
      throw new BadRequestException('Use a supported PDF, JPG, PNG, or XLSX file for this requirement.');
    }

    const maxSizeBytes = ext === 'xlsx' ? 105906176 : 10485760; // 101 MB for XLSX, 10 MB for others
    const size = fileBuffer.length;

    if (size <= 0 || size > maxSizeBytes) {
      throw new PayloadTooLargeException(
        ext === 'xlsx' ? 'Manifest limit is 101 MB.' : 'Document limit is 10 MB.',
      );
    }

    const id = crypto.randomUUID();
    const mime = contentType || mimeMap[ext];
    const now = new Date().toISOString();
    const s3Key = `applications/${applicationId}/${id}_${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // 1. Store file binary (S3 or Local Disk)
    if (this.isS3) {
      await this.s3Service.uploadFile(s3Key, fileBuffer, mime, {
        owner: user.userId,
        applicationId,
        kind,
      });
    } else {
      const localFilePath = path.join(this.uploadDir, id);
      await fs.promises.writeFile(localFilePath, fileBuffer);
    }

    // 2. Store metadata (DynamoDB or SQLite)
    const docMeta = {
      id,
      owner: user.userId,
      application: applicationId,
      name: filename.slice(0, 200),
      kind,
      mime,
      size,
      s3Key: this.isS3 ? s3Key : '',
      created: now,
    };

    try {
      if (this.isDynamo) {
        await this.dynamoService.saveDocumentMetadata(docMeta);
        await this.dynamoService.logActivity({
          id: crypto.randomUUID(),
          owner: user.userId,
          application: applicationId,
          action: 'Document uploaded',
          note: kind,
          created: now,
          seen: 0,
        });
      } else {
        this.sqlite
          .prepare(
            'INSERT INTO documents (id, owner, application, name, kind, mime, size, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .run(id, user.userId, applicationId, filename.slice(0, 200), kind, mime, size, now);

        this.sqlite
          .prepare(
            'INSERT INTO activity (id, owner, application, action, note, created, seen) VALUES (?, ?, ?, ?, ?, ?, 0)',
          )
          .run(crypto.randomUUID(), user.userId, applicationId, 'Document uploaded', kind, now);
      }

      return { id };
    } catch (err) {
      if (this.isS3) {
        await this.s3Service.deleteFile(s3Key).catch(() => {});
      } else {
        const localFilePath = path.join(this.uploadDir, id);
        if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
      }
      throw err;
    }
  }

  async getDocument(user: UserIdentity, id: string): Promise<{ stream: Readable; metadata: any }> {
    let doc: any;
    if (this.isDynamo) {
      doc = await this.dynamoService.getDocumentMetadata(id);
    } else {
      doc = this.sqlite.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
    }

    if (!doc || (doc.owner !== user.userId && user.role !== 'reviewer')) {
      throw new NotFoundException('Document not found.');
    }

    if (this.isS3 && doc.s3Key) {
      const { stream } = await this.s3Service.getFileStream(doc.s3Key);
      return {
        stream,
        metadata: doc,
      };
    }

    // Local Disk
    const filePath = path.join(this.uploadDir, doc.id);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Document file unavailable on local storage.');
    }

    const fileStream = fs.createReadStream(filePath);
    return {
      stream: fileStream,
      metadata: doc,
    };
  }
}
