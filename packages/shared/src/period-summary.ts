import {
  buildHolidayMap, computeMemberDaySchedule, eachDate, minutesToTime, normalizeWorkSlots,
} from './schedule.js';
import type {
  HolidayOverride, Leave, Member, MemberGapDetail, MemberSummary, PeriodSummaryResponse,
  Project, ProjectSummary, Task, TaskStatus, WorkSlot,
} from './types.js';

/**
 * 计算某一周期的团队 / 成员 / 项目汇总统计
 */
export function computePeriodSummary(params: {
  startDate: string;
  endDate: string;
  members: Member[];
  projects: Project[];
  tasks: Task[];
  leaves: Leave[];
  workSlots?: WorkSlot[];
  holidays: HolidayOverride[];
}): PeriodSummaryResponse {
  const { startDate, endDate, members, projects, tasks, leaves, holidays } = params;
  const workSlots = normalizeWorkSlots(params.workSlots);
  const holidayMap = buildHolidayMap(holidays);
  const dates = eachDate(startDate, endDate);
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  let totalExpectedMinutes = 0;
  let totalScheduledMinutes = 0;
  let totalGapMinutes = 0;
  let membersWithGap = 0;

  // 按项目累计
  const projectAccum = new Map<
    string,
    {
      totalMinutes: number;
      taskIds: Set<string>;
      tasks: Task[];
      byMember: Map<string, { memberId: string; memberName: string; minutes: number; taskIds: Set<string>; tasks: Task[] }>;
    }
  >();

  for (const p of projects) {
    projectAccum.set(p.id, {
      totalMinutes: 0,
      taskIds: new Set(),
      tasks: [],
      byMember: new Map(),
    });
  }

  const memberSummaries: MemberSummary[] = members.map((member) => {
    let expectedMinutes = 0;
    let scheduledMinutes = 0;
    let gapMinutes = 0;
    let leaveMinutes = 0;
    let emptyDays = 0;
    let partialDays = 0;
    const gapDetails: MemberGapDetail[] = [];

    const memberTaskMap = new Map<string, Task>();
    const memberProjectAccum = new Map<
      string,
      { minutes: number; taskIds: Set<string>; tasks: Task[] }
    >();

    for (const date of dates) {
      const day = computeMemberDaySchedule({
        date,
        memberId: member.id,
        tasks,
        leaves,
        workSlots,
        holidayMap,
      });

      expectedMinutes += day.expectedMinutes;
      scheduledMinutes += day.scheduledMinutes;
      gapMinutes += day.gapMinutes;
      leaveMinutes += day.leaveMinutes;
      if (day.fillStatus === 'empty') emptyDays += 1;
      if (day.fillStatus === 'partial') partialDays += 1;
      if (day.fillStatus === 'empty' && day.leaveMinutes === 0) {
        const firstSlot = workSlots[0];
        const lastSlot = workSlots[workSlots.length - 1];
        gapDetails.push({
          date,
          slotLabel: '全天',
          startTime: firstSlot?.startTime ?? '09:00',
          endTime: lastSlot?.endTime ?? '18:00',
          minutes: day.gapMinutes,
          isFullDay: true,
        });
      } else if (day.gapMinutes > 0) {
        for (const slotCov of day.slots) {
          for (const iv of slotCov.gapIntervals) {
            gapDetails.push({
              date,
              slotLabel: slotCov.slot.label,
              startTime: minutesToTime(iv.start),
              endTime: minutesToTime(iv.end),
              minutes: iv.end - iv.start,
              isFullDay: false,
            });
          }
        }
      }

      for (const slotCov of day.slots) {
        for (const seg of slotCov.segments) {
          const t = seg.task;
          memberTaskMap.set(t.id, t);

          // 成员内按项目累计
          let mp = memberProjectAccum.get(t.projectId);
          if (!mp) {
            mp = { minutes: 0, taskIds: new Set(), tasks: [] };
            memberProjectAccum.set(t.projectId, mp);
          }
          mp.minutes += seg.durationMinutes;
          if (!mp.taskIds.has(t.id)) {
            mp.taskIds.add(t.id);
            mp.tasks.push(t);
          }

          // 全局按项目累计
          let pa = projectAccum.get(t.projectId);
          if (!pa) {
            pa = { totalMinutes: 0, taskIds: new Set(), tasks: [], byMember: new Map() };
            projectAccum.set(t.projectId, pa);
          }
          pa.totalMinutes += seg.durationMinutes;
          if (!pa.taskIds.has(t.id)) {
            pa.taskIds.add(t.id);
            pa.tasks.push(t);
          }
          let pm = pa.byMember.get(member.id);
          if (!pm) {
            pm = {
              memberId: member.id,
              memberName: member.name,
              minutes: 0,
              taskIds: new Set(),
              tasks: [],
            };
            pa.byMember.set(member.id, pm);
          }
          pm.minutes += seg.durationMinutes;
          if (!pm.taskIds.has(t.id)) {
            pm.taskIds.add(t.id);
            pm.tasks.push(t);
          }
        }
      }
    }

    totalExpectedMinutes += expectedMinutes;
    totalScheduledMinutes += scheduledMinutes;
    totalGapMinutes += gapMinutes;
    if (gapMinutes > 0) membersWithGap += 1;

    const memberTasks = Array.from(memberTaskMap.values());
    const statusCounts: Record<TaskStatus, number> = {
      todo: 0,
      in_progress: 0,
      done: 0,
      delayed: 0,
    };
    for (const t of memberTasks) {
      statusCounts[t.status] += 1;
    }

    const byProject = Array.from(memberProjectAccum.entries())
      .map(([projectId, data]) => {
        const proj = projectMap.get(projectId);
        return {
          projectId,
          projectName: proj?.name ?? '未知项目',
          projectColor: proj?.color ?? '#1677ff',
          minutes: data.minutes,
          tasks: data.tasks,
        };
      })
      .sort((a, b) => b.minutes - a.minutes);

    return {
      member,
      expectedMinutes,
      scheduledMinutes,
      gapMinutes,
      leaveMinutes,
      saturation: expectedMinutes > 0 ? Math.min(1, scheduledMinutes / expectedMinutes) : 1,
      emptyDays,
      partialDays,
      gapDetails,
      taskCount: memberTasks.length,
      statusCounts,
      byProject,
      tasks: memberTasks,
    };
  });

  const projectSummaries: ProjectSummary[] = projects
    .map((project) => {
      const pa = projectAccum.get(project.id);
      const pTasks = pa?.tasks ?? [];
      const statusCounts: Record<TaskStatus, number> = {
        todo: 0,
        in_progress: 0,
        done: 0,
        delayed: 0,
      };
      for (const t of pTasks) {
        statusCounts[t.status] += 1;
      }
      const byMember = pa
        ? Array.from(pa.byMember.values())
            .map((m) => ({
              memberId: m.memberId,
              memberName: m.memberName,
              minutes: m.minutes,
              tasks: m.tasks,
            }))
            .sort((a, b) => b.minutes - a.minutes)
        : [];

      return {
        project,
        totalMinutes: pa?.totalMinutes ?? 0,
        taskCount: pTasks.length,
        statusCounts,
        memberCount: byMember.length,
        byMember,
      };
    })
    .filter((ps) => ps.taskCount > 0 || !ps.project.archived)
    .sort((a, b) => b.totalMinutes - a.totalMinutes);

  return {
    startDate,
    endDate,
    totalExpectedMinutes,
    totalScheduledMinutes,
    totalGapMinutes,
    membersWithGap,
    members: memberSummaries,
    projects: projectSummaries,
  };
}
