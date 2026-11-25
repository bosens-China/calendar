import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { HolidayOverride, Leave, Member, Project, Task, WorkSlot } from '@calendar/shared';
import { HTTPException } from 'hono/http-exception';

interface Entities { members: Member; projects: Project; tasks: Task; leaves: Leave }
type Table = keyof Entities;
const memberColumns = 'id, username, email, name, role, title, avatarColor, active, createdAt, updatedAt';
const booleanColumns = ['active', 'archived', 'adjustedByMember'];

function decode<T>(result: unknown): T {
  const row = result as Record<string, unknown>;
  for (const key of booleanColumns) if (key in row) row[key] = Boolean(row[key]);
  return row as T;
}

export function findById<K extends Table>(db: DatabaseSync, table: K, id: string): Entities[K] | undefined {
  const columns = table === 'members' ? memberColumns : '*';
  const row = db.prepare(`SELECT ${columns} FROM ${table} WHERE id = ?`).get(id);
  return row ? decode<Entities[K]>(row) : undefined;
}

export function getById<K extends Table>(db: DatabaseSync, table: K, id: string): Entities[K] {
  const item = findById(db, table, id);
  if (!item) throw new HTTPException(404, { message: '记录不存在' });
  return item;
}

export function listMembers(db: DatabaseSync, id?: string): Member[] {
  if (id !== undefined) {
    const member = findById(db, 'members', id);
    return member ? [member] : [];
  }
  return db.prepare(`SELECT ${memberColumns} FROM members ORDER BY createdAt, rowid`).all().map(decode<Member>);
}

export function listProjects(db: DatabaseSync): Project[] {
  return db.prepare('SELECT * FROM projects ORDER BY createdAt, rowid').all().map(decode<Project>);
}

export interface ScheduleFilters {
  startDate?: string; endDate?: string; memberId?: string; projectId?: string; status?: string;
}

export function listSchedule<K extends 'tasks' | 'leaves'>(db: DatabaseSync, table: K, filters: ScheduleFilters): Entities[K][] {
  const clauses: string[] = [];
  const values: string[] = [];
  function filter(clause: string, value?: string) {
    if (value !== undefined) { clauses.push(clause); values.push(value); }
  }
  filter('endDate >= ?', filters.startDate);
  filter('startDate <= ?', filters.endDate);
  filter(table === 'tasks' ? 'assigneeId = ?' : 'memberId = ?', filters.memberId);
  if (table === 'tasks') {
    filter('projectId = ?', filters.projectId);
    filter('status = ?', filters.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM ${table} ${where} ORDER BY startDate, startTime, rowid`).all(...values).map(decode<Entities[K]>);
}

type Values = Record<string, string | boolean>;
const bindings = (values: Values) => Object.values(values).map(v => typeof v === 'boolean' ? Number(v) : v);

// The caller supplies only server-owned keys and fields from strict DTO schemas.
export function insert<K extends Table>(db: DatabaseSync, table: K, fields: Values): Entities[K] {
  const id = randomUUID();
  const now = new Date().toISOString();
  const values = { ...fields, id, createdAt: now, updatedAt: now };
  const columns = Object.keys(values);
  db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`).run(...bindings(values));
  return getById(db, table, id);
}

export function update<K extends Table>(db: DatabaseSync, table: K, id: string, fields: Values): Entities[K] {
  const values = { ...fields, updatedAt: new Date().toISOString() };
  const assignments = Object.keys(values).map(key => `${key} = ?`);
  db.prepare(`UPDATE ${table} SET ${assignments.join(', ')} WHERE id = ?`).run(...bindings(values), id);
  return getById(db, table, id);
}

export function remove(db: DatabaseSync, table: Table, id: string) {
  const result = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  if (!result.changes) throw new HTTPException(404, { message: '记录不存在' });
}

export function workSlots(db: DatabaseSync): WorkSlot[] {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'workSlots'").get() as { value: string };
  return JSON.parse(row.value);
}

export function holidays(db: DatabaseSync, year?: number): HolidayOverride[] {
  const rows = year === undefined
    ? db.prepare('SELECT * FROM holidays ORDER BY date').all()
    : db.prepare('SELECT * FROM holidays WHERE date BETWEEN ? AND ? ORDER BY date').all(`${year}-01-01`, `${year}-12-31`);
  return rows.map(decode<HolidayOverride>);
}
