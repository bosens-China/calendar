import type { HolidayOverride } from './types.js';
import { calendarDate } from './validation.js';

const FETCH_TIMEOUT_MS = 5000;

interface HolidayCnPayload {
  year?: number;
  days?: Array<{
    name?: string;
    date?: string;
    isOffDay?: boolean;
  }>;
}

export async function fetchYearHolidaysFromGithub(year: number): Promise<HolidayOverride[]> {
  const urls = [
    `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`,
    `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`,
  ];

  let lastError: Error | null = null;
  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} from ${url}`);
        continue;
      }
      const data = (await res.json()) as HolidayCnPayload;
      if (!Array.isArray(data.days)) {
        lastError = new Error(`Invalid holiday payload from ${url}`);
        continue;
      }
      const seen = new Set<string>();
      const mapped: HolidayOverride[] = [];
      for (const day of data.days) {
        if (
          typeof day.date !== 'string' ||
          !day.date.startsWith(`${year}-`) ||
          !calendarDate.safeParse(day.date).success ||
          typeof day.name !== 'string' ||
          typeof day.isOffDay !== 'boolean' ||
          seen.has(day.date)
        ) {
          continue;
        }
        seen.add(day.date);
        mapped.push({
          date: day.date,
          name: day.name.trim() || (day.isOffDay ? '节假日' : '调休补班'),
          kind: day.isOffDay ? 'holiday' : 'workday',
        });
      }
      if (mapped.length > 0) return mapped;
      lastError = new Error(`No holiday data for ${year}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error(`无法从 GitHub 拉取 ${year} 年节假日数据`);
}
