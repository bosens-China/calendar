import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { drizzle, type NodeSQLiteDatabase } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { DEFAULT_CN_HOLIDAYS, DEFAULT_WORK_SLOTS } from '@calendar/shared';
import { holidays, members, projects, settings } from './schema.js';

const defaultPath = fileURLToPath(new URL('../data/calendar.db', import.meta.url));
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

export type CalendarDb = NodeSQLiteDatabase;

export function transaction<T>(db: CalendarDb, operation: (db: CalendarDb) => T & (T extends PromiseLike<unknown> ? never : unknown)): T {
  return db.transaction<unknown>(operation, { behavior: 'immediate' }) as T;
}

export function createDb(path = process.env.DB_PATH || defaultPath, initialPassword = process.env.ADMIN_INIT_PASSWORD) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const client = new DatabaseSync(path);
  const db = drizzle({ client });
  try {
    client.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL');
    transaction(db, () => {
      // Early SQLite files lacked email. The baseline migration reuses these tables.
      const columns = client.prepare('PRAGMA table_info(members)').all() as Array<{ name: string }>;
      if (columns.length && !columns.some(column => column.name === 'email')) {
        client.exec("ALTER TABLE members ADD COLUMN email TEXT NOT NULL DEFAULT ''");
      }
    });
    migrate(db, { migrationsFolder });
    transaction(db, tx => {
      const now = new Date().toISOString();
      if (!tx.select({ id: members.id }).from(members).where(eq(members.role, 'admin')).get()) {
        if (!initialPassword || initialPassword.length < 12 || Buffer.byteLength(initialPassword) > 72) {
          throw new Error('初始化数据库时，ADMIN_INIT_PASSWORD 必须至少有 12 个字符且不超过 72 字节');
        }
        tx.insert(members).values({
          id: randomUUID(), username: 'admin', email: process.env.ADMIN_INIT_EMAIL || 'admin@calendar.local',
          name: '管理员', passwordHash: bcrypt.hashSync(initialPassword, 10), role: 'admin',
          title: '', avatarColor: '#2563eb', active: true, createdAt: now, updatedAt: now,
        }).run();
      }
      if (!tx.select({ key: settings.key }).from(settings).where(eq(settings.key, 'workSlots')).get()) {
        tx.insert(settings).values({ key: 'workSlots', value: JSON.stringify(DEFAULT_WORK_SLOTS) }).run();
        tx.insert(projects).values([
          { name: '核心研发', color: '#1677ff' },
          { name: '运维支持', color: '#13a8a8' },
        ].map(project => ({
          ...project, id: randomUUID(), description: '', archived: false, createdAt: now, updatedAt: now,
        }))).run();
        tx.insert(holidays).values(DEFAULT_CN_HOLIDAYS.filter(day => day.date >= '2026-01-01')).run();
      }
    });
    return db;
  } catch (error) {
    client.close();
    throw error;
  }
}
