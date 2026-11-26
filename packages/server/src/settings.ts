import { randomUUID } from 'node:crypto';
import type { CalendarDb } from './db.js';
import {
  calendarDate, DEFAULT_CN_HOLIDAYS, DEFAULT_WORK_SLOTS, getCalendarYear, holidayFields,
  holidayResetBody, holidaySettings, holidaySyncBody, resetBody, roleLabelsSchema,
  validateWorkSlots, yearQuery,
} from '@calendar/shared';
import { and, eq, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireAdmin, type Env } from './auth.js';
import { transaction } from './db.js';
import { holidays, replaceHolidays, saveSetting, workSlots } from './store.js';
import {
  holidays as holidayTable, invitations as invitationTable, leaves as leaveTable,
  members as memberTable, projects as projectTable, settings as settingTable, tasks as taskTable,
} from './schema.js';
import { readRoleLabels } from './role-labels.js';
import { MIN_ALLOWED_DATE, MIN_ALLOWED_YEAR, markHolidayManual, syncYearHolidays } from './holiday-sync.js';

export function settingsRoutes(db: CalendarDb) {
  const app = new Hono<Env>();
  app.get('/settings/role-labels', c => c.json(readRoleLabels(db)));
  app.put('/settings/role-labels', requireAdmin, async c => {
    const labels = roleLabelsSchema.parse(await c.req.json());
    saveSetting(db, 'roleLabels', JSON.stringify(labels));
    return c.json(labels);
  });
  app.get('/settings/work-slots', c => c.json({ slots: workSlots(db) }));
  app.put('/settings/work-slots', requireAdmin, async c => {
    const slots = validateWorkSlots(await c.req.json());
    saveSetting(db, 'workSlots', JSON.stringify(slots));
    return c.json({ slots });
  });
  app.get('/settings/holidays', async c => {
    const { year } = yearQuery.parse(c.req.query());
    const targetYear = year ?? Math.max(MIN_ALLOWED_YEAR, getCalendarYear());
    await syncYearHolidays(db, targetYear);
    return c.json({ holidays: holidays(db, year) });
  });
  app.put('/settings/holidays/:date', requireAdmin, async c => {
    const date = calendarDate.parse(c.req.param('date'));
    const fields = holidayFields.parse(await c.req.json());
    transaction(db, db => {
      db.insert(holidayTable).values({ date, ...fields })
        .onConflictDoUpdate({ target: holidayTable.date, set: fields }).run();
      markHolidayManual(db, Number(date.slice(0, 4)));
    });
    return c.json({ data: { date, ...fields }, code: 'OK', message: '' });
  });
  app.delete('/settings/holidays/:date', requireAdmin, c => {
    const date = calendarDate.parse(c.req.param('date'));
    transaction(db, db => {
      db.delete(holidayTable).where(eq(holidayTable.date, date)).run();
      markHolidayManual(db, Number(date.slice(0, 4)));
    });
    return c.json({ data: null, code: 'OK', message: '' });
  });
  app.put('/settings/holidays', requireAdmin, async c => {
    const input = holidaySettings.parse(await c.req.json());
    const dates = input.holidays.map(h => h.date);
    if (new Set(dates).size !== dates.length) throw new HTTPException(400, { message: '节假日日期不得重复' });
    if (input.year !== undefined && dates.some(d => !d.startsWith(`${input.year}-`))) {
      throw new HTTPException(400, { message: '节假日日期必须属于指定年份' });
    }
    transaction(db, db => {
      const touchedYears = input.year !== undefined ? [input.year] : new Set(
        [...holidays(db), ...input.holidays].map(h => Number(h.date.slice(0, 4))),
      );
      replaceHolidays(db, input.holidays, input.year);
      for (const year of touchedYears) markHolidayManual(db, year);
    });
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
    const targetYear = year ?? Math.max(MIN_ALLOWED_YEAR, getCalendarYear());
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
      transaction(db, db => {
        replaceHolidays(db, defaultsForYear, year);
        markHolidayManual(db, year);
      });
      return c.json({ holidays: holidays(db, year) });
    }
    transaction(db, db => {
      const defaults = DEFAULT_CN_HOLIDAYS.filter(h => h.date >= MIN_ALLOWED_DATE);
      const touchedYears = new Set([...holidays(db), ...defaults].map(h => Number(h.date.slice(0, 4))));
      replaceHolidays(db, defaults);
      for (const touchedYear of touchedYears) markHolidayManual(db, touchedYear);
    });
    return c.json({ holidays: holidays(db) });
  });
  app.post('/settings/reset', async c => {
    const { scope } = resetBody.parse(await c.req.json());
    const user = c.get('user');
    if (scope !== 'personal' && user.role !== 'admin') {
      throw new HTTPException(403, { message: '需要管理员权限' });
    }
    transaction(db, tx => {
      const actor = tx.select({ id: memberTable.id, role: memberTable.role, active: memberTable.active })
        .from(memberTable)
        .where(eq(memberTable.id, user.id))
        .get();
      if (!actor || !actor.active) {
        throw new HTTPException(401, { message: '登录凭证无效或已过期' });
      }
      if (scope !== 'personal' && actor.role !== 'admin') {
        throw new HTTPException(403, { message: '需要管理员权限' });
      }
      if (scope === 'personal') {
        tx.delete(leaveTable).where(and(eq(leaveTable.memberId, user.id), eq(leaveTable.createdBy, user.id))).run();
        return;
      }
      tx.delete(taskTable).run();
      tx.delete(leaveTable).run();
      if (scope === 'factory') {
        const now = new Date().toISOString();
        tx.delete(invitationTable).run();
        tx.delete(projectTable).run();
        tx.insert(projectTable).values([
          { name: '核心研发', color: '#1677ff' },
          { name: '运维支持', color: '#13a8a8' },
        ].map(project => ({
          ...project, id: randomUUID(), description: '', archived: false, createdAt: now, updatedAt: now,
        }))).run();
        tx.delete(memberTable).where(ne(memberTable.id, user.id)).run();
        tx.delete(settingTable).where(ne(settingTable.key, 'jwtSecret')).run();
        tx.insert(settingTable).values({ key: 'workSlots', value: JSON.stringify(DEFAULT_WORK_SLOTS) }).run();
        replaceHolidays(tx, DEFAULT_CN_HOLIDAYS.filter(day => day.date >= MIN_ALLOWED_DATE));
      }
    });
    return c.json({ scope });
  });
  return app;
}
