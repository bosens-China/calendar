import { CalendarOff, Plus } from 'lucide-react';
import { formatHours, type MemberDaySchedule, type Member } from '@calendar/shared';
import { LEAVE_TYPE_CONFIG } from '../../utils/scheduleHelper';
import { cn } from '../ui/primitives';
import { mergeDayTasks, type ScheduleDayActions } from './scheduleDay';

export function DaySchedulePopover({
  day, member, visibleProjectIds, projectMap, workSlots, onTaskClick, onLeaveClick, onSlotClick,
}: ScheduleDayActions & { day: MemberDaySchedule; member: Member }) {
  const memberColor = member.avatarColor || '#2563eb';
  const mergedTasks = mergeDayTasks(day, visibleProjectIds);
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
}
