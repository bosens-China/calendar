import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Settings,
  Sun,
  Users2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { HolidayOverride, Leave, Member, Project, Task, WorkSlot } from '@calendar/shared';
import { computeMemberDaySchedule, formatHours, isWorkday } from '@calendar/shared';
import { leavesApi, membersApi, projectsApi, settingsApi, tasksApi } from '../api';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';
import { useThemeStore } from '../store/themeStore';
import {
  canNavigatePrev,
  clampDateMin,
  dayjs,
  getMonthDateRange,
  getMonthDates,
  getWeekDateRange,
  getWeekDates,
} from '../utils/date';
import { ScheduleCanvas } from '../components/canvas/ScheduleCanvas';
import { PeriodPicker } from '../components/canvas/PeriodPicker';
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
import { Button, cn, Spinner } from '../components/ui/primitives';
import {
  DropdownItem,
  DropdownSeparator,
  PopoverCard,
  UserDropdown,
} from '../components/ui/overlays';

export const CalendarView: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const isAdmin = user?.role === 'admin';

  const {
    calendarPeriod,
    currentDate,
    selectedProjectIds,
    onlyGap,
    hideNonWorkdays,
    setCalendarPeriod,
    setCurrentDate,
    setSelectedProjectIds,
    setOnlyGap,
    setHideNonWorkdays,
    prevPeriod,
    nextPeriod,
  } = useUiStore();

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

  const startYear = Math.max(2026, dayjs(startDate).year());
  const endYear = Math.max(2026, dayjs(endDate).year());
  const yearsKey = startYear === endYear ? `${startYear}` : `${startYear}-${endYear}`;

  const { data: projects = [], isLoading: loadingProjects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: projectsApi.getProjects,
  });

  const { data: members = [], isLoading: loadingMembers } = useQuery<Member[]>({
    queryKey: ['members'],
    queryFn: membersApi.getMembers,
  });

  const { data: workSlots = [], isLoading: loadingWorkSlots } = useQuery<WorkSlot[]>({
    queryKey: ['settings', 'workSlots'],
    queryFn: settingsApi.getWorkSlots,
  });

  const { data: holidays = [], isLoading: loadingHolidays } = useQuery<HolidayOverride[]>({
    queryKey: ['settings', 'holidays', yearsKey],
    queryFn: async () => {
      if (startYear === endYear) return settingsApi.getHolidays(startYear);
      const [h1, h2] = await Promise.all([
        settingsApi.getHolidays(startYear),
        settingsApi.getHolidays(endYear),
      ]);
      return [...h1, ...h2];
    },
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery<Task[]>({
    queryKey: ['tasks', startDate, endDate],
    queryFn: () => tasksApi.getTasks({ startDate, endDate }),
  });

  const { data: leaves = [], isLoading: loadingLeaves } = useQuery<Leave[]>({
    queryKey: ['leaves', startDate, endDate],
    queryFn: () => leavesApi.getLeaves({ startDate, endDate }),
  });

  const holidayMap = useMemo(
    () => new Map<string, HolidayOverride>(holidays.map((h) => [h.date, h])),
    [holidays],
  );

  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);
  const activeMembers = useMemo(() => members.filter((m) => m.active), [members]);

  const filteredTasks = useMemo(() => {
    if (selectedProjectIds.length === 0) return tasks;
    const set = new Set(selectedProjectIds);
    return tasks.filter((t) => set.has(t.projectId));
  }, [tasks, selectedProjectIds]);

  const { membersWithGap, totalGapMinutes } = useMemo(() => {
    let gapMembers = 0;
    let totalGap = 0;
    const workdays = dates.filter((d) => isWorkday(d, holidayMap));
    for (const m of activeMembers) {
      let mGap = 0;
      for (const date of workdays) {
        const day = computeMemberDaySchedule({
          date,
          memberId: m.id,
          tasks: filteredTasks,
          leaves,
          workSlots,
          holidayMap,
        });
        mGap += day.gapMinutes;
      }
      if (mGap > 0) {
        gapMembers += 1;
        totalGap += mGap;
      }
    }
    return { membersWithGap: gapMembers, totalGapMinutes: totalGap };
  }, [activeMembers, dates, filteredTasks, leaves, workSlots, holidayMap]);

  const toggleProjectFilter = (projectId: string) => {
    if (selectedProjectIds.includes(projectId)) {
      setSelectedProjectIds(selectedProjectIds.filter((id) => id !== projectId));
    } else {
      setSelectedProjectIds([...selectedProjectIds, projectId]);
    }
  };

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

  const isLoading =
    loadingProjects ||
    loadingMembers ||
    loadingWorkSlots ||
    loadingHolidays ||
    loadingTasks ||
    loadingLeaves;

  const avatarChar = (user?.name || user?.username || 'U').slice(0, 1).toUpperCase();

  const projectFilterLabel =
    selectedProjectIds.length === 0
      ? '全部项目'
      : selectedProjectIds.length === 1
        ? activeProjects.find((p) => p.id === selectedProjectIds[0])?.name || '1 个项目'
        : `已选 ${selectedProjectIds.length} 个项目`;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white dark:bg-zinc-950">
      {/* Minimal Header (56px) */}
      <header className="z-50 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-zinc-200/75 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 px-5">
        {/* Left: Logo + Week/Month Switch + Calendar Picker + Prev/Next */}
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="Logo" className="h-7 w-7 rounded-lg" />

          <div className="inline-flex rounded-lg bg-zinc-100 dark:bg-zinc-900 p-0.5 text-xs">
            {(['week', 'month'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setCalendarPeriod(p)}
                className={cn(
                  'rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer',
                  calendarPeriod === p
                    ? 'bg-white text-zinc-950 shadow-2xs dark:bg-zinc-800 dark:text-zinc-50'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
                )}
              >
                {p === 'week' ? '周' : '月'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              disabled={!canNavigatePrev(currentDate, calendarPeriod)}
              onClick={prevPeriod}
              title="上一周期"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <PeriodPicker
              period={calendarPeriod}
              currentDate={currentDate}
              onChangeDate={setCurrentDate}
            />

            <Button size="icon" variant="ghost" onClick={nextPeriod} title="下一周期">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Right: Project Filter + Gap Indicator + Review + Theme Toggle + New + Avatar */}
        <div className="flex items-center gap-2">
          <PopoverCard
            side="bottom"
            align="end"
            trigger={
              <button
                type="button"
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors cursor-pointer',
                  selectedProjectIds.length > 0
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800',
                )}
              >
                <FolderKanban className="h-3.5 w-3.5 opacity-70" />
                <span>{projectFilterLabel}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            }
          >
            <div className="w-56 space-y-1">
              <button
                type="button"
                onClick={() => setSelectedProjectIds([])}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <span className="font-medium">全部项目</span>
                {selectedProjectIds.length === 0 && <Check className="h-3.5 w-3.5" />}
              </button>
              <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
              {activeProjects.map((p) => {
                const checked = selectedProjectIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProjectFilter(p.id)}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="truncate">{p.name}</span>
                    </span>
                    {checked && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}
              <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
              <label className="flex items-center gap-2 px-2.5 py-1 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideNonWorkdays}
                  onChange={(e) => setHideNonWorkdays(e.target.checked)}
                  className="rounded border-zinc-300 dark:border-zinc-700"
                />
                隐藏周末与节假日
              </label>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setProjectsOpen(true)}
                  className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 py-1.5 text-xs font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  管理项目
                </button>
              )}
            </div>
          </PopoverCard>

          {membersWithGap > 0 && (
            <button
              type="button"
              onClick={() => setOnlyGap((v) => !v)}
              title="点击仅看存在空档的成员"
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors cursor-pointer',
                onlyGap
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-600 hover:bg-rose-100/80 dark:bg-rose-500/15 dark:text-rose-400 dark:hover:bg-rose-500/25',
              )}
            >
              <span
                className={cn('h-1.5 w-1.5 rounded-full', onlyGap ? 'bg-white' : 'bg-rose-500')}
              />
              <span>
                {membersWithGap}人空档 · {formatHours(totalGapMinutes)}
              </span>
            </button>
          )}

          <Button size="sm" variant="ghost" onClick={() => setReviewOpen(true)}>
            <BarChart3 className="h-3.5 w-3.5" />
            复盘
          </Button>

          <Button size="sm" variant="primary" onClick={() => openCreateModal()}>
            <Plus className="h-3.5 w-3.5" />
            {isAdmin ? '新建' : '请假'}
          </Button>

          <UserDropdown
            trigger={
              <button
                type="button"
                className="ml-0.5 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white transition-transform hover:scale-105 cursor-pointer"
                style={{ backgroundColor: user?.avatarColor || '#18181b' }}
              >
                {avatarChar}
              </button>
            }
          >
            <div className="px-2.5 py-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {user?.name}
              </div>
              <div className="text-[11px] text-zinc-400">
                {user?.role === 'admin' ? '管理员' : '成员'} · @{user?.username}
              </div>
            </div>
            <DropdownSeparator />
            <div className="px-2 py-1.5">
              <div className="mb-1.5 px-0.5 text-[10px] font-medium text-zinc-400">外观主题</div>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5">
                {(
                  [
                    { key: 'auto', label: '自动', icon: Monitor },
                    { key: 'light', label: '浅色', icon: Sun },
                    { key: 'dark', label: '深色', icon: Moon },
                  ] as const
                ).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTheme(key)}
                    className={cn(
                      'inline-flex items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium transition-colors cursor-pointer',
                      theme === key
                        ? 'bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-50'
                        : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <DropdownSeparator />
            {isAdmin && (
              <>
                <DropdownItem onClick={() => setProjectsOpen(true)}>
                  <FolderKanban className="h-3.5 w-3.5" />
                  项目管理
                </DropdownItem>
                <DropdownItem onClick={() => setMembersOpen(true)}>
                  <Users2 className="h-3.5 w-3.5" />
                  人员管理
                </DropdownItem>
              </>
            )}
            <DropdownItem onClick={() => setSettingsOpen(true)}>
              <Settings className="h-3.5 w-3.5" />
              系统设置
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem onClick={() => setPasswordOpen(true)}>
              <KeyRound className="h-3.5 w-3.5" />
              修改密码
            </DropdownItem>
            <DropdownItem
              danger
              onClick={() => {
                logout();
                toast.success('已退出登录');
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              退出登录
            </DropdownItem>
          </UserDropdown>
        </div>
      </header>

      {/* Main XY Canvas */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner label="加载排期画布中..." />
        </div>
      ) : (
        <ScheduleCanvas
          period={calendarPeriod}
          dates={dates}
          members={activeMembers}
          projects={projects}
          tasks={filteredTasks}
          leaves={leaves}
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
        holidayMap={holidayMap}
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
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
};
