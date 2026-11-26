import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getCalendarDate, type Leave, type Task, type WorkSlot } from '@calendar/shared';
import { leavesApi, LOCAL_MODE, membersApi, projectsApi, settingsApi, tasksApi } from '../api';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';
import {
  clampDateMin,
  getMonthDateRange,
  getMonthDates,
  getWeekDateRange,
  getWeekDates,
} from '../utils/date';
import { ScheduleCanvas } from '../components/canvas/ScheduleCanvas';
import { WorkbenchToolbar } from '../components/canvas/WorkbenchToolbar';
import {
  ScheduleCreateModal,
  type ScheduleEntryMode,
} from '../components/canvas/ScheduleCreateModal';
import {
  MembersModal,
  ProjectsModal,
  SettingsDrawer,
} from '../components/canvas/WorkbenchOverlays';
import { ReviewModal } from '../components/review/ReviewModal';
import { ChangePasswordModal } from '../components/layout/ChangePasswordModal';
import { Spinner } from '../components/ui/primitives';
import { QueryError } from '../components/ui/QueryError';
import { useHolidayRules } from '../hooks/useHolidayRules';
import { computeScheduleRows } from '../components/canvas/scheduleRows';
export const CalendarView: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const { calendarPeriod, currentDate, selectedProjectIds: projectFilter, selectedMemberIds: memberFilter, onlyGap } = useUiStore();

  const [entryOpen, setEntryOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<ScheduleEntryMode>('task');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingLeave, setEditingLeave] = useState<Leave | null>(null);
  const [initialTaskValues, setInitialTaskValues] = useState<Partial<Task> | undefined>(undefined);
  const [initialLeaveMemberId, setInitialLeaveMemberId] = useState<string | undefined>(undefined);
  const [initialDate, setInitialDate] = useState<string | undefined>(undefined);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const { startDate, endDate, dates } = useMemo(() => {
    if (calendarPeriod === 'week') {
      const range = getWeekDateRange(currentDate);
      return {
        startDate: clampDateMin(range.startDate),
        endDate: clampDateMin(range.endDate),
        dates: getWeekDates(currentDate).filter((d) => d >= '2026-01-01'),
      };
    }
    const range = getMonthDateRange(currentDate);
    return {
      startDate: clampDateMin(range.startDate),
      endDate: clampDateMin(range.endDate),
      dates: getMonthDates(currentDate).filter((d) => d >= '2026-01-01'),
    };
  }, [calendarPeriod, currentDate]);

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: ({ signal }) => projectsApi.getProjects(signal),
  });
  const membersQuery = useQuery({
    queryKey: ['members'],
    queryFn: ({ signal }) => membersApi.getMembers(signal),
  });
  const slotsQuery = useQuery({
    queryKey: ['settings', 'workSlots'],
    queryFn: ({ signal }) => settingsApi.getWorkSlots(signal),
  });
  const holidayRules = useHolidayRules(startDate, endDate);
  const tasksQuery = useQuery({
    queryKey: ['tasks', startDate, endDate],
    queryFn: ({ signal }) => tasksApi.getTasks({ startDate, endDate }, signal),
  });
  const leavesQuery = useQuery({
    queryKey: ['leaves', startDate, endDate],
    queryFn: ({ signal }) => leavesApi.getLeaves({ startDate, endDate }, signal),
  });

  const { data: projects = [] } = projectsQuery;
  const { data: members = [] } = membersQuery;
  const { data: workSlots = [] } = slotsQuery;
  const { data: tasks = [] } = tasksQuery;
  const { data: leaves = [] } = leavesQuery;
  const { holidayMap } = holidayRules;
  const queries = [projectsQuery, membersQuery, slotsQuery, tasksQuery, leavesQuery];
  const isLoading = queries.some(query => query.isLoading) || holidayRules.isLoading;
  const hasError = queries.some(query => query.isError) || holidayRules.isError;
  const hasData = queries.every(query => query.data !== undefined) && holidayRules.hasData;
  const retry = () => {
    queries.forEach(query => { if (query.isError) void query.refetch(); });
    holidayRules.retry();
  };

  const activeProjects = useMemo(() => projects.filter(project => !project.archived), [projects]);
  const activeMembers = useMemo(() => members.filter(member => member.active), [members]);
  const selectedProjectIds = projectFilter.filter(id => activeProjects.some(project => project.id === id));
  const selectedMemberIds = useMemo(
    () => isAdmin ? memberFilter.filter(id => activeMembers.some(member => member.id === id)) : [],
    [isAdmin, memberFilter, activeMembers],
  );
  const todayStr = getCalendarDate();
  const rows = useMemo(() => {
    if (!hasData) return [];
    const visibleMembers = selectedMemberIds.length
      ? activeMembers.filter(member => selectedMemberIds.includes(member.id))
      : activeMembers;
    return computeScheduleRows(visibleMembers, dates, tasks, leaves, workSlots, holidayMap, todayStr);
  }, [hasData, selectedMemberIds, activeMembers, dates, tasks, leaves, workSlots, holidayMap, todayStr]);
  const gapRows = rows.filter(row => row.gap > 0);
  const totalGapMinutes = gapRows.reduce((total, row) => total + row.gap, 0);

  const openCreateModal = (opts?: {
    mode?: ScheduleEntryMode;
    memberId?: string;
    date?: string;
    slot?: WorkSlot;
  }) => {
    setEditingTask(null);
    setEditingLeave(null);
    setEntryMode(opts?.mode ?? (isAdmin ? 'task' : 'leave'));
    setInitialLeaveMemberId(opts?.memberId);
    setInitialDate(opts?.date);
    setInitialTaskValues(
      opts?.memberId || opts?.date
        ? {
            assigneeId: opts.memberId,
            startDate: opts.date,
            endDate: opts.date,
            startTime: opts.slot?.startTime,
            endTime: opts.slot?.endTime,
          }
        : undefined,
    );
    setEntryOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingLeave(null);
    setEditingTask(task);
    setInitialTaskValues(undefined);
    setEntryMode('task');
    setEntryOpen(true);
  };

  const handleEditLeave = (leave: Leave) => {
    if (!isAdmin && leave.memberId !== user?.id) return;
    setEditingTask(null);
    setEditingLeave(leave);
    setEntryMode('leave');
    setEntryOpen(true);
  };

  const handleMoveTask = async (
    taskId: string,
    target: {
      assigneeId: string;
      startDate: string;
      endDate: string;
      startTime: string;
      endTime: string;
    },
  ) => {
    try {
      await tasksApi.updateTask(taskId, target);
      toast.success('排期已更新');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '调整失败');
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white dark:bg-zinc-950">
      {/* Minimal Header (56px) */}
      <WorkbenchToolbar
        activeProjects={activeProjects}
        activeMembers={activeMembers}
        selectedProjectIds={selectedProjectIds}
        selectedMemberIds={selectedMemberIds}
        membersWithGap={gapRows.length}
        totalGapMinutes={totalGapMinutes}
        hasData={hasData}
        openCreate={() => openCreateModal()}
        openReview={() => setReviewOpen(true)}
        openProjects={() => setProjectsOpen(true)}
        openMembers={() => setMembersOpen(true)}
        openSettings={() => setSettingsOpen(true)}
        openPassword={() => setPasswordOpen(true)}
      />

      {/* Main XY Canvas */}
      {hasError && <QueryError message={hasData ? '排期刷新失败，当前显示上次结果' : '无法加载完整的排期数据'} retry={retry} />}
      {!hasData && isLoading && !hasError && (
        <div className="flex flex-1 items-center justify-center">
          <Spinner label="加载排期画布中..." />
        </div>
      )}
      {hasData && (
        <ScheduleCanvas
          period={calendarPeriod}
          today={todayStr}
          onlyGap={onlyGap}
          dates={dates}
          rows={onlyGap ? gapRows : rows}
          visibleProjectIds={selectedProjectIds}
          projects={projects}
          tasks={tasks}
          workSlots={workSlots}
          holidayMap={holidayMap}
          onTaskClick={handleEditTask}
          onLeaveClick={handleEditLeave}
          onSlotClick={(memberId, date, slot) => openCreateModal({ memberId, date, slot })}
          onMoveTask={handleMoveTask}
          onOpenMembers={() => setMembersOpen(true)}
        />
      )}

      {/* Unified Task + Leave Modal */}
      <ScheduleCreateModal
        open={entryOpen}
        initialMode={entryMode}
        editingTask={editingTask}
        editingLeave={editingLeave}
        initialTaskValues={initialTaskValues}
        initialLeaveMemberId={initialLeaveMemberId}
        initialDate={initialDate}
        projects={activeProjects}
        members={members}
        workSlots={workSlots}
        onClose={() => {
          setEntryOpen(false);
          setEditingTask(null);
          setEditingLeave(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['leaves'] });
          queryClient.invalidateQueries({ queryKey: ['summary'] });
        }}
      />

      {/* Overlays */}
      <ReviewModal
        open={reviewOpen}
        initialPeriod={calendarPeriod}
        initialDate={currentDate}
        onClose={() => setReviewOpen(false)}
      />

      {isAdmin && (
        <>
          <ProjectsModal open={projectsOpen} onClose={() => setProjectsOpen(false)} />
          <MembersModal open={membersOpen} onClose={() => setMembersOpen(false)} />
        </>
      )}

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ChangePasswordModal open={!LOCAL_MODE && passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
};
