import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { DEFAULT_CN_HOLIDAYS, DEFAULT_WORK_SLOTS, type HolidayOverride } from '@calendar/shared';

const defaultPath = fileURLToPath(new URL('../data/calendar.db', import.meta.url));

export function transaction<T>(db: DatabaseSync, operation: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function replaceHolidays(db: DatabaseSync, holidays: HolidayOverride[], year?: number) {
  transaction(db, () => {
    if (year === undefined) db.exec('DELETE FROM holidays');
    else db.prepare('DELETE FROM holidays WHERE date BETWEEN ? AND ?').run(`${year}-01-01`, `${year}-12-31`);
    insertHolidays(db, holidays);
  });
}

function insertHolidays(db: DatabaseSync, holidays: HolidayOverride[]) {
  const insert = db.prepare('INSERT INTO holidays(date, name, kind) VALUES (?, ?, ?)');
  for (const holiday of holidays) insert.run(holiday.date, holiday.name, holiday.kind);
}

export function createDb(path = process.env.DB_PATH || defaultPath): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL');
    transaction(db, () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS members (
          id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL DEFAULT '',
          passwordHash TEXT NOT NULL,
          name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','member')),
          title TEXT NOT NULL, avatarColor TEXT NOT NULL, active INTEGER NOT NULL,
          createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, description TEXT NOT NULL,
          archived INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
          projectId TEXT NOT NULL REFERENCES projects(id),
          assigneeId TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          startDate TEXT NOT NULL, startTime TEXT NOT NULL, endDate TEXT NOT NULL, endTime TEXT NOT NULL,
          status TEXT NOT NULL, priority TEXT NOT NULL, adjustedByMember INTEGER NOT NULL,
          createdBy TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS leaves (
          id TEXT PRIMARY KEY, memberId TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          startDate TEXT NOT NULL, startTime TEXT NOT NULL, endDate TEXT NOT NULL, endTime TEXT NOT NULL,
          type TEXT NOT NULL, reason TEXT NOT NULL, createdBy TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS holidays (date TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS tasks_assignee_dates ON tasks(assigneeId, startDate, endDate);
        CREATE INDEX IF NOT EXISTS tasks_project ON tasks(projectId);
        CREATE INDEX IF NOT EXISTS leaves_member_dates ON leaves(memberId, startDate, endDate);
      `);
      const memberCols = db.prepare('PRAGMA table_info(members)').all() as Array<{ name: string }>;
      if (!memberCols.some(c => c.name === 'email')) {
        db.exec("ALTER TABLE members ADD COLUMN email TEXT NOT NULL DEFAULT ''");
      }
      const now = new Date().toISOString();
      if (!db.prepare("SELECT id FROM members WHERE role = 'admin' LIMIT 1").get()) {
        const initPass = process.env.ADMIN_INIT_PASSWORD || 'admin123';
        const initEmail = process.env.ADMIN_INIT_EMAIL || 'admin@calendar.local';
        db.prepare(`INSERT INTO members(id, username, email, passwordHash, name, role, title, avatarColor, active, createdAt, updatedAt)
                    VALUES (?, 'admin', ?, ?, '管理员', 'admin', '', '#2563eb', 1, ?, ?)`)
          .run(randomUUID(), initEmail, bcrypt.hashSync(initPass, 10), now, now);
      }
      // A saved empty holiday calendar or project list must survive the next startup.
      if (!db.prepare("SELECT key FROM settings WHERE key = 'workSlots'").get()) {
        db.prepare("INSERT INTO settings(key, value) VALUES ('workSlots', ?)").run(JSON.stringify(DEFAULT_WORK_SLOTS));
        const project = db.prepare(`INSERT INTO projects(id, name, color, description, archived, createdAt, updatedAt)
                                    VALUES (?, ?, ?, '', 0, ?, ?)`);
        project.run(randomUUID(), '核心研发', '#1677ff', now, now);
        project.run(randomUUID(), '运维支持', '#13a8a8', now, now);
        insertHolidays(db, DEFAULT_CN_HOLIDAYS.filter(h => h.date >= '2026-01-01'));
      }
    });
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
