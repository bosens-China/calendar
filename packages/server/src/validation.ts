import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';

export const text = z.string().trim().min(1);
export const password = z
  .string()
  .min(6, '密码至少需要 6 个字符')
  .refine(s => Buffer.byteLength(s) <= 72, '密码最多为 72 字节');
const emailField = z.string().trim().refine(v => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), '请输入有效的邮箱地址');
const role = z.enum(['admin', 'member']);
export const memberCreate = z.object({
  username: text, email: emailField.default(''), password, name: text, role, title: z.string().default(''), avatarColor: text.optional(),
}).strict();
export const memberPatch = memberCreate.omit({ username: true, password: true }).extend({ active: z.boolean() }).partial().strict();
export const forgotPasswordSchema = z.object({
  username: text,
  email: z.string().trim().email('请输入有效的邮箱地址'),
  newPassword: password,
}).strict();
export const projectCreate = z.object({ name: text, color: text.default('#1677ff'), description: z.string().default('') }).strict();
export const projectPatch = projectCreate.extend({ archived: z.boolean() }).partial().strict();

const date = z.string().date().refine(d => d >= '2026-01-01', '不支持选择 2026 年之前的日期');
const startTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, '时间格式应为 HH:mm');
const endTime = z.union([startTime, z.literal('24:00')]);
const span = { startDate: date, startTime, endDate: date, endTime };
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
    throw new HTTPException(400, { message: '结束时间必须晚于开始时间' });
  }
}

export const datesQuery = z.object({ startDate: date.optional(), endDate: date.optional() });
export const taskQuery = datesQuery.extend({ assigneeId: text.optional(), projectId: text.optional(), status: status.optional() });
export const leaveQuery = datesQuery.extend({ memberId: text.optional() });
export const summaryQuery = datesQuery.required().extend({ projectId: text.optional(), memberId: text.optional() });
export function checkDates(data: { startDate?: string; endDate?: string }) {
  if (data.startDate && data.endDate && data.startDate > data.endDate) throw new HTTPException(400, { message: '结束日期不得早于开始日期' });
}
export function checkSummarySpan(startDate: string, endDate: string) {
  const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1;
  if (days > 366) throw new HTTPException(400, { message: '统计日期跨度不得超过 366 天' });
}

const slot = z.object({ id: text, label: text, startTime, endTime }).strict();
export const slotSettings = z.object({ slots: z.array(slot).min(1) }).strict();
const year = z.number().int().min(2026, '不支持选择 2026 年之前的年份').max(2100);
export const yearQuery = z.object({ year: z.string().regex(/^\d{4}$/).transform(Number).pipe(year).optional() });
export const holidaySyncBody = z.object({ year: year.optional() }).strict();
export const holidayResetBody = z.object({ year: year.optional() }).strict();
const holiday = z.object({ date, name: text, kind: z.enum(['holiday', 'workday']) }).strict();
export const holidaySettings = z.object({ year: year.optional(), holidays: z.array(holiday) }).strict();
