import {
  calendarDate, checkDates, checkSpan, checkSummarySpan, computePeriodSummary, DEFAULT_CN_HOLIDAYS,
  fetchYearHolidaysFromGithub, getCalendarYear, holidayFields, holidayResetBody, holidaySyncBody,
  leaveCreate, leavePatch, leaveQuery, localMemberCreate, localMemberPatch, projectCreate,
  projectPatch, resetBody, summaryQuery, taskCreate, taskPatch, taskQuery, validateWorkSlots,
  type CreateLeaveRequest, type CreateProjectRequest, type CreateTaskRequest, type HolidayOverride,
  type Leave, type Member, type Project, type ResetScope, type Task, type UpdateLeaveRequest, type UpdateMemberRequest,
  type UpdateProjectRequest, type UpdateTaskRequest, type WorkSlot,
} from '@calendar/shared';
import type { ManagedMemberInput } from '../members';
import type { LeaveQueryParams } from '../leaves';
import type { SummaryQueryParams } from '../summary';
import type { TaskQueryParams } from '../tasks';
import { LOCAL_ADMIN_ID, readLocal, resetLocalWorkspace, writeLocal } from './store';

type Entity = Pick<Member, 'id' | 'updatedAt'>;

function find<T extends Entity>(rows: T[], id: string): T {
  const row = rows.find(item => item.id === id);
  if (!row) throw new Error('记录不存在');
  return row;
}

function create<T extends object>(fields: T) {
  const now = new Date().toISOString();
  return { ...fields, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
}

function update<T extends Entity>(rows: T[], id: string, fields: Partial<T>) {
  const row = find(rows, id);
  Object.assign(row, fields, { updatedAt: new Date().toISOString() });
  return row;
}

function remove<T extends Entity>(rows: T[], id: string): T[] {
  find(rows, id);
  return rows.filter(row => row.id !== id);
}

function overlaps(row: Task | Leave, query: { startDate?: string; endDate?: string }) {
  return (!query.startDate || row.endDate >= query.startDate) &&
    (!query.endDate || row.startDate <= query.endDate);
}

export const localMembers = {
  getMembers: () => readLocal(state => state.members),
  getCurrentUser: () => readLocal(state => find(state.members, LOCAL_ADMIN_ID)),
  createMember: (input: ManagedMemberInput) => writeLocal(state => {
    const { name, title, avatarColor } = localMemberCreate.parse({
      name: input.name, title: input.title, avatarColor: input.avatarColor,
    });
    const used = new Set(state.members.map(member => member.avatarColor.toLowerCase()));
    let color = avatarColor ?? '#2563eb';
    while (used.has(color.toLowerCase())) color = '#' + crypto.randomUUID().slice(0, 6);
    const member: Member = create({
      name, title, avatarColor: color, username: '', email: '', role: 'member', active: true,
    });
    state.members.push(member);
    return member;
  }),
  updateMember: (id: string, input: UpdateMemberRequest) => writeLocal(state => {
    const fields = localMemberPatch.parse({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.avatarColor !== undefined && { avatarColor: input.avatarColor }),
      ...(input.active !== undefined && { active: input.active }),
    });
    if (id === LOCAL_ADMIN_ID && fields.active === false) throw new Error('不能停用本机管理员');
    return update<Member>(state.members, id, fields);
  }),
  resetPassword: async () => { throw new Error('本机工作台无需登录'); },
  deleteMember: (id: string) => writeLocal(state => {
    if (id === LOCAL_ADMIN_ID) throw new Error('不能删除本机管理员');
    state.members = remove(state.members, id);
    state.tasks = state.tasks.filter(task => task.assigneeId !== id);
    state.leaves = state.leaves.filter(leave => leave.memberId !== id);
  }),
};

export const localProjects = {
  getProjects: () => readLocal(state => state.projects),
  createProject: (input: CreateProjectRequest) => writeLocal(state => {
    const project: Project = create({ ...projectCreate.parse(input), archived: false });
    state.projects.push(project);
    return project;
  }),
  updateProject: (id: string, input: UpdateProjectRequest) => writeLocal(state =>
    update<Project>(state.projects, id, projectPatch.parse(input))),
  deleteProject: (id: string) => writeLocal(state => {
    if (state.tasks.some(task => task.projectId === id)) throw new Error('项目有关联任务，请先归档项目或转移任务');
    state.projects = remove(state.projects, id);
  }),
};

export const localTasks = {
  getTasks: (input?: TaskQueryParams) => readLocal(state => {
    const q = taskQuery.parse(input ?? {});
    checkDates(q);
    return state.tasks.filter(task => overlaps(task, q) &&
      (!q.assigneeId || task.assigneeId === q.assigneeId) &&
      (!q.projectId || task.projectId === q.projectId) &&
      (!q.status || task.status === q.status));
  }),
  createTask: (input: CreateTaskRequest) => writeLocal(state => {
    const fields = taskCreate.parse(input);
    checkSpan(fields);
    find(state.members, fields.assigneeId);
    find(state.projects, fields.projectId);
    const task: Task = create({ ...fields, createdBy: LOCAL_ADMIN_ID, adjustedByMember: false });
    state.tasks.push(task);
    return task;
  }),
  updateTask: (id: string, input: UpdateTaskRequest) => writeLocal(state => {
    const fields = taskPatch.parse(input);
    checkSpan({ ...find(state.tasks, id), ...fields });
    if (fields.assigneeId) find(state.members, fields.assigneeId);
    if (fields.projectId) find(state.projects, fields.projectId);
    return update<Task>(state.tasks, id, fields);
  }),
  deleteTask: (id: string) => writeLocal(state => { state.tasks = remove(state.tasks, id); }),
};

