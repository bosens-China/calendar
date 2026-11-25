export type UserRole = 'admin' | 'member';

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'delayed';

export type TaskPriority = 'high' | 'medium' | 'low';

export type LeaveType = 'annual' | 'sick' | 'personal' | 'compensatory' | 'other';

export type HolidayKind = 'holiday' | 'workday';

export interface Member {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  title: string;
  avatarColor: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  description: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  assigneeId: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** HH:mm */
  startTime: string;
  /** YYYY-MM-DD */
  endDate: string;
  /** HH:mm */
  endTime: string;
  status: TaskStatus;
  priority: TaskPriority;
  adjustedByMember: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Leave {
  id: string;
  memberId: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** HH:mm */
  startTime: string;
  /** YYYY-MM-DD */
  endDate: string;
  /** HH:mm */
  endTime: string;
  type: LeaveType;
  reason: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkSlot {
  id: string;
  label: string;
  /** HH:mm */
  startTime: string;
  /** HH:mm */
  endTime: string;
}

export interface HolidayOverride {
  /** YYYY-MM-DD */
  date: string;
  name: string;
  kind: HolidayKind;
}

/** Auth DTOs */
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: Member;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  username: string;
  email: string;
  newPassword: string;
}

/** Member DTOs */
export interface CreateMemberRequest {
  username: string;
  email?: string;
  password: string;
  name: string;
  role: UserRole;
  title?: string;
  avatarColor?: string;
}

export interface UpdateMemberRequest {
  email?: string;
  name?: string;
  role?: UserRole;
  title?: string;
  avatarColor?: string;
  active?: boolean;
}

export interface ResetPasswordRequest {
  newPassword: string;
}

/** Project DTOs */
export interface CreateProjectRequest {
  name: string;
  color?: string;
  description?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  color?: string;
  description?: string;
  archived?: boolean;
}

/** Task DTOs */
export interface CreateTaskRequest {
  title: string;
  description?: string;
  projectId: string;
  assigneeId: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  status?: TaskStatus;
  priority?: TaskPriority;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  projectId?: string;
  assigneeId?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
}

/** Leave DTOs */
export interface CreateLeaveRequest {
  memberId?: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  type: LeaveType;
  reason?: string;
}

export interface UpdateLeaveRequest {
  memberId?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  type?: LeaveType;
  reason?: string;
}

/** Schedule Calculation Types */
export interface TimeInterval {
  /** minutes from 00:00 */
  start: number;
  /** minutes from 00:00 */
  end: number;
}

export interface DayTaskSegment {
  task: Task;
  slotId: string;
  start: number;
  end: number;
  durationMinutes: number;
}

export interface DaySlotCoverage {
  slot: WorkSlot;
  availableMinutes: number;
  leaveMinutes: number;
  scheduledMinutes: number;
  gapMinutes: number;
  gapIntervals: TimeInterval[];
  segments: DayTaskSegment[];
  hasConflict: boolean;
}

export type DayFillStatus = 'non_workday' | 'on_leave' | 'empty' | 'partial' | 'full';

export interface MemberDaySchedule {
  date: string;
  memberId: string;
  isWorkday: boolean;
  holiday?: HolidayOverride;
  totalWorkMinutes: number;
  leaveMinutes: number;
  expectedMinutes: number;
  scheduledMinutes: number;
  gapMinutes: number;
  saturation: number; // 0 ~ 1
  fillStatus: DayFillStatus;
  hasConflict: boolean;
  slots: DaySlotCoverage[];
  leaves: Leave[];
}

export interface MemberGapDetail {
  date: string;
  slotLabel: string;
  startTime: string;
  endTime: string;
  minutes: number;
  isFullDay: boolean;
}

export interface MemberSummary {
  member: Member;
  expectedMinutes: number;
  scheduledMinutes: number;
  gapMinutes: number;
  leaveMinutes: number;
  saturation: number;
  emptyDays: number;
  partialDays: number;
  gapDetails: MemberGapDetail[];
  taskCount: number;
  statusCounts: Record<TaskStatus, number>;
  byProject: Array<{
    projectId: string;
    projectName: string;
    projectColor: string;
    minutes: number;
    tasks: Task[];
  }>;
  tasks: Task[];
}

export interface ProjectSummary {
  project: Project;
  totalMinutes: number;
  taskCount: number;
  statusCounts: Record<TaskStatus, number>;
  memberCount: number;
  byMember: Array<{
    memberId: string;
    memberName: string;
    minutes: number;
    tasks: Task[];
  }>;
}

export interface PeriodSummaryResponse {
  startDate: string;
  endDate: string;
  totalExpectedMinutes: number;
  totalScheduledMinutes: number;
  totalGapMinutes: number;
  membersWithGap: number;
  members: MemberSummary[];
  projects: ProjectSummary[];
}

export const DEFAULT_WORK_SLOTS: WorkSlot[] = [
  { id: 'morning', label: '上午', startTime: '09:00', endTime: '12:00' },
  { id: 'afternoon', label: '下午', startTime: '13:30', endTime: '18:00' },
];
