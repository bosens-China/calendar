import React, { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  clampDateMin,
  dayjs,
  getCalendarGridDays,
  getWeekDateRange,
  MIN_ALLOWED_DATE,
  MIN_ALLOWED_YEAR,
  SHORT_WEEKDAY_NAMES_ZH,
} from '../../utils/date';
import { cn } from '../ui/primitives';

interface Props {
  period: 'week' | 'month';
  currentDate: string;
  onChangeDate: (date: string) => void;
}

const MONTHS_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export const PeriodPicker: React.FC<Props> = ({ period, currentDate, onChangeDate }) => {
  const [open, setOpen] = useState(false);
  const [panelMonth, setPanelMonth] = useState(() => dayjs(currentDate).startOf('month'));
  const [hoverWeekStart, setHoverWeekStart] = useState<string | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setPanelMonth(dayjs(currentDate).startOf('month'));
      setHoverWeekStart(null);
    }
    setOpen(nextOpen);
  };

  const selectedWeek = useMemo(() => getWeekDateRange(currentDate), [currentDate]);
  const selectedMonthKey = dayjs(currentDate).format('YYYY-MM');

  const displayLabel = useMemo(() => {
    if (period === 'month') {
      return dayjs(currentDate).format('YYYY年M月');
    }
    const s = dayjs(selectedWeek.startDate);
    const e = dayjs(selectedWeek.endDate);
    if (s.year() !== e.year()) {
      return `${s.format('YYYY.M.D')} – ${e.format('YYYY.M.D')}`;
    }
    if (s.month() !== e.month()) {
      return `${s.format('YYYY.M.D')} – ${e.format('M.D')}`;
    }
    return `${s.format('YYYY.M.D')} – ${e.format('D')}`;
  }, [period, currentDate, selectedWeek]);

  const gridDays = useMemo(
    () => getCalendarGridDays(panelMonth.format('YYYY-MM-DD')),
    [panelMonth],
  );

  const canPrevPanelMonth = panelMonth.year() > MIN_ALLOWED_YEAR || panelMonth.month() > 0;
  const canPrevPanelYear = panelMonth.year() > MIN_ALLOWED_YEAR;

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors cursor-pointer',
            'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50',
            'dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/80',
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 text-zinc-400" />
          <span className="tracking-tight">{displayLabel}</span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={8}
          className="z-50 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl outline-none dark:border-zinc-800 dark:bg-zinc-900"
        >
          {period === 'week' ? (
            <div className="space-y-2.5">
              {/* Month Navigation */}
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  disabled={!canPrevPanelMonth}
                  onClick={() => setPanelMonth(panelMonth.subtract(1, 'month'))}
                  className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {panelMonth.format('YYYY年M月')}
                </span>
                <button
                  type="button"
                  onClick={() => setPanelMonth(panelMonth.add(1, 'month'))}
                  className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 text-center text-[11px] font-medium text-zinc-400">
                {SHORT_WEEKDAY_NAMES_ZH.map((w) => (
                  <div key={w} className="py-1">
                    {w}
                  </div>
                ))}
              </div>

              {/* Week Rows */}
              <div
                className="grid grid-cols-7 gap-y-0.5"
                onMouseLeave={() => setHoverWeekStart(null)}
              >
                {gridDays.map((cell) => {
                  const disabled = cell.date < MIN_ALLOWED_DATE;
                  const cellWeek = getWeekDateRange(cell.date);
                  const isSelectedWeek =
                    cell.date >= selectedWeek.startDate && cell.date <= selectedWeek.endDate;
                  const isHoveredWeek = hoverWeekStart === cellWeek.startDate;
                  const isRowStart = cell.dayOfWeek === 1;
                  const isRowEnd = cell.dayOfWeek === 7;

                  return (
                    <button
                      key={cell.date}
                      type="button"
                      disabled={disabled}
                      onMouseEnter={() => !disabled && setHoverWeekStart(cellWeek.startDate)}
                      onClick={() => {
                        if (disabled) return;
                        onChangeDate(clampDateMin(cell.date));
                        setOpen(false);
                      }}
                      className={cn(
                        'h-8 text-xs transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed',
                        isRowStart && 'rounded-l-md',
                        isRowEnd && 'rounded-r-md',
                        isSelectedWeek
                          ? 'bg-zinc-900 text-white font-semibold dark:bg-zinc-100 dark:text-zinc-950'
                          : isHoveredWeek
                            ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                            : cell.isCurrentMonth
                              ? 'text-zinc-800 dark:text-zinc-200'
                              : 'text-zinc-400 dark:text-zinc-600',
                      )}
                    >
                      {cell.dayOfMonth}
                    </button>
                  );
                })}
              </div>
              <div className="pt-1 text-center text-[11px] text-zinc-400">
                点击任意日期选中对应整周
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Year Navigation */}
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  disabled={!canPrevPanelYear}
                  onClick={() => setPanelMonth(panelMonth.subtract(1, 'year'))}
                  className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {panelMonth.year()} 年
                </span>
                <button
                  type="button"
                  onClick={() => setPanelMonth(panelMonth.add(1, 'year'))}
                  className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* 12 Months Grid */}
              <div className="grid grid-cols-3 gap-1.5">
                {MONTHS_ZH.map((label, idx) => {
                  const target = panelMonth.month(idx).startOf('month');
                  const key = target.format('YYYY-MM');
                  const isSelected = key === selectedMonthKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        onChangeDate(clampDateMin(target.format('YYYY-MM-DD')));
                        setOpen(false);
                      }}
                      className={cn(
                        'h-9 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                        isSelected
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                          : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
