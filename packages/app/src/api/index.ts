import { leavesApi as remoteLeaves } from './leaves';
import { membersApi as remoteMembers } from './members';
import { projectsApi as remoteProjects } from './projects';
import { settingsApi as remoteSettings } from './settings';
import { summaryApi as remoteSummary } from './summary';
import { tasksApi as remoteTasks } from './tasks';
import { localLeaves, localMembers, localProjects, localSettings, localSummary, localTasks } from './local';

export const LOCAL_MODE = import.meta.env.MODE === 'pages';

export const leavesApi: typeof remoteLeaves = LOCAL_MODE ? localLeaves : remoteLeaves;
export const membersApi: typeof remoteMembers = LOCAL_MODE ? localMembers : remoteMembers;
export const projectsApi: typeof remoteProjects = LOCAL_MODE ? localProjects : remoteProjects;
export const settingsApi: typeof remoteSettings = LOCAL_MODE ? localSettings : remoteSettings;
export const summaryApi: typeof remoteSummary = LOCAL_MODE ? localSummary : remoteSummary;
export const tasksApi: typeof remoteTasks = LOCAL_MODE ? localTasks : remoteTasks;
export const getCurrentUserLocal = localMembers.getCurrentUser;

export * from './auth';
export * from './client';
export type { ManagedMemberInput } from './members';
