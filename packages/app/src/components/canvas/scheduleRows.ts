import {
  computeMemberDaySchedule,
  type HolidayOverride, type Leave, type Member, type MemberDaySchedule, type Task, type WorkSlot,
} from '@calendar/shared';

export interface ScheduleRow {
  member: Member;
  dayMap: Map<string, MemberDaySchedule>;
  expected: number;
  scheduled: number;
  gap: number;
  saturation: number;
}

export function computeScheduleRows(
  members: Member[], dates: string[], tasks: Task[], leaves: Leave[], workSlots: WorkSlot[],
  holidayMap: Map<string, HolidayOverride>,
): ScheduleRow[] {
  return members.map(member => {
    const dayMap = new Map<string, MemberDaySchedule>();
    let expected = 0;
    let scheduled = 0;
    let gap = 0;
    for (const date of dates) {
      const day = computeMemberDaySchedule({ date, memberId: member.id, tasks, leaves, workSlots, holidayMap });
      dayMap.set(date, day);
      expected += day.expectedMinutes;
      scheduled += day.scheduledMinutes;
      gap += day.gapMinutes;
    }
    return { member, dayMap, expected, scheduled, gap, saturation: expected > 0 ? Math.min(1, scheduled / expected) : 1 };
  });
}
