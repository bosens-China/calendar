import type { ReactNode } from 'react';
import { formatHours, isWorkday, type HolidayOverride, type Member, type MemberDaySchedule } from '@calendar/shared';
import { dayjs, SHORT_WEEKDAY_NAMES_ZH } from '../../utils/date';
import { PopoverCard } from '../ui/overlays';
import { cn } from '../ui/primitives';
import type { ScheduleRow } from './scheduleRows';

interface Props {
  dates: string[];
  rows: ScheduleRow[];
  holidayMap: Map<string, HolidayOverride>;
  today: string;
  hideNonWorkdays: boolean;
  renderDay: (day: MemberDaySchedule, member: Member) => ReactNode;
}

export function TraditionalCalendar({ dates, rows, holidayMap, today, hideNonWorkdays, renderDay }: Props) {
  const prefix = dates.length ? dayjs(dates[0]).isoWeekday() - 1 : 0;
  const grid = [...Array<null>(prefix).fill(null), ...dates];
  while (grid.length % 7 !== 0) grid.push(null);

  return (
    <div className="min-h-0 flex-1 overflow-auto" aria-label="传统日历">
      <div className="grid min-w-[680px] grid-cols-7">
        {SHORT_WEEKDAY_NAMES_ZH.map(day => (
          <div key={day} className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium dark:border-zinc-800 dark:bg-zinc-900">周{day}</div>
        ))}
        {grid.map((date, index) => {
          if (!date) return <div key={`blank-${index}`} className="border-b border-r border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />;
          const holiday = holidayMap.get(date);
          const workday = isWorkday(date, holidayMap);
          return (
            <section
              key={date}
              aria-label={date}
              className={cn(
                'min-h-28 border-b border-r border-zinc-200 p-2 dark:border-zinc-800',
                date === today && 'bg-blue-50 dark:bg-blue-950/30',
                !workday && 'bg-zinc-50 text-zinc-500 dark:bg-zinc-900',
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-1 text-xs">
                <span className="font-semibold">{Number(date.slice(-2))}</span>
                {holiday && <span className="truncate" title={holiday.name}>{holiday.kind === 'workday' ? '班' : '休'} · {holiday.name}</span>}
              </div>
              {(!hideNonWorkdays || workday) && rows.map(({ member, dayMap }) => {
                const day = dayMap.get(date);
                if (!day || (!workday && day.leaves.length === 0)) return null;
                const status = day.fillStatus === 'on_leave' ? '请假'
                  : day.gapMinutes > 0 ? `空余 ${formatHours(day.gapMinutes)}`
                  : workday ? '已排满' : '请假';
                return (
                  <PopoverCard
                    key={member.id}
                    align="start"
                    trigger={
                      <button type="button" className="mb-1 flex w-full items-center justify-between gap-1 rounded border border-zinc-200 px-1.5 py-1 text-left text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                        <span className="truncate" style={{ color: member.avatarColor }}>{member.name}</span>
                        <span className={cn('shrink-0 text-[10px]', day.gapMinutes > 0 && (day.fillStatus === 'empty' ? 'text-rose-600' : 'text-amber-700'))}>{status}</span>
                      </button>
                    }
                  >
                    {renderDay(day, member)}
                  </PopoverCard>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
