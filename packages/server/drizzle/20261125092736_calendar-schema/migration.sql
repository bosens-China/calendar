-- Idempotent baseline for databases created before Drizzle was introduced.
CREATE TABLE IF NOT EXISTS `holidays` (
	`date` text PRIMARY KEY,
	`name` text NOT NULL,
	`kind` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `invitations` (
	`memberId` text PRIMARY KEY,
	`tokenHash` text NOT NULL UNIQUE,
	`expiresAt` text NOT NULL,
	CONSTRAINT `fk_invitations_memberId_members_id_fk` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `leaves` (
	`id` text PRIMARY KEY,
	`memberId` text NOT NULL,
	`type` text NOT NULL,
	`reason` text NOT NULL,
	`startDate` text NOT NULL,
	`startTime` text NOT NULL,
	`endDate` text NOT NULL,
	`endTime` text NOT NULL,
	`createdBy` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	CONSTRAINT `fk_leaves_memberId_members_id_fk` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `members` (
	`id` text PRIMARY KEY,
	`username` text NOT NULL UNIQUE,
	`email` text DEFAULT '' NOT NULL,
	`passwordHash` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`title` text NOT NULL,
	`avatarColor` text NOT NULL,
	`active` integer NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	CONSTRAINT "members_role_check" CHECK("role" IN ('admin','member'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `projects` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`description` text NOT NULL,
	`archived` integer NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `settings` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tasks` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`projectId` text NOT NULL,
	`assigneeId` text NOT NULL,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`adjustedByMember` integer NOT NULL,
	`startDate` text NOT NULL,
	`startTime` text NOT NULL,
	`endDate` text NOT NULL,
	`endTime` text NOT NULL,
	`createdBy` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	CONSTRAINT `fk_tasks_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`),
	CONSTRAINT `fk_tasks_assigneeId_members_id_fk` FOREIGN KEY (`assigneeId`) REFERENCES `members`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `leaves_member_dates` ON `leaves` (`memberId`,`startDate`,`endDate`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tasks_assignee_dates` ON `tasks` (`assigneeId`,`startDate`,`endDate`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tasks_project` ON `tasks` (`projectId`);
