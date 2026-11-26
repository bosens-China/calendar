import {
  computeMemberDaySchedule,
  getCalendarDate,
  type HolidayOverride, type Leave, type Member, type MemberDaySchedule, type Task, type WorkSlot,
} from '@calendar/shared';

export interface ScheduleRow {
  member: Member;
  dayMap: Map<string, MemberDaySchedule>;
  expected: number;
  scheduled: number;
  /** Actionable gap from today onward (drives toolbar badge & onlyGap filter) */
  gap: number;
  /** Total unscheduled gap across counted days in the period (drives sidebar bar & tooltip) */
  periodGap: number;
  saturation: number;
}

export function computeScheduleRows(
  members: Member[], dates: string[], tasks: Task[], leaves: Leave[], workSlots: WorkSlot[],
  holidayMap: Map<string, HolidayOverride>, todayStr = getCalendarDate(),
): ScheduleRow[] {
  return members.map(member => {
    const dayMap = new Map<string, MemberDaySchedule>();
    let expected = 0;
    let scheduled = 0;
    let gap = 0;
    let periodGap = 0;
    for (const date of dates) {
      const day = computeMemberDaySchedule({ date, memberId: member.id, tasks, leaves, workSlots, holidayMap });
      dayMap.set(date, day);
      const isPast = date < todayStr;
      const isPastUnfilled = isPast && day.scheduledMinutes === 0 && day.leaveMinutes === 0;
      if (!isPastUnfilled) {
        expected += day.expectedMinutes;
        periodGap += day.gapMinutes;
      }
      scheduled += day.scheduledMinutes;
      if (!isPast) gap += day.gapMinutes;
    }
    return {
      member, dayMap, expected, scheduled, gap, periodGap,
      saturation: expected > 0 ? Math.min(1, scheduled / expected) : 0,
    };
  });
}
