import {
  eachDate,
  formatHours,
  getDaySpanInterval,
  intersectInterval,
  isWorkday,
  normalizeWorkSlots,
  sumIntervalMinutes,
  timeToMinutes,
  type HolidayOverride,
  type LeaveType,
  type TaskPriority,
  type TaskStatus,
  type TimeInterval,
  type WorkSlot,
} from '@calendar/shared';

export interface TaskTimeRange {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

/**
 * 计算某个任务在其时间跨度内的实际有效工作工时（跳过非工作时段、午休、周末、法定节假日）
 */
export function calculateTaskEffectiveMinutes(
  range: TaskTimeRange,
  workSlots: WorkSlot[],
  holidayMap: Map<string, HolidayOverride>,
): number {
  const { startDate, startTime, endDate, endTime } = range;
  if (!startDate || !endDate || !startTime || !endTime) return 0;
  if (startDate > endDate || (startDate === endDate && startTime >= endTime)) return 0;

  const dates = eachDate(startDate, endDate);
  const slots = normalizeWorkSlots(workSlots);
  let totalMinutes = 0;

  for (const date of dates) {
    if (!isWorkday(date, holidayMap)) {
      continue;
    }
    const dayInterval = getDaySpanInterval(date, startDate, startTime, endDate, endTime);
    if (!dayInterval) continue;

    for (const slot of slots) {
      const slotInterval: TimeInterval = {
        start: timeToMinutes(slot.startTime),
        end: timeToMinutes(slot.endTime),
      };
      const inter = intersectInterval(dayInterval, slotInterval);
      if (inter) {
        totalMinutes += sumIntervalMinutes([inter]);
      }
    }
  }

  return totalMinutes;
}

export function formatEffectiveHours(minutes: number): string {
  return formatHours(minutes);
}

export const TASK_STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  todo: {
    label: '待开始',
    color: '#475569',
    bg: '#f1f5f9',
    border: '#cbd5e1',
  },
  in_progress: {
    label: '进行中',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  done: {
    label: '已完成',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
  },
  delayed: {
    label: '已延期',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
  },
};

export const TASK_PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; color: string; bg: string }
> = {
  high: { label: '高', color: '#dc2626', bg: '#fee2e2' },
  medium: { label: '中', color: '#d97706', bg: '#fef3c7' },
  low: { label: '低', color: '#64748b', bg: '#f1f5f9' },
};

export const LEAVE_TYPE_CONFIG: Record<
  LeaveType,
  { label: string; color: string; bg: string; border: string }
> = {
  annual: {
    label: '年假',
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd',
  },
  sick: {
    label: '病假',
    color: '#e11d48',
    bg: '#fff1f2',
    border: '#fecdd3',
  },
  personal: {
    label: '事假',
    color: '#ea580c',
    bg: '#fff7ed',
    border: '#ffedd5',
  },
  compensatory: {
    label: '调休',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
  },
  other: {
    label: '其他',
    color: '#475569',
    bg: '#f8fafc',
    border: '#e2e8f0',
  },
};

export function getSaturationColor(saturation: number): string {
  if (saturation >= 1) return '#16a34a'; // green
  if (saturation >= 0.7) return '#0284c7'; // blue
  if (saturation > 0) return '#f59e0b'; // orange
  return '#ef4444'; // red
}

export const PROJECT_PALETTE = [
  '#2563eb', // blue
  '#16a34a', // green
  '#d97706', // amber
  '#dc2626', // red
  '#9333ea', // purple
  '#0891b2', // cyan
  '#ea580c', // orange
  '#ec4899', // pink
  '#4f46e5', // indigo
  '#059669', // emerald
];

export const AVATAR_PALETTE = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#16a34a',
  '#0891b2',
  '#4f46e5',
  '#d97706',
];

export function calculateSlotMinutes(slot: WorkSlot): number {
  return Math.max(0, timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime));
}

