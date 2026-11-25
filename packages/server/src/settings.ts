import type { DatabaseSync } from 'node:sqlite';
import { DEFAULT_CN_HOLIDAYS, normalizeWorkSlots } from '@calendar/shared';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireAdmin, type Env } from './auth.js';
import { replaceHolidays } from './db.js';
import { holidays, workSlots } from './store.js';
import { MIN_ALLOWED_DATE, MIN_ALLOWED_YEAR, markHolidayManual, syncYearHolidays } from './holiday-sync.js';
import { holidayResetBody, holidaySettings, holidaySyncBody, slotSettings, yearQuery } from './validation.js';

export function settingsRoutes(db: DatabaseSync) {
  const app = new Hono<Env>();
  app.get('/settings/work-slots', c => c.json({ slots: workSlots(db) }));
  app.put('/settings/work-slots', requireAdmin, async c => {
    const input = slotSettings.parse(await c.req.json());
    const slots = normalizeWorkSlots(input.slots);
    if (new Set(slots.map(s => s.id)).size !== slots.length) throw new HTTPException(400, { message: '工作时段标识不得重复' });
    if (slots.some((s, i) => s.startTime >= s.endTime || (i > 0 && s.startTime < slots[i - 1].endTime))) {
      throw new HTTPException(400, { message: '工作时段必须有正时长且不得重叠' });
    }
    db.prepare("UPDATE settings SET value = ? WHERE key = 'workSlots'").run(JSON.stringify(slots));
    return c.json({ slots });
  });
  app.get('/settings/holidays', async c => {
    const { year } = yearQuery.parse(c.req.query());
    const targetYear = year ?? Math.max(MIN_ALLOWED_YEAR, new Date().getFullYear());
    await syncYearHolidays(db, targetYear);
    return c.json({ holidays: holidays(db, year) });
  });
  app.put('/settings/holidays', requireAdmin, async c => {
    const input = holidaySettings.parse(await c.req.json());
    const dates = input.holidays.map(h => h.date);
    if (new Set(dates).size !== dates.length) throw new HTTPException(400, { message: '节假日日期不得重复' });
    if (input.year !== undefined && dates.some(d => !d.startsWith(`${input.year}-`))) {
      throw new HTTPException(400, { message: '节假日日期必须属于指定年份' });
    }
    replaceHolidays(db, input.holidays, input.year);
    if (input.year !== undefined) {
      markHolidayManual(db, input.year);
    } else {
      const touchedYears = new Set(input.holidays.map(h => Number(h.date.slice(0, 4))));
      for (const y of touchedYears) markHolidayManual(db, y);
    }
    return c.json({ holidays: holidays(db, input.year) });
  });
  app.post('/settings/holidays/sync', requireAdmin, async c => {
    const rawText = (await c.req.text()).trim();
    let raw: unknown = {};
    if (rawText) {
      try {
        raw = JSON.parse(rawText);
      } catch {
        throw new HTTPException(400, { message: '请求体 JSON 格式错误' });
      }
    }
    const { year } = holidaySyncBody.parse(raw);
    const targetYear = year ?? Math.max(MIN_ALLOWED_YEAR, new Date().getFullYear());
    const result = await syncYearHolidays(db, targetYear, { force: true });
    if (!result.updated) {
      throw new HTTPException(502, {
        message: `从 GitHub 拉取 ${targetYear} 年节假日失败（可能尚未发布或网络不可达）：${result.error ?? '无可用数据'}`,
      });
    }
    return c.json(result);
  });
  app.post('/settings/holidays/reset', requireAdmin, async c => {
    const rawText = (await c.req.text()).trim();
    let raw: unknown = {};
    if (rawText) {
      try {
        raw = JSON.parse(rawText);
      } catch {
        throw new HTTPException(400, { message: '请求体 JSON 格式错误' });
      }
    }
    const { year } = holidayResetBody.parse(raw);
    if (year !== undefined) {
      const defaultsForYear = DEFAULT_CN_HOLIDAYS.filter(h => h.date.startsWith(`${year}-`) && h.date >= MIN_ALLOWED_DATE);
      replaceHolidays(db, defaultsForYear, year);
      markHolidayManual(db, year);
      return c.json({ holidays: holidays(db, year) });
    }
    replaceHolidays(db, DEFAULT_CN_HOLIDAYS.filter(h => h.date >= MIN_ALLOWED_DATE));
    return c.json({ holidays: holidays(db) });
  });
  return app;
}
