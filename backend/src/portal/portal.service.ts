import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { DynamoDBService } from '../aws/dynamodb.service';
import { UserIdentity } from '../common/types';
import { SERVICES, validateApplicationFields } from '../common/services.data';
import * as crypto from 'crypto';

@Injectable()
export class PortalService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly dynamoService: DynamoDBService,
  ) {}

  private get isDynamo(): boolean {
    return (process.env.DB_PROVIDER || 'sqlite').toLowerCase() === 'dynamodb';
  }

  private get sqlite() {
    return this.dbService.instance;
  }

  async getPortalData(user: UserIdentity, applicationId?: string, review?: boolean, passport?: string) {
    if (this.isDynamo) {
      return this.getPortalDataDynamo(user, applicationId, review, passport);
    }
    return this.getPortalDataSqlite(user, applicationId, review, passport);
  }

  private async getPortalDataDynamo(user: UserIdentity, applicationId?: string, review?: boolean, passport?: string) {
    if (applicationId) {
      const app = await this.dynamoService.getApplication(applicationId);
      if (!app || (app.owner !== user.userId && user.role !== 'reviewer')) {
        throw new NotFoundException('Application not found.');
      }
      const documents = await this.dynamoService.queryApplicationDocuments(applicationId);
      const activity = await this.dynamoService.queryApplicationActivity(applicationId);

      return { documents, activity };
    }

    if (review) {
      if (user.role !== 'reviewer') {
        throw new ForbiddenException('A BI reviewer role is required.');
      }
      const records = passport && passport.trim()
        ? await this.dynamoService.queryReviewerQueueByPassport(passport.trim())
        : await this.dynamoService.queryReviewerQueue(200);
      const profile = await this.dynamoService.getProfile(user.userId);
      const documents = await this.dynamoService.queryUserDocuments(user.userId);
      const activity = await this.dynamoService.queryUserActivity(user.userId, 100);

      return {
        user: { name: user.displayName, email: user.email, role: user.role },
        profile,
        applications: records,
        documents,
        activity,
      };
    }

    const records = await this.dynamoService.queryUserApplications(user.userId, 200);
    const profile = await this.dynamoService.getProfile(user.userId);
    const documents = await this.dynamoService.queryUserDocuments(user.userId);
    const activity = await this.dynamoService.queryUserActivity(user.userId, 100);

    return {
      user: { name: user.displayName, email: user.email, role: user.role },
      profile,
      applications: records,
      documents,
      activity,
    };
  }

  private async getPortalDataSqlite(user: UserIdentity, applicationId?: string, review?: boolean, passport?: string) {
    if (applicationId) {
      const app = this.sqlite.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId) as any;
      if (!app || (app.owner !== user.userId && user.role !== 'reviewer')) {
        throw new NotFoundException('Application not found.');
      }
      const documents = this.sqlite.prepare('SELECT * FROM documents WHERE application = ?').all(applicationId);
      const activity = this.sqlite
        .prepare('SELECT * FROM activity WHERE application = ? ORDER BY created DESC')
        .all(applicationId);

      return { documents, activity };
    }

    if (review) {
      if (user.role !== 'reviewer') {
        throw new ForbiddenException('A BI reviewer role is required.');
      }
      let records: any[];
      if (passport && passport.trim()) {
        const clean = `%${passport.trim()}%`;
        records = this.sqlite
          .prepare("SELECT * FROM applications WHERE status != 'Draft' AND (id LIKE ? OR data LIKE ?) ORDER BY updated DESC LIMIT 100")
          .all(clean, clean) as any[];
      } else {
        records = this.sqlite
          .prepare("SELECT * FROM applications WHERE status != 'Draft' ORDER BY updated DESC LIMIT 200")
          .all() as any[];
      }

      const profile = this.sqlite.prepare('SELECT data FROM profiles WHERE owner = ?').get(user.userId) as any;
      const documents = this.sqlite.prepare('SELECT * FROM documents WHERE owner = ? ORDER BY created DESC').all(user.userId);
      const activity = this.sqlite
        .prepare('SELECT * FROM activity WHERE owner = ? ORDER BY created DESC LIMIT 100')
        .all(user.userId);

      return {
        user: { name: user.displayName, email: user.email, role: user.role },
        profile: profile ? JSON.parse(profile.data) : {},
        applications: records.map((r) => ({ ...r, data: JSON.parse(r.data) })),
        documents,
        activity,
      };
    }

    const records = this.sqlite
      .prepare('SELECT * FROM applications WHERE owner = ? ORDER BY updated DESC LIMIT 200')
      .all(user.userId) as any[];

    const profile = this.sqlite.prepare('SELECT data FROM profiles WHERE owner = ?').get(user.userId) as any;
    const documents = this.sqlite.prepare('SELECT * FROM documents WHERE owner = ? ORDER BY created DESC').all(user.userId);
    const activity = this.sqlite
      .prepare('SELECT * FROM activity WHERE owner = ? ORDER BY created DESC LIMIT 100')
      .all(user.userId);

    return {
      user: { name: user.displayName, email: user.email, role: user.role },
      profile: profile ? JSON.parse(profile.data) : {},
      applications: records.map((r) => ({ ...r, data: JSON.parse(r.data) })),
      documents,
      activity,
    };
  }

  async saveDraft(user: UserIdentity, body: { id?: string; service: string; data: Record<string, string>; version?: number }) {
    const service = SERVICES.find((s) => s.id === body.service);
    if (!service) {
      throw new BadRequestException('Choose a valid service.');
    }

    const keys = new Set([...service.sections.flatMap((s) => s.fields.map((f) => f.key)), 'provinceCode', 'cityCode', 'barangayCode']);
    const sanitizedData = Object.fromEntries(
      Object.entries(body.data || {})
        .filter(([k, v]) => keys.has(k) && typeof v === 'string')
        .map(([k, v]) => [k, (v as string).slice(0, 5000)]),
    );

    const now = new Date().toISOString();
    const id = body.id || 'BI-' + crypto.randomUUID();

    if (this.isDynamo) {
      if (body.id) {
        const existing = await this.dynamoService.getApplication(id);
        if (!existing || existing.owner !== user.userId || !['Draft', 'For correction'].includes(existing.status)) {
          throw new ConflictException('This application cannot be edited.');
        }

        const success = await this.dynamoService.updateApplicationWithVersion(
          id,
          sanitizedData,
          now,
          body.version || existing.version,
        );

        if (!success) {
          throw new ConflictException('This draft changed in another window. Reload before editing.');
        }
      } else {
        await this.dynamoService.saveApplication({
          id,
          owner: user.userId,
          service: service.id,
          status: 'Draft',
          data: sanitizedData,
          created: now,
          updated: now,
          version: 1,
        });
        await this.logActivity(user.userId, id, 'Draft created', service.name);
      }

      return { id, version: (body.id ? Number(body.version || 1) : 0) + 1 };
    }

    // SQLite fallback
    if (body.id) {
      const existing = this.sqlite.prepare('SELECT * FROM applications WHERE id = ? AND owner = ?').get(id, user.userId) as any;
      if (!existing || !['Draft', 'For correction'].includes(existing.status)) {
        throw new ConflictException('This application cannot be edited.');
      }

      const result = this.sqlite
        .prepare('UPDATE applications SET data = ?, updated = ?, version = version + 1 WHERE id = ? AND owner = ? AND version = ?')
        .run(JSON.stringify(sanitizedData), now, id, user.userId, body.version || existing.version);

      if (!result.changes) {
        throw new ConflictException('This draft changed in another window. Reload before editing.');
      }
    } else {
      const insert = this.sqlite.prepare(
        'INSERT INTO applications (id, owner, service, status, data, created, updated, version) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
      );
      insert.run(id, user.userId, service.id, 'Draft', JSON.stringify(sanitizedData), now, now);
      await this.logActivity(user.userId, id, 'Draft created', service.name);
    }

    return {
      id,
      version: (body.id ? Number(body.version || 1) : 0) + 1,
    };
  }

  async submitApplication(user: UserIdentity, id: string) {
    const now = new Date().toISOString();

    if (this.isDynamo) {
      const app = await this.dynamoService.getApplication(id);
      if (!app || app.owner !== user.userId || !['Draft', 'For correction'].includes(app.status)) {
        throw new ConflictException('Application is no longer editable.');
      }

      const missing = validateApplicationFields(app.service, app.data);
      if (missing.length) {
        throw new BadRequestException('Complete these fields: ' + missing.join(', '));
      }

      const service = SERVICES.find((s) => s.id === app.service);
      if (!service) throw new BadRequestException('Unknown service.');

      const uploaded = await this.dynamoService.queryApplicationDocuments(app.id);
      const required = service.documents.filter((kind) => !uploaded.some((d) => d.kind === kind));
      if (required.length) {
        throw new BadRequestException('Upload required documents: ' + required.join(', '));
      }

      await this.dynamoService.updateApplicationStatus(app.id, 'Submitted', now);
      await this.logActivity(user.userId, app.id, 'Application submitted', 'Saved in preview workspace.');
      return { ok: true };
    }

    // SQLite
    const app = this.sqlite.prepare('SELECT * FROM applications WHERE id = ? AND owner = ?').get(id, user.userId) as any;
    if (!app || !['Draft', 'For correction'].includes(app.status)) {
      throw new ConflictException('Application is no longer editable.');
    }

    const appData = JSON.parse(app.data);
    const missing = validateApplicationFields(app.service, appData);
    if (missing.length) {
      throw new BadRequestException('Complete these fields: ' + missing.join(', '));
    }

    const service = SERVICES.find((s) => s.id === app.service);
    if (!service) throw new BadRequestException('Unknown service.');

    const uploaded = this.sqlite.prepare('SELECT kind FROM documents WHERE application = ? AND owner = ?').all(app.id, user.userId) as any[];
    const required = service.documents.filter((kind) => !uploaded.some((d) => d.kind === kind));
    if (required.length) {
      throw new BadRequestException('Upload required documents: ' + required.join(', '));
    }

    this.sqlite
      .prepare("UPDATE applications SET status = 'Submitted', updated = ?, version = version + 1 WHERE id = ? AND owner = ? AND status IN ('Draft', 'For correction')")
      .run(now, app.id, user.userId);

    await this.logActivity(user.userId, app.id, 'Application submitted', 'Saved in preview workspace.');
    return { ok: true };
  }

  async updateProfile(user: UserIdentity, data: Record<string, string>) {
    const allowed = [
      'firstName',
      'lastName',
      'birthDate',
      'nationality',
      'phone',
      'street',
      'barangay',
      'city',
      'province',
      'postalCode',
      'provinceCode',
      'cityCode',
      'barangayCode',
    ];
    const sanitized = Object.fromEntries(
      allowed.map((k) => [k, String(data?.[k] || '').slice(0, 500)]),
    );
    const now = new Date().toISOString();

    if (this.isDynamo) {
      await this.dynamoService.saveProfile(user.userId, sanitized, now);
      await this.logActivity(user.userId, '', 'Profile updated');
      return { ok: true };
    }

    this.sqlite
      .prepare(
        'INSERT INTO profiles (owner, data, updated) VALUES (?, ?, ?) ON CONFLICT(owner) DO UPDATE SET data = excluded.data, updated = excluded.updated',
      )
      .run(user.userId, JSON.stringify(sanitized), now);

    await this.logActivity(user.userId, '', 'Profile updated');
    return { ok: true };
  }

  async markActivityRead(user: UserIdentity) {
    if (this.isDynamo) {
      await this.dynamoService.markActivityRead(user.userId);
      return { ok: true };
    }
    this.sqlite.prepare('UPDATE activity SET seen = 1 WHERE owner = ?').run(user.userId);
    return { ok: true };
  }

  async reviewApplication(user: UserIdentity, body: { id: string; status: string; note: string }) {
    if (user.role !== 'reviewer') {
      throw new ForbiddenException('A BI reviewer role is required.');
    }
    const allowedStatuses = ['Under review', 'For correction', 'Approved', 'Disapproved', 'Endorsed'];
    if (!allowedStatuses.includes(body.status)) {
      throw new BadRequestException('Invalid processing action.');
    }
    if (!String(body.note || '').trim()) {
      throw new BadRequestException('Add a processing note.');
    }

    const now = new Date().toISOString();

    if (this.isDynamo) {
      const app = await this.dynamoService.getApplication(body.id);
      if (!app) throw new NotFoundException('Application not found.');
      if (['Approved', 'Disapproved'].includes(app.status)) {
        throw new ConflictException('This application already has a final decision.');
      }

      await this.dynamoService.updateApplicationStatus(app.id, body.status, now);
      await this.logActivity(
        app.owner,
        app.id,
        body.status,
        `${String(body.note).slice(0, 5000)} · Reviewer: ${user.email}`,
      );
      return { ok: true };
    }

    const app = this.sqlite.prepare("SELECT * FROM applications WHERE id = ? AND status != 'Draft'").get(body.id) as any;
    if (!app) throw new NotFoundException('Application not found.');
    if (['Approved', 'Disapproved'].includes(app.status)) {
      throw new ConflictException('This application already has a final decision.');
    }

    this.sqlite
      .prepare('UPDATE applications SET status = ?, updated = ?, version = version + 1 WHERE id = ?')
      .run(body.status, now, app.id);

    await this.logActivity(
      app.owner,
      app.id,
      body.status,
      `${String(body.note).slice(0, 5000)} · Reviewer: ${user.email}`,
    );

    return { ok: true };
  }

  async logActivity(owner: string, application: string, action: string, note = '') {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    if (this.isDynamo) {
      await this.dynamoService.logActivity({
        id,
        owner,
        application: application || '',
        action,
        note,
        created: now,
        seen: 0,
      });
      return;
    }

    this.sqlite
      .prepare('INSERT INTO activity (id, owner, application, action, note, created, seen) VALUES (?, ?, ?, ?, ?, ?, 0)')
      .run(id, owner, application, action, note, now);
  }
}
