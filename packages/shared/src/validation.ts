import { z } from 'zod';
import { normalizeWorkSlots } from './schedule.js';

export class CalendarInputError extends Error {}

export const text = z.string().trim().min(1);
export const password = z
  .string()
  .min(6, '密码至少需要 6 个字符')
  .refine(s => new TextEncoder().encode(s).length <= 72, '密码最多为 72 字节');
const emailField = z.string().trim().refine(v => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), '请输入有效的邮箱地址');
const role = z.enum(['admin', 'member']);
export const memberCreate = z.object({
  username: text, email: emailField.default(''), password, name: text, role, title: z.string().default(''), avatarColor: text.optional(),
}).strict();
export const invitationCreate = memberCreate.omit({ password: true });
export const invitationTokenBody = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, '邀请链接无效') }).strict();
export const invitationAccept = invitationTokenBody.extend({ password }).strict();
export const profilePatch = z.object({ name: text.max(80) }).strict();
export const roleLabelsSchema = z.object({ admin: text.max(24), member: text.max(24) }).strict()
  .refine(labels => labels.admin !== labels.member, '两种角色的显示名称须不同');

export const memberPatch = memberCreate.omit({ username: true, password: true }).extend({ active: z.boolean() }).partial().strict();
export const loginBody = z.object({ username: text, password }).strict();
export const passwordChangeBody = z.object({ oldPassword: password, newPassword: password }).strict();
export const memberPasswordBody = z.object({ newPassword: password }).strict();
export const forgotPasswordSchema = z.object({
  username: text,
  email: z.string().trim().email('请输入有效的邮箱地址'),
  newPassword: password,
}).strict();
export const projectCreate = z.object({ name: text, color: text.default('#1677ff'), description: z.string().default('') }).strict();
export const projectPatch = projectCreate.extend({ archived: z.boolean() }).partial().strict();

export const calendarDate = z.string().date().refine(d => d >= '2026-01-01', '不支持选择 2026 年之前的日期');
const startTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, '时间格式应为 HH:mm');
const endTime = z.union([startTime, z.literal('24:00')]);
const span = { startDate: calendarDate, startTime, endDate: calendarDate, endTime };
const status = z.enum(['todo', 'in_progress', 'done', 'delayed']);
export const taskCreate = z.object({
  ...span, title: text, description: z.string().default(''), assigneeId: text, projectId: text,
  status: status.default('todo'), priority: z.enum(['high', 'medium', 'low']).default('medium'),
}).strict();
export const taskPatch = taskCreate.partial();
export const adjustment = taskPatch.pick({ startDate: true, startTime: true, endDate: true, endTime: true, status: true, description: true });
export const leaveCreate = z.object({
  ...span, memberId: text.optional(), type: z.enum(['annual', 'sick', 'personal', 'compensatory', 'other']), reason: z.string().default(''),
}).strict();
export const leavePatch = leaveCreate.partial();

export function checkSpan(data: { startDate: string; endDate: string; startTime: string; endTime: string }) {
  if (`${data.startDate} ${data.startTime}` >= `${data.endDate} ${data.endTime}`) {
    throw new CalendarInputError('结束时间必须晚于开始时间');
  }
}

export const datesQuery = z.object({ startDate: calendarDate.optional(), endDate: calendarDate.optional() });
export const taskQuery = datesQuery.extend({ assigneeId: text.optional(), projectId: text.optional(), status: status.optional() });
export const leaveQuery = datesQuery.extend({ memberId: text.optional() });
export const summaryQuery = datesQuery.required().extend({ projectId: text.optional(), memberId: text.optional() });
export function checkDates(data: { startDate?: string; endDate?: string }) {
  if (data.startDate && data.endDate && data.startDate > data.endDate) throw new CalendarInputError('结束日期不得早于开始日期');
}
export function checkSummarySpan(startDate: string, endDate: string) {
  const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1;
  if (days > 366) throw new CalendarInputError('统计日期跨度不得超过 366 天');
}

const slot = z.object({ id: text, label: text, startTime, endTime }).strict();
export const slotSettings = z.object({ slots: z.array(slot).min(1) }).strict();
const year = z.number().int().min(2026, '不支持选择 2026 年之前的年份').max(2100);
export const yearQuery = z.object({ year: z.string().regex(/^\d{4}$/).transform(Number).pipe(year).optional() });
export const holidaySyncBody = z.object({ year: year.optional() }).strict();
export const holidayResetBody = z.object({ year: year.optional() }).strict();
export const resetBody = z.object({ scope: z.enum(['personal', 'schedule', 'factory']) }).strict();
export type ResetScope = z.infer<typeof resetBody>['scope'];
const holiday = z.object({ date: calendarDate, name: text, kind: z.enum(['holiday', 'workday']) }).strict();
export const holidayFields = holiday.omit({ date: true });
export const holidaySettings = z.object({ year: year.optional(), holidays: z.array(holiday) }).strict();

export function validateWorkSlots(input: unknown) {
  const slots = normalizeWorkSlots(slotSettings.parse(input).slots);
  if (new Set(slots.map(slot => slot.id)).size !== slots.length) {
    throw new CalendarInputError('工作时段标识不得重复');
  }
  if (slots.some((slot, index) =>
    slot.startTime >= slot.endTime || (index > 0 && slot.startTime < slots[index - 1].endTime)
  )) {
    throw new CalendarInputError('工作时段必须有正时长且不得重叠');
  }
  return slots;
}

export const localMemberCreate = memberCreate.omit({ username: true, email: true, password: true, role: true });
export const localMemberPatch = localMemberCreate.extend({ active: z.boolean() }).partial();
