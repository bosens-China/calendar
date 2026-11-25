import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { DEFAULT_WORK_SLOTS } from '@calendar/shared';
import { createDb } from '../db.js';
import { holidays, invitations, members, projects, tasks } from '../schema.js';
import { getSetting, saveSetting } from '../store.js';
import { TEST_ADMIN_PASSWORD } from './fixture.js';

test('重新打开数据库时保留账号和已经清空的项目、节假日', t => {
  const dir = mkdtempSync(join(tmpdir(), 'calendar-database-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'nested', 'calendar.db');
  const first = createDb(path, TEST_ADMIN_PASSWORD);
  const admin = first.select().from(members).get();
  assert.match(admin?.passwordHash ?? '', /^\$2/);
  const slots = JSON.stringify([DEFAULT_WORK_SLOTS[0]]);
  saveSetting(first, 'workSlots', slots);
  first.delete(projects).run();
  first.delete(holidays).run();
  first.$client.close();

  const second = createDb(path);
  t.after(() => second.$client.close());
  assert.deepEqual(second.select().from(members).get(), admin);
  assert.deepEqual(second.select().from(holidays).all(), []);
  assert.deepEqual(second.select().from(projects).all(), []);
  assert.equal(getSetting(second, 'workSlots'), slots);
});

test('旧数据库迁移保留管理员、排期和设置，允许写入新增邀请表', t => {
  const dir = mkdtempSync(join(tmpdir(), 'calendar-legacy-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'legacy.db');
  const legacy = new DatabaseSync(path);
  legacy.exec(readFileSync(new URL('./legacy-schema.sql', import.meta.url), 'utf8'));
  legacy.exec(`
    INSERT INTO members VALUES ('legacy-admin', 'legacy', 'existing-hash', '旧管理员', 'admin', '', '#2563eb', 1, '2026', '2026');
    INSERT INTO projects VALUES ('legacy-project', '旧项目', '#2563eb', '', 0, '2026', '2026');
    INSERT INTO tasks VALUES ('legacy-task', '旧任务', '', 'legacy-project', 'legacy-admin',
      '2026-06-15', '09:00', '2026-06-15', '12:00', 'todo', 'medium', 0, 'legacy-admin', '2026', '2026');
    INSERT INTO settings VALUES ('workSlots', '[]'), ('jwtSecret', 'existing-secret');
  `);
  legacy.close();

  const db = createDb(path);
  t.after(() => db.$client.close());
  assert.equal(db.select().from(members).get()?.email, '');
  assert.equal(db.select().from(members).get()?.passwordHash, 'existing-hash');
  assert.equal(db.select().from(projects).get()?.name, '旧项目');
  assert.equal(getSetting(db, 'jwtSecret'), 'existing-secret');
  assert.equal(db.select({ title: tasks.title }).from(tasks).get()?.title, '旧任务');
  assert.deepEqual(db.select({ tokenHash: invitations.tokenHash }).from(invitations).all(), []);
});
