CREATE TABLE IF NOT EXISTS members (
id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
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
