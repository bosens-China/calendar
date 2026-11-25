import React, { useMemo, useRef, useState } from 'react';
import { MoreHorizontal, UserPlus } from 'lucide-react';
import type {
  HolidayOverride,
  Leave,
  Member,
  MemberDaySchedule,
  Project,
  Task,
  WorkSlot,
} from '@calendar/shared';
import { formatHours, getCalendarDate, isWorkday } from '@calendar/shared';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { dayjs, SHORT_WEEKDAY_NAMES_ZH } from '../../utils/date';
import { cn } from '../ui/primitives';
import type { ScheduleRow } from './scheduleRows';
import { TraditionalCalendar } from './TraditionalCalendar';
import { DaySchedulePopover } from './DaySchedulePopover';
import { ScheduleDayCell } from './ScheduleDayCell';
import type { ScheduleDayActions } from './scheduleDay';
import { LOCAL_MODE } from '../../api';

interface Props {
  period: 'week' | 'month';
  dates: string[];
  rows: ScheduleRow[];
  visibleProjectIds: string[];
  projects: Project[];
  tasks: Task[];
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

const Y_AXIS_WIDTH = 176;

export const ScheduleCanvas: React.FC<Props> = ({
  period,
  dates,
  rows,
  visibleProjectIds,
  projects,
  tasks,
  workSlots,
  holidayMap,
  onTaskClick,
  onLeaveClick,
  onSlotClick,
  onMoveTask,
  onOpenMembers,
}) => {
  const { user } = useAuthStore();
  const { calendarLayout, hideNonWorkdays } = useUiStore();
  const isAdmin = user?.role === 'admin';
  const todayStr = getCalendarDate();

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

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const displayDates = useMemo(() => {
    if (!hideNonWorkdays) return dates;
    return dates.filter((d) => isWorkday(d, holidayMap));
  }, [dates, hideNonWorkdays, holidayMap]);

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

  const handleDropOnDay = (event: React.DragEvent, memberId: string, date: string) => {
    event.preventDefault();
    if (!isAdmin) return;
    const task = tasks.find(item => item.id === event.dataTransfer.getData('text/plain'));
    if (!task) return;
    const spanDays = Math.max(0, dayjs(task.endDate).diff(dayjs(task.startDate), 'day'));
    onMoveTask(task.id, {
      assigneeId: memberId,
      startDate: date,
      endDate: dayjs(date).add(spanDays, 'day').format('YYYY-MM-DD'),
      startTime: task.startTime,
      endTime: task.endTime,
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

  const dayActions: ScheduleDayActions = {
    visibleProjectIds, projectMap, workSlots, onTaskClick, onLeaveClick, onSlotClick,
  };
  const renderDay = (day: MemberDaySchedule, member: Member) =>
    <DaySchedulePopover {...dayActions} day={day} member={member} />;

  if (calendarLayout === 'calendar') {
    return (
      <TraditionalCalendar
        dates={dates}
        rows={rows}
        holidayMap={holidayMap}
        today={todayStr}
        hideNonWorkdays={hideNonWorkdays}
        renderDay={renderDay}
      />
    );
  }

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

                {displayDates.map(date => (
                  <ScheduleDayCell key={date} dateStr={date} period={period} member={member}
                    daySched={dayMap.get(date)} isToday={date === todayStr} isAdmin={isAdmin}
                    actions={dayActions} didPan={() => panRef.current.moved}
                    handleDragStart={handleDragStart} handleDropOnDay={handleDropOnDay}
                  />
                ))}
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
                  {LOCAL_MODE ? '添加排期人员' : '邀请成员'}
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
