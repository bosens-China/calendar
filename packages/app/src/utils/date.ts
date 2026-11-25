import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekday from 'dayjs/plugin/weekday';
import 'dayjs/locale/zh-cn';

dayjs.extend(isoWeek);
dayjs.extend(weekday);
dayjs.locale('zh-cn');

export { dayjs };

export const MIN_ALLOWED_YEAR = 2026;
export const MIN_ALLOWED_DATE = '2026-01-01';
export const MIN_ALLOWED_DAYJS = dayjs(MIN_ALLOWED_DATE);

export function clampDateMin(dateStr: string): string {
  return dateStr < MIN_ALLOWED_DATE ? MIN_ALLOWED_DATE : dateStr;
}

export function disableBefore2026(current: dayjs.Dayjs): boolean {
  return current.isBefore(MIN_ALLOWED_DAYJS, 'day');
}

export function canNavigatePrev(dateStr: string, period: 'week' | 'month'): boolean {
  const d = dayjs(dateStr);
  const prevEnd =
    period === 'week'
      ? d.subtract(1, 'week').endOf('isoWeek')
      : d.subtract(1, 'month').endOf('month');
  return !prevEnd.isBefore(MIN_ALLOWED_DAYJS, 'day');
}

export function getWeekRange(dateStr: string): { startDate: string; endDate: string; dates: string[] } {
  const d = dayjs(dateStr);
  const start = d.startOf('isoWeek');
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    dates.push(start.add(i, 'day').format('YYYY-MM-DD'));
  }
  return {
    startDate: dates[0],
    endDate: dates[6],
    dates,
  };
}

export function getMonthRange(dateStr: string): { startDate: string; endDate: string; dates: string[] } {
  const d = dayjs(dateStr);
  const start = d.startOf('month');
  const end = d.endOf('month');
  const count = end.date();
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    dates.push(start.add(i, 'day').format('YYYY-MM-DD'));
  }
  return {
    startDate: start.format('YYYY-MM-DD'),
    endDate: end.format('YYYY-MM-DD'),
    dates,
  };
}

export function getWeekDates(dateStr: string): string[] {
  return getWeekRange(dateStr).dates;
}

export function getMonthDates(dateStr: string): string[] {
  return getMonthRange(dateStr).dates;
}

export function getWeekDateRange(dateStr: string): { startDate: string; endDate: string } {
  const { startDate, endDate } = getWeekRange(dateStr);
  return { startDate, endDate };
}

export function getMonthDateRange(dateStr: string): { startDate: string; endDate: string } {
  const { startDate, endDate } = getMonthRange(dateStr);
  return { startDate, endDate };
}


/**
 * Returns a 42-cell or 35-cell grid for traditional month calendar (starting Monday)
 */
export function getCalendarGridDays(dateStr: string): Array<{
  date: string;
  isCurrentMonth: boolean;
  dayOfMonth: number;
  dayOfWeek: number;
}> {
  const current = dayjs(dateStr);
  const firstOfMonth = current.startOf('month');
  const lastOfMonth = current.endOf('month');

  // day() returns 0 for Sunday, 1 for Monday... 6 for Saturday
  // isoWeekday() returns 1 for Monday ... 7 for Sunday
  const startIsoWeekday = firstOfMonth.isoWeekday(); // 1 = Monday
  const prefixDays = startIsoWeekday - 1;

  const days: Array<{
    date: string;
    isCurrentMonth: boolean;
    dayOfMonth: number;
    dayOfWeek: number;
  }> = [];

  // Prefix previous month days
  for (let i = prefixDays; i > 0; i--) {
    const d = firstOfMonth.subtract(i, 'day');
    days.push({
      date: d.format('YYYY-MM-DD'),
      isCurrentMonth: false,
      dayOfMonth: d.date(),
      dayOfWeek: d.isoWeekday(),
    });
  }

  // Current month days
  const totalDaysInMonth = lastOfMonth.date();
  for (let i = 1; i <= totalDaysInMonth; i++) {
    const d = firstOfMonth.date(i);
    days.push({
      date: d.format('YYYY-MM-DD'),
      isCurrentMonth: true,
      dayOfMonth: i,
      dayOfWeek: d.isoWeekday(),
    });
  }

  // Suffix next month days to complete full weeks (multiples of 7, up to 35 or 42)
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = lastOfMonth.add(i, 'day');
    days.push({
      date: d.format('YYYY-MM-DD'),
      isCurrentMonth: false,
      dayOfMonth: d.date(),
      dayOfWeek: d.isoWeekday(),
    });
  }

  return days;
}

export function formatPeriodHeader(dateStr: string, period: 'week' | 'month'): string {
  const d = dayjs(dateStr);
  if (period === 'month') {
    return d.format('YYYY年MM月');
  }
  const start = d.startOf('isoWeek');
  const end = d.endOf('isoWeek');
  const weekNum = d.isoWeek();
  if (start.month() === end.month()) {
    return `${start.format('YYYY年MM月DD日')} - ${end.format('DD日')} (第${weekNum}周)`;
  }
  return `${start.format('YYYY年MM月DD日')} - ${end.format('MM月DD日')} (第${weekNum}周)`;
}

export const WEEKDAY_NAMES_ZH = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
export const SHORT_WEEKDAY_NAMES_ZH = ['一', '二', '三', '四', '五', '六', '日'];
