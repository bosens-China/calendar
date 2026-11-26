import { useState, type DragEvent } from 'react';
import { CalendarOff, Plus } from 'lucide-react';
import { formatHours, type DaySlotCoverage, type Member, type MemberDaySchedule, type Task } from '@calendar/shared';
import { LEAVE_TYPE_CONFIG } from '../../utils/scheduleHelper';
import { PopoverCard } from '../ui/overlays';
import { cn } from '../ui/primitives';
import { DaySchedulePopover } from './DaySchedulePopover';
import { mergeDayTasks, type ScheduleDayActions } from './scheduleDay';

interface Props {
  period: 'week' | 'month';
  dateStr: string;
  member: Member;
  daySched?: MemberDaySchedule;
  isToday: boolean;
  isPast: boolean;
  isAdmin: boolean;
  actions: ScheduleDayActions;
  didPan: () => boolean;
  handleDragStart: (event: DragEvent, task: Task) => void;
  handleDropOnDay: (event: DragEvent, memberId: string, date: string) => void;
}

export function ScheduleDayCell({
  period, dateStr, member, daySched, isToday, isPast, isAdmin, actions, didPan, handleDragStart, handleDropOnDay,
}: Props) {
  const { visibleProjectIds, projectMap, workSlots, onTaskClick, onLeaveClick, onSlotClick } = actions;
  const memberColor = member.avatarColor || '#2563eb';
  const [isDrop, setIsDrop] = useState(false);
  const workday = daySched?.isWorkday ?? false;

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
    const mergedTasks = daySched ? mergeDayTasks(daySched, visibleProjectIds) : [];
    const gapSlots = (daySched?.slots || []).filter(
      (s: DaySlotCoverage) => s.gapMinutes > 0,
    );
    const isFullEmpty = daySched?.fillStatus === 'empty' && daySched.leaveMinutes === 0;

    return (
      <div
        onDragOver={(e) => {
          if (!isAdmin) return;
          e.preventDefault();
          setIsDrop(true);
        }}
        onDragLeave={() => setIsDrop(false)}
        onDrop={event => {
          setIsDrop(false);
          handleDropOnDay(event, member.id, dateStr);
        }}
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
              if (didPan()) return;
              onSlotClick(member.id, dateStr);
            }}
            className={cn(
              'flex flex-1 min-h-[44px] items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer',
              isPast
                ? 'bg-zinc-50/65 text-zinc-300 hover:bg-zinc-100/80 hover:text-zinc-500 dark:bg-zinc-900/40 dark:text-zinc-600 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-400'
                : 'bg-rose-50/75 text-rose-500 hover:bg-rose-100/80 hover:text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20',
            )}
          >
            {isPast ? (
              <>
                <span className="group-hover/cell:hidden">未排期</span>
                <span className="hidden items-center gap-1 group-hover/cell:inline-flex">
                  补录排期
                  <Plus className="h-3 w-3" />
                </span>
              </>
            ) : (
              <>
                <span>全天空档</span>
                <Plus className="h-3 w-3 opacity-0 transition-opacity group-hover/cell:opacity-100" />
              </>
            )}
          </button>
        ) : (
          gapSlots.map((gs) => (
            <button
              key={gs.slot.id}
              type="button"
              data-interactive="true"
              onClick={(e) => {
                e.stopPropagation();
                if (didPan()) return;
                onSlotClick(member.id, dateStr, gs.slot);
              }}
              className={cn(
                'flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors cursor-pointer',
                isPast
                  ? 'bg-zinc-50/80 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-500 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-300'
                  : 'bg-amber-50/85 text-amber-700 hover:bg-amber-100/80 dark:bg-amber-500/12 dark:text-amber-400 dark:hover:bg-amber-500/20',
              )}
            >
              <span>
                {gs.slot.label}{isPast ? '未排' : '空余'} {formatHours(gs.gapMinutes)}
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
  const satPct = Math.round((daySched?.saturation ?? 0) * 100);

  return (
    <div
      onDragOver={(e) => {
        if (!isAdmin) return;
        e.preventDefault();
        setIsDrop(true);
      }}
      onDragLeave={() => setIsDrop(false)}
      onDrop={event => {
        setIsDrop(false);
        handleDropOnDay(event, member.id, dateStr);
      }}
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
                (isPast
                  ? 'bg-zinc-50/70 border-zinc-200/60 text-zinc-300 dark:bg-zinc-900/40 dark:border-zinc-800/70 dark:text-zinc-600'
                  : 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-400'),
              fillStatus === 'partial' &&
                (isPast
                  ? 'bg-zinc-50 border-zinc-200 text-zinc-600 dark:bg-zinc-900/60 dark:border-zinc-700 dark:text-zinc-300'
                  : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400'),
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
                  ? isPast ? '—' : '空'
                  : fillStatus === 'on_leave'
                    ? '假'
                    : `${satPct}%`}
            </span>
          </button>
        }
      >
        {daySched && <DaySchedulePopover {...actions} day={daySched} member={member} isPast={isPast} />}
      </PopoverCard>
    </div>
  );
}
