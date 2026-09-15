import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private db: DatabaseType;

  onModuleInit() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'exodus.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
  }

  onModuleDestroy() {
    if (this.db) {
      this.db.close();
    }
  }

  get instance(): DatabaseType {
    return this.db;
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY NOT NULL,
        passwordHash TEXT NOT NULL,
        salt TEXT NOT NULL,
        firstName TEXT,
        lastName TEXT,
        middleName TEXT,
        displayName TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'applicant',
        contactNumber TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS profiles (
        owner TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        updated TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY NOT NULL,
        owner TEXT NOT NULL,
        service TEXT NOT NULL,
        status TEXT NOT NULL,
        data TEXT NOT NULL,
        created TEXT NOT NULL,
        updated TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY NOT NULL,
        owner TEXT NOT NULL,
        application TEXT NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        created TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS activity (
        id TEXT PRIMARY KEY NOT NULL,
        owner TEXT NOT NULL,
        application TEXT,
        action TEXT NOT NULL,
        note TEXT,
        created TEXT NOT NULL,
        seen INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_apps_owner ON applications(owner);
      CREATE INDEX IF NOT EXISTS idx_apps_status ON applications(status);
      CREATE INDEX IF NOT EXISTS idx_docs_app ON documents(application);
      CREATE INDEX IF NOT EXISTS idx_activity_owner ON activity(owner);
    `);
  }
}
