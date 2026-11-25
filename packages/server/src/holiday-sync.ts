import type { DatabaseSync } from 'node:sqlite';
import type { HolidayOverride } from '@calendar/shared';
import { replaceHolidays } from './db.js';
import { holidays } from './store.js';

export const MIN_ALLOWED_YEAR = 2026;
export const MIN_ALLOWED_DATE = '2026-01-01';

const SYNC_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

interface HolidayCnPayload {
  year?: number;
  days?: Array<{
    name?: string;
    date?: string;
    isOffDay?: boolean;
  }>;
}

interface HolidaySyncMeta {
  syncedAt?: string;
  failedAt?: string;
  source?: string;
  manual?: boolean;
}

const syncInFlight = new Map<number, Promise<HolidaySyncResult>>();

export interface HolidaySyncResult {
  year: number;
  holidays: HolidayOverride[];
  source: 'github' | 'cache';
  updated: boolean;
  error?: string;
}

function syncMetaKey(year: number) {
  return `holiday_sync_${year}`;
}

function getSyncMeta(db: DatabaseSync, year: number): HolidaySyncMeta | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(syncMetaKey(year)) as
    | { value: string }
    | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value) as HolidaySyncMeta;
  } catch {
    return null;
  }
}

function saveSyncMeta(db: DatabaseSync, year: number, meta: HolidaySyncMeta) {
  db.prepare(
    'INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(syncMetaKey(year), JSON.stringify(meta));
}

export function markHolidayManual(db: DatabaseSync, year: number) {
  const prev = getSyncMeta(db, year) ?? {};
  saveSyncMeta(db, year, {
    ...prev,
    manual: true,
    syncedAt: new Date().toISOString(),
    source: 'manual',
  });
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
          day.date < MIN_ALLOWED_DATE ||
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
      return mapped;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error(`无法从 GitHub 拉取 ${year} 年节假日数据`);
}

export async function syncYearHolidays(
  db: DatabaseSync,
  year: number,
  options: { force?: boolean; fetcher?: (y: number) => Promise<HolidayOverride[]> } = {},
): Promise<HolidaySyncResult> {
  if (year < MIN_ALLOWED_YEAR) {
    return { year, holidays: [], source: 'cache', updated: false };
  }

  const shouldSkipAuto =
    !options.force &&
    (process.env.DISABLE_REMOTE_HOLIDAY_SYNC === '1' || process.env.NODE_ENV === 'test');
  if (shouldSkipAuto) {
    return { year, holidays: holidays(db, year), source: 'cache', updated: false };
  }

  const meta = getSyncMeta(db, year);
  const existing = holidays(db, year);

  // Never overwrite admin manual edits during automatic background/GET sync
  if (!options.force && meta?.manual) {
    return { year, holidays: existing, source: 'cache', updated: false };
  }

  const lastSynced = meta?.syncedAt ? Date.parse(meta.syncedAt) : null;
  if (!options.force && lastSynced !== null && Date.now() - lastSynced < SYNC_TTL_MS && existing.length > 0) {
    return { year, holidays: existing, source: 'cache', updated: false };
  }

  const lastFailed = meta?.failedAt ? Date.parse(meta.failedAt) : null;
  if (!options.force && lastFailed !== null && Date.now() - lastFailed < FAILURE_TTL_MS) {
    return { year, holidays: existing, source: 'cache', updated: false };
  }

  const existingPromise = !options.fetcher ? syncInFlight.get(year) : undefined;
  if (existingPromise) return existingPromise;

  const task = (async (): Promise<HolidaySyncResult> => {
    try {
      const fetcher = options.fetcher ?? fetchYearHolidaysFromGithub;
      const remote = await fetcher(year);
      if (remote.length > 0) {
        // Re-check manual edit guard right before writing to avoid race with concurrent admin PUT
        if (!options.force && getSyncMeta(db, year)?.manual) {
          return { year, holidays: holidays(db, year), source: 'cache', updated: false };
        }
        replaceHolidays(db, remote, year);
        saveSyncMeta(db, year, {
          syncedAt: new Date().toISOString(),
          source: 'github:NateScarlet/holiday-cn',
          manual: false,
        });
        return {
          year,
          holidays: holidays(db, year),
          source: 'github',
          updated: true,
        };
      }
      saveSyncMeta(db, year, {
        ...(getSyncMeta(db, year) ?? {}),
        failedAt: new Date().toISOString(),
      });
      return {
        year,
        holidays: holidays(db, year),
        source: 'cache',
        updated: false,
        error: `GitHub 暂未发布 ${year} 年节假日数据`,
      };
    } catch (err) {
      saveSyncMeta(db, year, {
        ...(getSyncMeta(db, year) ?? {}),
        failedAt: new Date().toISOString(),
      });
      return {
        year,
        holidays: holidays(db, year),
        source: 'cache',
        updated: false,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      if (!options.fetcher) syncInFlight.delete(year);
    }
  })();

  if (!options.fetcher) syncInFlight.set(year, task);
  return task;
}
