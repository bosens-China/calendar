import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const timestampColumns = () => ({
  createdAt: text().notNull(),
  updatedAt: text().notNull(),
});

const scheduleSpan = () => ({
  startDate: text().notNull(),
  startTime: text().notNull(),
  endDate: text().notNull(),
  endTime: text().notNull(),
  createdBy: text().notNull(),
  ...timestampColumns(),
});

export const members = sqliteTable('members', {
  id: text().primaryKey(),
  username: text().notNull().unique(),
  email: text().notNull().default(''),
  passwordHash: text().notNull(),
  name: text().notNull(),
  role: text({ enum: ['admin', 'member'] }).notNull(),
  title: text().notNull(),
  avatarColor: text().notNull(),
  active: integer({ mode: 'boolean' }).notNull(),
  ...timestampColumns(),
}, table => [check('members_role_check', sql`${table.role} IN ('admin','member')`)]);

export const projects = sqliteTable('projects', {
  id: text().primaryKey(),
  name: text().notNull(),
  color: text().notNull(),
  description: text().notNull(),
  archived: integer({ mode: 'boolean' }).notNull(),
  ...timestampColumns(),
});

export const tasks = sqliteTable('tasks', {
  id: text().primaryKey(),
  title: text().notNull(),
  description: text().notNull(),
  projectId: text().notNull().references(() => projects.id),
  assigneeId: text().notNull().references(() => members.id, { onDelete: 'cascade' }),
  status: text({ enum: ['todo', 'in_progress', 'done', 'delayed'] }).notNull(),
  priority: text({ enum: ['high', 'medium', 'low'] }).notNull(),
  adjustedByMember: integer({ mode: 'boolean' }).notNull(),
  ...scheduleSpan(),
}, table => [
  index('tasks_assignee_dates').on(table.assigneeId, table.startDate, table.endDate),
  index('tasks_project').on(table.projectId),
]);

export const leaves = sqliteTable('leaves', {
  id: text().primaryKey(),
  memberId: text().notNull().references(() => members.id, { onDelete: 'cascade' }),
  type: text({ enum: ['annual', 'sick', 'personal', 'compensatory', 'other'] }).notNull(),
  reason: text().notNull(),
  ...scheduleSpan(),
}, table => [index('leaves_member_dates').on(table.memberId, table.startDate, table.endDate)]);

export const settings = sqliteTable('settings', {
  key: text().primaryKey(),
  value: text().notNull(),
});

export const holidays = sqliteTable('holidays', {
  date: text().primaryKey(),
  name: text().notNull(),
  kind: text({ enum: ['holiday', 'workday'] }).notNull(),
});

export const invitations = sqliteTable('invitations', {
  memberId: text().primaryKey().notNull().references(() => members.id, { onDelete: 'cascade' }),
  tokenHash: text().notNull().unique(),
  expiresAt: text().notNull(),
});
