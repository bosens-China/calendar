import type { CalendarDb } from './db.js';
import { fetchYearHolidaysFromGithub, type HolidayOverride } from '@calendar/shared';
import { transaction } from './db.js';
import { getSetting, holidays, replaceHolidays, saveSetting } from './store.js';

export const MIN_ALLOWED_YEAR = 2026;
export const MIN_ALLOWED_DATE = '2026-01-01';

const SYNC_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 10 * 60 * 1000;

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

function getSyncMeta(db: CalendarDb, year: number): HolidaySyncMeta | null {
  const value = getSetting(db, syncMetaKey(year));
  if (!value) return null;
  try {
    return JSON.parse(value) as HolidaySyncMeta;
  } catch {
    return null;
  }
}

function saveSyncMeta(db: CalendarDb, year: number, meta: HolidaySyncMeta) {
  saveSetting(db, syncMetaKey(year), JSON.stringify(meta));
}

export function markHolidayManual(db: CalendarDb, year: number) {
  const prev = getSyncMeta(db, year) ?? {};
  saveSyncMeta(db, year, {
    ...prev,
    manual: true,
    syncedAt: new Date().toISOString(),
    source: 'manual',
  });
}

export async function syncYearHolidays(
  db: CalendarDb,
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
        return transaction(db, db => {
          if (!options.force && getSyncMeta(db, year)?.manual) {
            return { year, holidays: holidays(db, year), source: 'cache', updated: false };
          }
          replaceHolidays(db, remote, year);
          saveSyncMeta(db, year, {
            syncedAt: new Date().toISOString(), source: 'github:NateScarlet/holiday-cn', manual: false,
          });
          return { year, holidays: holidays(db, year), source: 'github', updated: true };
        });
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
