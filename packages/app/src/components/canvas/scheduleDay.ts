import type { Leave, MemberDaySchedule, Project, Task, WorkSlot } from '@calendar/shared';

export interface ScheduleDayActions {
  visibleProjectIds: string[];
  projectMap: Map<string, Project>;
  workSlots: WorkSlot[];
  onTaskClick: (task: Task) => void;
  onLeaveClick: (leave: Leave) => void;
  onSlotClick: (memberId: string, date: string, slot?: WorkSlot) => void;
}

interface MergedDayTask {
  task: Task;
  totalMinutes: number;
  slotLabels: string[];
}

export function mergeDayTasks(day: MemberDaySchedule, projectIds: string[]): MergedDayTask[] {
  const map = new Map<string, MergedDayTask>();
  for (const slotCov of day.slots) {
    for (const seg of slotCov.segments) {
      if (projectIds.length && !projectIds.includes(seg.task.projectId)) continue;
      const prev = map.get(seg.task.id);
      if (prev) {
        prev.totalMinutes += seg.durationMinutes;
        if (!prev.slotLabels.includes(slotCov.slot.label)) {
          prev.slotLabels.push(slotCov.slot.label);
        }
      } else {
        map.set(seg.task.id, {
          task: seg.task,
          totalMinutes: seg.durationMinutes,
          slotLabels: [slotCov.slot.label],
        });
      }
    }
  }
  return Array.from(map.values());
}
