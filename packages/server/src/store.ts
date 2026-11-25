import { randomUUID } from 'node:crypto';
import { and, between, eq, gte, lte, sql } from 'drizzle-orm';
import type { HolidayOverride, Leave, Member, Project, Task, TaskStatus, WorkSlot } from '@calendar/shared';
import { HTTPException } from 'hono/http-exception';
import type { CalendarDb } from './db.js';
import { holidays as holidayTable, leaves, members, projects, settings, tasks } from './schema.js';

const entities = { members, projects, tasks, leaves };
type Table = keyof typeof entities;
type Entities = { members: Member; projects: Project; tasks: Task; leaves: Leave };
type Fields<K extends Table> = Omit<(typeof entities)[K]['$inferInsert'], 'id' | 'createdAt' | 'updatedAt'>;

export function publicMember({ passwordHash, ...member }: typeof members.$inferSelect): Member {
  return passwordHash ? member : { ...member, pendingInvitation: true };
}

export function findById<K extends Table>(db: CalendarDb, table: K, id: string): Entities[K] | undefined {
  if (table === 'members') {
    const member = db.select().from(members).where(eq(members.id, id)).get();
    return (member && publicMember(member)) as Entities[K] | undefined;
  }
  const entity = entities[table];
  return db.select().from(entity).where(eq(entity.id, id)).get() as Entities[K] | undefined;
}

export function getById<K extends Table>(db: CalendarDb, table: K, id: string): Entities[K] {
  const item = findById(db, table, id);
  if (!item) throw new HTTPException(404, { message: '记录不存在' });
  return item;
}

export function listMembers(db: CalendarDb, id?: string): Member[] {
  return db.select().from(members).where(id === undefined ? undefined : eq(members.id, id))
    .orderBy(members.createdAt, sql`rowid`).all().map(publicMember);
}

export function listProjects(db: CalendarDb): Project[] {
  return db.select().from(projects).orderBy(projects.createdAt, sql`rowid`).all();
}

export interface ScheduleFilters {
  startDate?: string;
  endDate?: string;
  memberId?: string;
  projectId?: string;
  status?: TaskStatus;
}

export function listSchedule(db: CalendarDb, table: 'tasks', filters: ScheduleFilters): Task[];
export function listSchedule(db: CalendarDb, table: 'leaves', filters: ScheduleFilters): Leave[];
export function listSchedule(db: CalendarDb, table: 'tasks' | 'leaves', filters: ScheduleFilters) {
  const entity = entities[table];
  return db.select().from(entity).where(and(
    filters.startDate === undefined ? undefined : gte(entity.endDate, filters.startDate),
    filters.endDate === undefined ? undefined : lte(entity.startDate, filters.endDate),
    filters.memberId === undefined ? undefined : eq(table === 'tasks' ? tasks.assigneeId : leaves.memberId, filters.memberId),
    table !== 'tasks' || filters.projectId === undefined ? undefined : eq(tasks.projectId, filters.projectId),
    table !== 'tasks' || filters.status === undefined ? undefined : eq(tasks.status, filters.status),
  )).orderBy(entity.startDate, entity.startTime, sql`rowid`).all();
}

type NewEntity<K extends Table> = Fields<K> & { id: string; createdAt: string; updatedAt: string };
type EntityUpdate<K extends Table> = Partial<Fields<K>> & { updatedAt: string };

const insertEntity: { [K in Table]: (db: CalendarDb, row: NewEntity<K>) => void } = {
  members: (db, row) => { db.insert(members).values(row).run(); },
  projects: (db, row) => { db.insert(projects).values(row).run(); },
  tasks: (db, row) => { db.insert(tasks).values(row).run(); },
  leaves: (db, row) => { db.insert(leaves).values(row).run(); },
};

const updateEntity: { [K in Table]: (db: CalendarDb, id: string, row: EntityUpdate<K>) => void } = {
  members: (db, id, row) => { db.update(members).set(row).where(eq(members.id, id)).run(); },
  projects: (db, id, row) => { db.update(projects).set(row).where(eq(projects.id, id)).run(); },
  tasks: (db, id, row) => { db.update(tasks).set(row).where(eq(tasks.id, id)).run(); },
  leaves: (db, id, row) => { db.update(leaves).set(row).where(eq(leaves.id, id)).run(); },
};

export function insert<K extends Table>(db: CalendarDb, table: K, fields: Fields<K>): Entities[K] {
  const id = randomUUID();
  const now = new Date().toISOString();
  insertEntity[table](db, { ...fields, id, createdAt: now, updatedAt: now });
  return getById(db, table, id);
}

export function update<K extends Table>(db: CalendarDb, table: K, id: string, fields: Partial<Fields<K>>): Entities[K] {
  updateEntity[table](db, id, { ...fields, updatedAt: new Date().toISOString() });
  return getById(db, table, id);
}

export function remove(db: CalendarDb, table: Table, id: string) {
  const entity = entities[table];
  if (!db.delete(entity).where(eq(entity.id, id)).run().changes) {
    throw new HTTPException(404, { message: '记录不存在' });
  }
}

export function getSetting(db: CalendarDb, key: string) {
  return db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).get()?.value;
}

export function saveSetting(db: CalendarDb, key: string, value: string) {
  db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
}

export function workSlots(db: CalendarDb): WorkSlot[] {
  return JSON.parse(getSetting(db, 'workSlots')!);
}

function holidayYear(year?: number) {
  return year === undefined ? undefined : between(holidayTable.date, `${year}-01-01`, `${year}-12-31`);
}

export function holidays(db: CalendarDb, year?: number): HolidayOverride[] {
  return db.select().from(holidayTable).where(holidayYear(year)).orderBy(holidayTable.date).all();
}

export function replaceHolidays(db: CalendarDb, days: HolidayOverride[], year?: number) {
  db.delete(holidayTable).where(holidayYear(year)).run();
  // Keep large imports below SQLite's binding limit.
  for (let offset = 0; offset < days.length; offset += 200) {
    db.insert(holidayTable).values(days.slice(offset, offset + 200)).run();
  }
}