export const localLeaves = {
  getLeaves: (input?: LeaveQueryParams) => readLocal(state => {
    const q = leaveQuery.parse(input ?? {});
    checkDates(q);
    return state.leaves.filter(leave => overlaps(leave, q) && (!q.memberId || leave.memberId === q.memberId));
  }),
  createLeave: (input: CreateLeaveRequest) => writeLocal(state => {
    const fields = leaveCreate.parse(input);
    checkSpan(fields);
    const memberId = fields.memberId ?? LOCAL_ADMIN_ID;
    find(state.members, memberId);
    const leave: Leave = create({ ...fields, memberId, createdBy: LOCAL_ADMIN_ID });
    state.leaves.push(leave);
    return leave;
  }),
  updateLeave: (id: string, input: UpdateLeaveRequest) => writeLocal(state => {
    const fields = leavePatch.parse(input);
    checkSpan({ ...find(state.leaves, id), ...fields });
    if (fields.memberId) find(state.members, fields.memberId);
    return update<Leave>(state.leaves, id, fields);
  }),
  deleteLeave: (id: string) => writeLocal(state => { state.leaves = remove(state.leaves, id); }),
};

function datesInYear(holidays: HolidayOverride[], year?: number) {
  return year === undefined ? holidays : holidays.filter(holiday => holiday.date.startsWith(`${year}-`));
}

function replaceYear(year: number | undefined, holidays: HolidayOverride[]) {
  return writeLocal(state => {
    const otherYears = year === undefined ? [] : state.holidays.filter(holiday => !holiday.date.startsWith(`${year}-`));
    state.holidays = [...otherYears, ...holidays].sort((a, b) => a.date.localeCompare(b.date));
    return holidays;
  });
}

export const localSettings = {
  getWorkSlots: () => readLocal(state => state.workSlots),
  updateWorkSlots: (slots: WorkSlot[]) => writeLocal(state => {
    state.workSlots = validateWorkSlots({ slots });
    return state.workSlots;
  }),
  getHolidays: (year?: number) => readLocal(state => datesInYear(state.holidays, year)),
  saveHoliday: (holiday: HolidayOverride) => writeLocal(state => {
    const { date: inputDate, ...inputFields } = holiday;
    const date = calendarDate.parse(inputDate);
    const value = { date, ...holidayFields.parse(inputFields) };
    state.holidays = [...state.holidays.filter(day => day.date !== date), value].sort((a, b) => a.date.localeCompare(b.date));
    return value;
  }),
  deleteHoliday: (date: string) => writeLocal(state => {
    const key = calendarDate.parse(date);
    state.holidays = state.holidays.filter(holiday => holiday.date !== key);
  }),
  syncHolidays: async (year?: number) => {
    const targetYear = holidaySyncBody.parse({ year }).year ?? getCalendarYear();
    try {
      const imported = await fetchYearHolidaysFromGithub(targetYear);
      return { year: targetYear, holidays: await replaceYear(targetYear, imported), source: 'github' as const, updated: true };
    } catch {
      throw new Error(`无法同步 ${targetYear} 年节假日，请稍后重试`);
    }
  },
  resetHolidays: (year?: number) => {
    const targetYear = holidayResetBody.parse({ year }).year;
    return replaceYear(targetYear, datesInYear(DEFAULT_CN_HOLIDAYS, targetYear));
  },
  resetWorkspace: async (scope: ResetScope) => {
    const parsed = resetBody.parse({ scope }).scope;
    if (parsed === 'factory') {
      await resetLocalWorkspace();
      return { scope: parsed };
    }
    if (parsed === 'personal') {
      await writeLocal(state => {
        state.leaves = state.leaves.filter(
          leave => !(leave.memberId === LOCAL_ADMIN_ID && leave.createdBy === LOCAL_ADMIN_ID),
        );
      });
      return { scope: parsed };
    }
    await writeLocal(state => {
      state.tasks = [];
      state.leaves = [];
    });
    return { scope: parsed };
  },
};

export const localSummary = {
  getSummary: (input: SummaryQueryParams) => readLocal(state => {
    const q = summaryQuery.parse(input);
    checkDates(q);
    checkSummarySpan(q.startDate, q.endDate);
    return computePeriodSummary({
      ...q,
      members: state.members.filter(member => !q.memberId || member.id === q.memberId),
      projects: state.projects.filter(project => !q.projectId || project.id === q.projectId),
      tasks: state.tasks.filter(task => overlaps(task, q) && (!q.projectId || task.projectId === q.projectId)),
      leaves: state.leaves.filter(leave => overlaps(leave, q)),
      workSlots: state.workSlots,
      holidays: state.holidays,
    });
  }),
};
