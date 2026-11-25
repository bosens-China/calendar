import {
  DEFAULT_WORK_SLOTS,
  type DayFillStatus,
  type DaySlotCoverage,
  type DayTaskSegment,
  type HolidayOverride,
  type Leave,
  type MemberDaySchedule,
  type Task,
  type TimeInterval,
  type WorkSlot,
} from './types.js';

export function timeToMinutes(time: string): number {
  const [hStr, mStr] = time.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${Number(hours.toFixed(1))}h`;
}

export function parseDateUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function eachDate(startDate: string, endDate: string): string[] {
  const result: string[] = [];
  const start = parseDateUTC(startDate);
  const end = parseDateUTC(endDate);
  if (start > end) return result;
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    result.push(formatDateUTC(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

export function buildHolidayMap(holidays: HolidayOverride[]): Map<string, HolidayOverride> {
  const map = new Map<string, HolidayOverride>();
  for (const h of holidays) {
    map.set(h.date, h);
  }
  return map;
}

export function isWorkday(dateStr: string, holidayMap: Map<string, HolidayOverride>): boolean {
  const override = holidayMap.get(dateStr);
  if (override) {
    return override.kind === 'workday';
  }
  const day = parseDateUTC(dateStr).getUTCDay();
  return day !== 0 && day !== 6;
}

export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  const valid = intervals
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (valid.length === 0) return [];
  const merged: TimeInterval[] = [{ ...valid[0] }];
  for (let i = 1; i < valid.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = valid[i];
    if (curr.start <= prev.end) {
      prev.end = Math.max(prev.end, curr.end);
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

export function intersectInterval(a: TimeInterval, b: TimeInterval): TimeInterval | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return end > start ? { start, end } : null;
}

export function subtractIntervals(
  base: TimeInterval[],
  subtracts: TimeInterval[],
): TimeInterval[] {
  const mergedSub = mergeIntervals(subtracts);
  let current = mergeIntervals(base);
  for (const sub of mergedSub) {
    const next: TimeInterval[] = [];
    for (const seg of current) {
      if (sub.end <= seg.start || sub.start >= seg.end) {
        next.push(seg);
      } else {
        if (sub.start > seg.start) {
          next.push({ start: seg.start, end: sub.start });
        }
        if (sub.end < seg.end) {
          next.push({ start: sub.end, end: seg.end });
        }
      }
    }
    current = next;
  }
  return current;
}

export function sumIntervalMinutes(intervals: TimeInterval[]): number {
  return intervals.reduce((acc, i) => acc + Math.max(0, i.end - i.start), 0);
}

/**
 * 计算某个跨天区间 (startDate/startTime ~ endDate/endTime) 落在指定 dateStr 当天的分钟区间
 */
export function getDaySpanInterval(
  dateStr: string,
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
): TimeInterval | null {
  if (dateStr < startDate || dateStr > endDate) return null;
  const start = dateStr === startDate ? timeToMinutes(startTime) : 0;
  const end = dateStr === endDate ? timeToMinutes(endTime) : 24 * 60;
  return end > start ? { start, end } : null;
}

export function detectOverlap(intervals: TimeInterval[]): boolean {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) return true;
  }
  return false;
}

export function normalizeWorkSlots(slots?: WorkSlot[]): WorkSlot[] {
  const list = slots && slots.length > 0 ? slots : DEFAULT_WORK_SLOTS;
  return [...list].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

/**
 * 计算指定成员在某一天的详细排期、跳过非工作时间后的有效任务段、空档与饱和度
 */
export function computeMemberDaySchedule(params: {
  date: string;
  memberId: string;
  tasks: Task[];
  leaves: Leave[];
  workSlots?: WorkSlot[];
  holidayMap: Map<string, HolidayOverride>;
}): MemberDaySchedule {
  const { date, memberId, tasks, leaves, holidayMap } = params;
  const workSlots = normalizeWorkSlots(params.workSlots);
  const holiday = holidayMap.get(date);
  const workday = isWorkday(date, holidayMap);

  const memberDayLeaves = leaves.filter(
    (l) => l.memberId === memberId && date >= l.startDate && date <= l.endDate,
  );
  const leaveIntervals: TimeInterval[] = [];
  for (const lv of memberDayLeaves) {
    const span = getDaySpanInterval(date, lv.startDate, lv.startTime, lv.endDate, lv.endTime);
    if (span) leaveIntervals.push(span);
  }
  const mergedLeaveIntervals = mergeIntervals(leaveIntervals);

  const memberTasks = tasks.filter(
    (t) => t.assigneeId === memberId && date >= t.startDate && date <= t.endDate,
  );

  if (!workday) {
    const emptySlots: DaySlotCoverage[] = workSlots.map((slot) => ({
      slot,
      availableMinutes: 0,
      leaveMinutes: 0,
      scheduledMinutes: 0,
      gapMinutes: 0,
      gapIntervals: [],
      segments: [],
      hasConflict: false,
    }));
    return {
      date,
      memberId,
      isWorkday: false,
      holiday,
      totalWorkMinutes: 0,
      leaveMinutes: 0,
      expectedMinutes: 0,
      scheduledMinutes: 0,
      gapMinutes: 0,
      saturation: 0,
      fillStatus: 'non_workday',
      hasConflict: false,
      slots: emptySlots,
      leaves: memberDayLeaves,
    };
  }

  let totalWorkMinutes = 0;
  let totalLeaveMinutes = 0;
  let totalExpectedMinutes = 0;
  let totalScheduledMinutes = 0;
  let totalGapMinutes = 0;
  let anyConflict = false;

  const slotCoverages: DaySlotCoverage[] = workSlots.map((slot) => {
    const slotInterval: TimeInterval = {
      start: timeToMinutes(slot.startTime),
      end: timeToMinutes(slot.endTime),
    };
    const slotMinutes = Math.max(0, slotInterval.end - slotInterval.start);
    totalWorkMinutes += slotMinutes;

    // 落在当前工作时段内的请假区间
    const slotLeaveIntervals: TimeInterval[] = [];
    for (const li of mergedLeaveIntervals) {
      const inter = intersectInterval(slotInterval, li);
      if (inter) slotLeaveIntervals.push(inter);
    }
    const leaveMinutes = sumIntervalMinutes(mergeIntervals(slotLeaveIntervals));
    const expectedIntervals = subtractIntervals([slotInterval], slotLeaveIntervals);
    const availableMinutes = sumIntervalMinutes(expectedIntervals);

    // 落在当前工作时段内的任务段（剔除请假时段，避免请假重叠算工时）
    const segments: DayTaskSegment[] = [];
    const rawTaskIntervalsInSlot: TimeInterval[] = [];

    for (const task of memberTasks) {
      const span = getDaySpanInterval(
        date,
        task.startDate,
        task.startTime,
        task.endDate,
        task.endTime,
      );
      if (!span) continue;
      const inSlot = intersectInterval(slotInterval, span);
      if (!inSlot) continue;
      const effectiveParts = subtractIntervals([inSlot], slotLeaveIntervals);
      for (const part of effectiveParts) {
        rawTaskIntervalsInSlot.push(part);
        segments.push({
          task,
          slotId: slot.id,
          start: part.start,
          end: part.end,
          durationMinutes: part.end - part.start,
        });
      }
    }

    const hasConflict = detectOverlap(rawTaskIntervalsInSlot);
    if (hasConflict) anyConflict = true;

    const mergedScheduled = mergeIntervals(rawTaskIntervalsInSlot);
    const scheduledMinutes = sumIntervalMinutes(mergedScheduled);
    const gapIntervals = subtractIntervals(expectedIntervals, mergedScheduled);
    const gapMinutes = sumIntervalMinutes(gapIntervals);

    totalLeaveMinutes += leaveMinutes;
    totalExpectedMinutes += availableMinutes;
    totalScheduledMinutes += scheduledMinutes;
    totalGapMinutes += gapMinutes;

    return {
      slot,
      availableMinutes,
      leaveMinutes,
      scheduledMinutes,
      gapMinutes,
      gapIntervals,
      segments,
      hasConflict,
    };
  });

  let fillStatus: DayFillStatus;
  if (totalExpectedMinutes === 0) {
    fillStatus = 'on_leave';
  } else if (totalScheduledMinutes === 0) {
    fillStatus = 'empty';
  } else if (totalGapMinutes > 0) {
    fillStatus = 'partial';
  } else {
    fillStatus = 'full';
  }

  const saturation =
    totalExpectedMinutes > 0 ? Math.min(1, totalScheduledMinutes / totalExpectedMinutes) : 1;

  return {
    date,
    memberId,
    isWorkday: true,
    holiday,
    totalWorkMinutes,
    leaveMinutes: totalLeaveMinutes,
    expectedMinutes: totalExpectedMinutes,
    scheduledMinutes: totalScheduledMinutes,
    gapMinutes: totalGapMinutes,
    saturation,
    fillStatus,
    hasConflict: anyConflict,
    slots: slotCoverages,
    leaves: memberDayLeaves,
  };
}
