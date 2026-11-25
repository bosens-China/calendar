import React, { useMemo, useRef, useState } from 'react';
import { CalendarOff, MoreHorizontal, Plus, UserPlus } from 'lucide-react';
import type {
  DaySlotCoverage,
  HolidayOverride,
  Leave,
  Member,
  MemberDaySchedule,
  Project,
  Task,
  WorkSlot,
} from '@calendar/shared';
import { computeMemberDaySchedule, formatHours, isWorkday } from '@calendar/shared';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { dayjs, SHORT_WEEKDAY_NAMES_ZH } from '../../utils/date';
import { LEAVE_TYPE_CONFIG } from '../../utils/scheduleHelper';
import { PopoverCard } from '../ui/overlays';
import { cn } from '../ui/primitives';

interface Props {
  period: 'week' | 'month';
  dates: string[];
  members: Member[];
  projects: Project[];
  tasks: Task[];
  leaves: Leave[];
  workSlots: WorkSlot[];
  holidayMap: Map<string, HolidayOverride>;
  onTaskClick: (task: Task) => void;
  onLeaveClick: (leave: Leave) => void;
  onSlotClick: (memberId: string, date: string, slot?: WorkSlot) => void;
  onMoveTask: (
    taskId: string,
    target: {
      assigneeId: string;
      startDate: string;
      endDate: string;
      startTime: string;
      endTime: string;
    },
  ) => void;
  onOpenMembers: () => void;
}

interface MergedDayTask {
  task: Task;
  totalMinutes: number;
  slotLabels: string[];
}

const Y_AXIS_WIDTH = 176;

