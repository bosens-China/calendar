import type { CalendarDb } from './db.js';
import { computePeriodSummary } from '@calendar/shared';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireAdmin, requireOwner, scopedMember, type Env } from './auth.js';
import { transaction } from './db.js';
import { syncYearHolidays } from './holiday-sync.js';
import { getById, holidays, insert, listMembers, listProjects, listSchedule, remove, update, workSlots } from './store.js';
import { adjustment, checkDates, checkSpan, checkSummarySpan, leaveCreate, leavePatch, leaveQuery, summaryQuery, taskCreate, taskPatch, taskQuery } from '@calendar/shared';

export function scheduleRoutes(db: CalendarDb) {
  const app = new Hono<Env>();
  app.get('/tasks', c => {
    const q = taskQuery.parse(c.req.query());
    checkDates(q);
    return c.json(listSchedule(db, 'tasks', { ...q, memberId: scopedMember(c.get('user'), q.assigneeId) }));
  });
  app.post('/tasks', requireAdmin, async c => {
    const data = taskCreate.parse(await c.req.json());
    checkSpan(data);
    return c.json(insert(db, 'tasks', { ...data, adjustedByMember: false, createdBy: c.get('user').id }), 201);
  });
  app.patch('/tasks/:id', async c => {
    const body: unknown = await c.req.json();
    const user = c.get('user');
    const result = transaction(db, db => {
      const task = getById(db, 'tasks', c.req.param('id'));
      requireOwner(user, task.assigneeId);
      const fields = taskPatch.parse(body);
      if (user.role === 'member' && !adjustment.safeParse(fields).success) {
        throw new HTTPException(403, { message: '成员仅可修改状态、备注和起止时间' });
      }
      checkSpan({ ...task, ...fields });
      return update(db, 'tasks', task.id, user.role === 'member' ? { ...fields, adjustedByMember: true } : fields);
    });
    return c.json(result);
  });
  app.delete('/tasks/:id', requireAdmin, c => {
    remove(db, 'tasks', c.req.param('id'));
    return c.json({ ok: true });
  });
  app.get('/leaves', c => {
    const q = leaveQuery.parse(c.req.query());
    checkDates(q);
    return c.json(listSchedule(db, 'leaves', { ...q, memberId: scopedMember(c.get('user'), q.memberId) }));
  });
  app.post('/leaves', async c => {
    const data = leaveCreate.parse(await c.req.json());
    checkSpan(data);
    const user = c.get('user');
    const memberId = scopedMember(user, data.memberId) ?? user.id;
    return c.json(insert(db, 'leaves', { ...data, memberId, createdBy: user.id }), 201);
  });
  app.patch('/leaves/:id', async c => {
    const body: unknown = await c.req.json();
    const user = c.get('user');
    const result = transaction(db, db => {
      const leave = getById(db, 'leaves', c.req.param('id'));
      requireOwner(user, leave.memberId);
      const fields = leavePatch.parse(body);
      if (fields.memberId !== undefined) requireOwner(user, fields.memberId);
      checkSpan({ ...leave, ...fields });
      return update(db, 'leaves', leave.id, fields);
    });
    return c.json(result);
  });
  app.delete('/leaves/:id', c => {
    transaction(db, db => {
      const leave = getById(db, 'leaves', c.req.param('id'));
      requireOwner(c.get('user'), leave.memberId);
      remove(db, 'leaves', leave.id);
    });
    return c.json({ ok: true });
  });
  app.get('/summary', async c => {
    const q = summaryQuery.parse(c.req.query());
    checkDates(q);
    checkSummarySpan(q.startDate, q.endDate);
    const startYear = Number(q.startDate.slice(0, 4));
    const endYear = Number(q.endDate.slice(0, 4));
    for (let y = startYear; y <= endYear; y++) {
      await syncYearHolidays(db, y);
    }
    const memberId = scopedMember(c.get('user'), q.memberId);
    const filters = { ...q, memberId };
    return c.json(computePeriodSummary({
      startDate: q.startDate, endDate: q.endDate,
      members: listMembers(db, memberId), projects: listProjects(db).filter(p => !q.projectId || p.id === q.projectId),
      tasks: listSchedule(db, 'tasks', filters), leaves: listSchedule(db, 'leaves', filters),
      workSlots: workSlots(db), holidays: holidays(db),
    }));
  });
  return app;
}