function mergeDayTasks(day: MemberDaySchedule): MergedDayTask[] {
  const map = new Map<string, MergedDayTask>();
  for (const slotCov of day.slots) {
    for (const seg of slotCov.segments) {
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

export const ScheduleCanvas: React.FC<Props> = ({
  period,
  dates,
  members,
  projects,
  tasks,
  leaves,
  workSlots,
  holidayMap,
  onTaskClick,
  onLeaveClick,
  onSlotClick,
  onMoveTask,
  onOpenMembers,
}) => {
  const { user } = useAuthStore();
  const { onlyGap, hideNonWorkdays } = useUiStore();
  const isAdmin = user?.role === 'admin';
  const todayStr = dayjs().format('YYYY-MM-DD');

  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    moved: false,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const displayDates = useMemo(() => {
    if (!hideNonWorkdays) return dates;
    return dates.filter((d) => isWorkday(d, holidayMap));
  }, [dates, hideNonWorkdays, holidayMap]);

  const rows = useMemo(() => {
    const computed = members.map((member) => {
      const dayMap = new Map<string, MemberDaySchedule>();
      let expected = 0;
      let scheduled = 0;
      let gap = 0;

      for (const date of displayDates) {
        const day = computeMemberDaySchedule({
          date,
          memberId: member.id,
          tasks,
          leaves,
          workSlots,
          holidayMap,
        });
        dayMap.set(date, day);
        expected += day.expectedMinutes;
        scheduled += day.scheduledMinutes;
        gap += day.gapMinutes;
      }

      return {
        member,
        dayMap,
        expected,
        scheduled,
        gap,
        saturation: expected > 0 ? Math.min(1, scheduled / expected) : 1,
      };
    });

    return onlyGap ? computed.filter((r) => r.gap > 0) : computed;
  }, [members, displayDates, tasks, leaves, workSlots, holidayMap, onlyGap]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    if ((e.target as HTMLElement).closest('[data-interactive="true"]')) return;
    const el = viewportRef.current;
    if (!el) return;
    panRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      moved: false,
    };
    setIsPanning(true);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!panRef.current.active || !viewportRef.current) return;
    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) panRef.current.moved = true;
    viewportRef.current.scrollLeft = panRef.current.scrollLeft - dx;
    viewportRef.current.scrollTop = panRef.current.scrollTop - dy;
  };

  const endPan = () => {
    if (!panRef.current.active) return;
    panRef.current.active = false;
    setIsPanning(false);
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    if (!isAdmin) return;
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnDay = (
    e: React.DragEvent,
    memberId: string,
    date: string,
    slot?: WorkSlot,
  ) => {
    e.preventDefault();
    setDragOverKey(null);
    if (!isAdmin) return;
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const original = tasks.find((t) => t.id === taskId);
    const firstSlot = workSlots[0];
    const lastSlot = workSlots[workSlots.length - 1];
    if (original) {
      const spanDays = Math.max(0, dayjs(original.endDate).diff(dayjs(original.startDate), 'day'));
      const newEndDate = dayjs(date).add(spanDays, 'day').format('YYYY-MM-DD');
      onMoveTask(taskId, {
        assigneeId: memberId,
        startDate: date,
        endDate: newEndDate,
        startTime: slot ? slot.startTime : original.startTime,
        endTime: slot ? slot.endTime : original.endTime,
      });
      return;
    }
    onMoveTask(taskId, {
      assigneeId: memberId,
      startDate: date,
      endDate: date,
      startTime: slot ? slot.startTime : firstSlot?.startTime || '09:00',
      endTime: slot ? slot.endTime : lastSlot?.endTime || '18:00',
    });
  };

  const gridTemplateColumns = useMemo(() => {
    if (period === 'week') {
      const cols = displayDates.map((d) =>
        isWorkday(d, holidayMap) ? 'minmax(184px, 1fr)' : 'minmax(112px, 124px)',
      );
      return `${Y_AXIS_WIDTH}px ${cols.join(' ')}`;
    }
    const cols = displayDates.map((d) => (isWorkday(d, holidayMap) ? '58px' : '48px'));
    return `${Y_AXIS_WIDTH}px ${cols.join(' ')}`;
  }, [period, displayDates, holidayMap]);

  const renderMonthPopover = (day: MemberDaySchedule, member: Member) => {
    const memberColor = member.avatarColor || '#2563eb';
    const mergedTasks = mergeDayTasks(day);
    const gapSlots = day.slots.filter((s) => s.gapMinutes > 0);

    return (
      <div className="w-60 space-y-2.5">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: memberColor }} />
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {member.name}
            </span>
          </div>
          <span className="text-[11px] text-zinc-400">{day.date}</span>
        </div>

        {day.leaves.length > 0 && (
          <div className="space-y-1">
            {day.leaves.map((lv) => (
              <button
                key={lv.id}
                type="button"
                onClick={() => onLeaveClick(lv)}
                className="flex w-full items-center justify-between rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1.5 text-left text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-700 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <CalendarOff className="h-3 w-3" />
                  {LEAVE_TYPE_CONFIG[lv.type]?.label || '请假'}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {lv.startTime}-{lv.endTime}
                </span>
              </button>
            ))}
          </div>
        )}

        {mergedTasks.length > 0 && (
          <div className="space-y-1.5">
            {mergedTasks.map(({ task, totalMinutes, slotLabels }) => {
              const proj = projectMap.get(task.projectId);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onTaskClick(task)}
                  className="flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:brightness-95 cursor-pointer"
                  style={{
                    backgroundColor: `${memberColor}1c`,
                    borderLeft: `3px solid ${memberColor}`,
                  }}
                >
                  <span className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
                    {task.title}
                  </span>
                  <span className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                    <span>{proj?.name || '未分类'}</span>
                    <span>
                      {slotLabels.length >= workSlots.length ? '全天' : slotLabels.join('/')} ·{' '}
                      {formatHours(totalMinutes)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {gapSlots.length > 0 && (
          <div className="space-y-1">
            {gapSlots.map((gs) => (
              <button
                key={gs.slot.id}
                type="button"
                onClick={() => onSlotClick(member.id, day.date, gs.slot)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors',
                  day.fillStatus === 'empty'
                    ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-400 dark:hover:bg-rose-500/25'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400 dark:hover:bg-amber-500/25',
                )}
              >
                <span>
                  {gs.slot.label}空余 {formatHours(gs.gapMinutes)}
                </span>
                <Plus className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-white dark:bg-zinc-950">
      <div
        ref={viewportRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={endPan}
        onMouseLeave={endPan}
        className={cn(
          'canvas-viewport relative flex-1 min-h-0 overflow-auto bg-white dark:bg-zinc-950',
          isPanning && 'is-panning select-none',
        )}
      >
        <div
          className="grid min-w-full"
          style={{
            gridTemplateColumns,
            width: period === 'month' ? 'max-content' : '100%',
          }}
        >
          {/* Sticky Top-Left Origin (distinct member axis header) */}
          <div className="sticky top-0 left-0 z-40 flex items-center justify-between border-b border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/95 dark:bg-zinc-900/95 backdrop-blur-xs px-4 py-3 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 shadow-[2px_0_8px_-4px_rgba(0,0,0,0.06)]">
            <span>成员</span>
            <span>{rows.length}</span>
          </div>

          {/* Sticky X-Axis Dates */}
          {displayDates.map((dateStr) => {
            const d = dayjs(dateStr);
            const weekdayIdx = d.isoWeekday() - 1;
            const holiday = holidayMap.get(dateStr);
            const workday = isWorkday(dateStr, holidayMap);
            const isToday = dateStr === todayStr;

            return (
              <div
                key={`head-${dateStr}`}
                className={cn(
                  'sticky top-0 z-30 flex flex-col justify-center border-b border-r border-zinc-100 dark:border-zinc-800/70 backdrop-blur-xs',
                  isToday
                    ? 'bg-blue-50/45 dark:bg-blue-500/10'
                    : workday
                      ? 'bg-white/95 dark:bg-zinc-950/95'
                      : 'bg-zinc-100/70 dark:bg-zinc-900/60',
                  period === 'week' ? 'px-3 py-2.5' : 'px-1 py-2.5 items-center',
                )}
              >
                <div
                  className={cn(
                    'flex items-center gap-1.5 whitespace-nowrap',
                    period === 'week' ? 'justify-between' : 'flex-col gap-0.5',
                  )}
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    {isToday && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
                    <span
                      className={cn(
                        'font-semibold tracking-tight whitespace-nowrap',
                        period === 'week' ? 'text-[13px]' : 'text-xs',
                        isToday
                          ? 'text-blue-700 dark:text-blue-400'
                          : workday
                            ? 'text-zinc-800 dark:text-zinc-100'
                            : 'text-zinc-500 dark:text-zinc-500',
                      )}
                    >
                      {period === 'week' ? `周${SHORT_WEEKDAY_NAMES_ZH[weekdayIdx]}` : d.date()}
                    </span>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal whitespace-nowrap">
                      {period === 'week' ? d.format('M/D') : SHORT_WEEKDAY_NAMES_ZH[weekdayIdx]}
                    </span>
                  </div>

                  {holiday && (
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap',
                        holiday.kind === 'holiday'
                          ? 'bg-rose-100/80 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'
                          : 'bg-blue-100/80 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
                      )}
                    >
                      {holiday.kind === 'holiday'
                        ? period === 'week'
                          ? holiday.name
                          : '休'
                        : '班'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Y-Axis Rows & Cells */}
          {rows.map(({ member, dayMap, expected, scheduled, gap, saturation }) => {
            const memberColor = member.avatarColor || '#2563eb';
            const pct = Math.round(saturation * 100);

            return (
              <React.Fragment key={member.id}>
                {/* Sticky Member Header (clearly separated from main canvas) */}
                <div className="group sticky left-0 z-20 flex flex-col justify-center gap-2 border-b border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/85 dark:bg-zinc-900/90 px-4 py-3.5 shadow-[2px_0_8px_-4px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: memberColor }}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                          {member.name}
                        </div>
                        {member.title && (
                          <div className="truncate text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 leading-tight">
                            {member.title}
                          </div>
                        )}
                      </div>
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        data-interactive="true"
                        onClick={onOpenMembers}
                        title="管理成员"
                        className="rounded-md p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 group-hover:opacity-100 cursor-pointer"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div
                    className="flex items-center gap-2"
                    title={`已排 ${formatHours(scheduled)} / 应出勤 ${formatHours(expected)}${gap > 0 ? ` · 空余 ${formatHours(gap)}` : ''}`}
                  >
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor:
                            gap === 0 ? memberColor : pct === 0 ? '#f43f5e' : '#f59e0b',
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                      {pct}%
                    </span>
                  </div>
                </div>

                {/* Date Cells */}
                {displayDates.map((dateStr) => {
                  const daySched = dayMap.get(dateStr);
                  const workday = daySched?.isWorkday ?? false;
                  const isToday = dateStr === todayStr;

                  if (!workday) {
                    return (
                      <div
                        key={`${member.id}-${dateStr}`}
                        className={cn(
                          'flex items-center justify-center border-b border-r border-zinc-100 dark:border-zinc-800/60 bg-zinc-100/65 dark:bg-zinc-900/45 text-[11px] text-zinc-400/80 dark:text-zinc-600 whitespace-nowrap',
                          period === 'week' ? 'min-h-[96px]' : 'min-h-[60px]',
                        )}
                      >
                        {period === 'week' ? '休' : ''}
                      </div>
                    );
                  }

                  if (period === 'week') {
                    const cellKey = `${member.id}-${dateStr}`;
                    const isDrop = dragOverKey === cellKey;
                    const mergedTasks = daySched ? mergeDayTasks(daySched) : [];
                    const gapSlots = (daySched?.slots || []).filter(
                      (s: DaySlotCoverage) => s.gapMinutes > 0,
                    );
                    const isFullEmpty = daySched?.fillStatus === 'empty';

                    return (
                      <div
                        key={cellKey}
                        onDragOver={(e) => {
                          if (!isAdmin) return;
                          e.preventDefault();
                          setDragOverKey(cellKey);
                        }}
                        onDragLeave={() => setDragOverKey(null)}
                        onDrop={(e) => handleDropOnDay(e, member.id, dateStr)}
                        className={cn(
                          'group/cell flex flex-col gap-1.5 border-b border-r border-zinc-100 dark:border-zinc-800/70 p-2 min-h-[96px] transition-colors',
                          isDrop
                            ? 'bg-blue-50/70 dark:bg-blue-500/15'
                            : isToday
                              ? 'bg-blue-50/15 dark:bg-blue-500/[0.04]'
                              : 'bg-white dark:bg-zinc-950',
                        )}
                      >
                        {daySched?.leaves.map((lv) => (
                          <div
                            key={lv.id}
                            data-interactive="true"
                            onClick={(e) => {
                              e.stopPropagation();
                              onLeaveClick(lv);
                            }}
                            className="flex items-center justify-between gap-2 rounded-lg bg-zinc-100/90 dark:bg-zinc-800/90 px-2.5 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 transition-colors hover:bg-zinc-200/70 dark:hover:bg-zinc-700/80 cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5 font-medium truncate">
                              <CalendarOff className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                              {LEAVE_TYPE_CONFIG[lv.type]?.label || '请假'}
                            </span>
                            <span className="shrink-0 text-[10px] text-zinc-400">
                              {lv.startTime}-{lv.endTime}
                            </span>
                          </div>
                        ))}

                        {mergedTasks.map(({ task, totalMinutes, slotLabels }) => {
                          const proj = projectMap.get(task.projectId);
                          const isFullDay = slotLabels.length >= workSlots.length;
                          return (
                            <div
                              key={task.id}
                              data-interactive="true"
                              draggable={isAdmin}
                              onDragStart={(e) => handleDragStart(e, task)}
                              onClick={(e) => {
                                e.stopPropagation();
                                onTaskClick(task);
                              }}
                              className={cn(
                                'flex flex-col gap-1 rounded-lg px-2.5 py-2 transition-all hover:shadow-xs',
                                isAdmin ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                              )}
                              style={{
                                backgroundColor: `${memberColor}18`,
                                borderLeft: `3px solid ${memberColor}`,
                              }}
                            >
                              <div
                                className="text-xs font-medium text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2"
                                title={task.title}
                              >
                                {task.title}
                              </div>
                              <div className="flex items-center justify-between gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                                <span className="flex items-center gap-1 truncate">
                                  <span
                                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: proj?.color || '#71717a' }}
                                  />
                                  <span className="truncate">{proj?.name || '未分类'}</span>
                                </span>
                                <span className="shrink-0 text-zinc-400 dark:text-zinc-500">
                                  {isFullDay ? '全天' : slotLabels.join('/')} ·{' '}
                                  {formatHours(totalMinutes)}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                        {isFullEmpty ? (
                          <button
                            type="button"
                            data-interactive="true"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (panRef.current.moved) return;
                              onSlotClick(member.id, dateStr);
                            }}
                            className="flex flex-1 min-h-[44px] items-center justify-center gap-1 rounded-lg bg-rose-50/75 text-[11px] font-medium text-rose-500 transition-colors hover:bg-rose-100/80 hover:text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20 cursor-pointer"
                          >
                            <span>全天空档</span>
                            <Plus className="h-3 w-3 opacity-0 transition-opacity group-hover/cell:opacity-100" />
                          </button>
                        ) : (
                          gapSlots.map((gs) => (
                            <button
                              key={gs.slot.id}
                              type="button"
                              data-interactive="true"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (panRef.current.moved) return;
                                onSlotClick(member.id, dateStr, gs.slot);
                              }}
                              className="flex items-center justify-between rounded-lg bg-amber-50/85 px-2.5 py-1.5 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-100/80 dark:bg-amber-500/12 dark:text-amber-400 dark:hover:bg-amber-500/20 cursor-pointer"
                            >
                              <span>
                                {gs.slot.label}空余 {formatHours(gs.gapMinutes)}
                              </span>
                              <Plus className="h-3 w-3 opacity-60" />
                            </button>
                          ))
                        )}
                      </div>
                    );
                  }

                  // Month View
                  const fillStatus = daySched?.fillStatus ?? 'empty';
                  const cellKey = `${member.id}-${dateStr}`;
                  const isDrop = dragOverKey === cellKey;
                  const satPct = Math.round((daySched?.saturation ?? 0) * 100);

                  return (
                    <div
                      key={cellKey}
                      onDragOver={(e) => {
                        if (!isAdmin) return;
                        e.preventDefault();
                        setDragOverKey(cellKey);
                      }}
                      onDragLeave={() => setDragOverKey(null)}
                      onDrop={(e) => handleDropOnDay(e, member.id, dateStr)}
                      className={cn(
                        'flex items-center justify-center border-b border-r border-zinc-100 dark:border-zinc-800/60 p-1.5 min-h-[60px]',
                        isDrop
                          ? 'bg-blue-50 dark:bg-blue-500/15'
                          : isToday
                            ? 'bg-blue-50/15 dark:bg-blue-500/[0.04]'
                            : 'bg-white dark:bg-zinc-950',
                      )}
                    >
                      <PopoverCard
                        trigger={
                          <button
                            type="button"
                            data-interactive="true"
                            className={cn(
                              'relative flex h-9 w-full overflow-hidden rounded-lg border transition-transform hover:scale-105 cursor-pointer',
                              fillStatus === 'empty' &&
                                'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-400',
                              fillStatus === 'partial' &&
                                'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400',
                              fillStatus === 'on_leave' &&
                                'bg-zinc-100 border-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400',
                            )}
                            style={
                              fillStatus === 'full'
                                ? {
                                    backgroundColor: `${memberColor}24`,
                                    borderColor: `${memberColor}55`,
                                    color: memberColor,
                                  }
                                : undefined
                            }
                          >
                            {fillStatus === 'partial' && (
                              <span
                                className="h-full shrink-0"
                                style={{
                                  width: `${Math.max(25, Math.min(75, satPct))}%`,
                                  backgroundColor: `${memberColor}38`,
                                }}
                              />
                            )}
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold">
                              {fillStatus === 'full'
                                ? '●'
                                : fillStatus === 'empty'
                                  ? '空'
                                  : fillStatus === 'on_leave'
                                    ? '假'
                                    : `${satPct}%`}
                            </span>
                          </button>
                        }
                      >
                        {daySched && renderMonthPopover(daySched, member)}
                      </PopoverCard>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}

          {/* Inline Bottom Add Member */}
          {isAdmin && (
            <>
              <div className="sticky left-0 z-20 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/85 dark:bg-zinc-900/90 px-4 py-3 shadow-[2px_0_8px_-4px_rgba(0,0,0,0.06)]">
                <button
                  type="button"
                  data-interactive="true"
                  onClick={onOpenMembers}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  添加成员
                </button>
              </div>
              <div
                className="bg-white dark:bg-zinc-950"
                style={{ gridColumn: `span ${displayDates.length}` }}
              />
            </>
          )}
        </div>
      </div>

      {/* Subtle Bottom Legend Bar */}
      <footer className="flex h-8 shrink-0 items-center justify-between border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/50 px-4 text-[11px] text-zinc-400 dark:text-zinc-500">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            成员色 · 已排期
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            浅红 · 全天空档
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            浅黄 · 当天未满
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-zinc-400" />
            浅灰 · 请假
          </span>
        </div>
        <span className="hidden sm:inline">触控板自由滑动 · 拖动画布空白处可平移</span>
      </footer>
    </div>
  );
};
