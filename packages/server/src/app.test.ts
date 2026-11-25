import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import { DEFAULT_CN_HOLIDAYS, DEFAULT_WORK_SLOTS, type Task, type Member, type PeriodSummaryResponse } from '@calendar/shared';
import { createApp } from './app.js';
import { createDb } from './db.js';

const span = { startDate: '2026-03-02', startTime: '09:00', endDate: '2026-03-02', endTime: '12:00' };

async function fixture(t: TestContext) {
  const db = createDb(':memory:');
  t.after(() => db.close());
  const app = createApp(db);
  async function request(method: string, path: string, token?: string, body?: unknown, expected = 200) {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const res = await app.request(`/api${path}`, { method, headers, body: JSON.stringify(body) });
    const json = await res.json();
    assert.equal(res.status, expected, `${method} ${path} ${JSON.stringify(json)}`);
    if (expected >= 400) {
      assert.deepEqual(Object.keys(json), ['error']);
      assert.equal(typeof json.error, 'string');
    }
    return json;
  }
  const login = (username: string, password: string, expected = 200) => request('POST', '/auth/login', undefined, { username, password }, expected);
  const { user: admin, token }: { user: Member; token: string } = await login('admin', 'admin123');
  const projects = await request('GET', '/projects', token);
  async function newMember(username: string) {
    const user: Member = await request('POST', '/members', token, { name: username, username, password: 'secret1', role: 'member' }, 201);
    const { token: memberToken } = await login(username, 'secret1');
    return { user, token: memberToken as string };
  }
  async function newTask(assigneeId: string, extra = {}): Promise<Task> {
    return request('POST', '/tasks', token, { ...span, projectId: projects[0].id, assigneeId, title: '研发', ...extra }, 201);
  }
  return { app, db, request, login, admin, token, projects, newMember, newTask };
}

test('登录、JWT 和 CORS，受保护路由返回 JSON 错误', async t => {
  const f = await fixture(t);
  assert.deepEqual(await f.request('GET', '/health'), { ok: true });
  assert.equal(f.admin.name, '管理员');
  assert.equal(f.admin.role, 'admin');
  assert.ok(!('passwordHash' in f.admin));
  assert.deepEqual(await f.request('GET', '/auth/me', f.token), { user: f.admin });
  assert.equal(decodeProtectedHeader(f.token).alg, 'HS256');
  const payload = decodeJwt(f.token);
  assert.equal(payload.exp! - payload.iat!, 7 * 24 * 3600);
  await f.login('admin', 'incorrect', 401);
  await f.request('GET', '/members', undefined, undefined, 401);
  await f.request('GET', '/tasks', 'invalid', undefined, 401);
  await f.request('GET', '/missing', f.token, undefined, 404);
  const invalid = await f.app.request('/api/auth/login', { method: 'POST', body: '{' });
  assert.equal(invalid.status, 400);
  assert.deepEqual(Object.keys(await invalid.json()), ['error']);
  const preflight = await f.app.request('/api/tasks', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'PATCH' } });
  assert.equal(preflight.status, 204);
  assert.ok(preflight.headers.get('access-control-allow-origin'));
});

test('成员和项目管理、密码变更、启停以及最后一个管理员保护', async t => {
  const f = await fixture(t);
  const m = await f.newMember('member');
  assert.deepEqual(await f.request('GET', '/members', m.token), [m.user]);
  assert.equal((await f.request('GET', '/members', f.token)).length, 2);
  await f.request('POST', '/members', f.token, { username: 'member', password: 'password123', name: '重名', role: 'member' }, 409);
  assert.deepEqual(f.projects.map((p: { name: string }) => p.name), ['核心研发', '运维支持']);
  assert.deepEqual(await f.request('GET', '/projects', m.token), f.projects);
  for (const [method, path] of [
    ['POST', '/members'], ['PATCH', `/members/${m.user.id}`], ['DELETE', `/members/${f.admin.id}`],
    ['POST', `/members/${f.admin.id}/reset-password`], ['POST', '/projects'], ['PATCH', `/projects/${f.projects[0].id}`], ['DELETE', `/projects/${f.projects[0].id}`],
  ]) await f.request(method, path, m.token, undefined, 403);
  await f.request('DELETE', `/members/${f.admin.id}`, f.token, undefined, 400);
  for (const patch of [{ role: 'member' }, { active: false }]) await f.request('PATCH', `/members/${f.admin.id}`, f.token, patch, 400);
  const project = await f.request('POST', '/projects', f.token, { name: '临时' }, 201);
  assert.equal((await f.request('PATCH', `/projects/${project.id}`, f.token, { archived: true })).archived, true);
  await f.request('DELETE', `/projects/${project.id}`, f.token);
  await f.request('DELETE', `/projects/${project.id}`, f.token, undefined, 404);
  await f.request('POST', '/auth/change-password', m.token, { oldPassword: 'wrong', newPassword: 'newpassword' }, 400);
  await f.request('POST', '/auth/change-password', m.token, { oldPassword: 'secret1', newPassword: 'newpassword' });
  await f.login('member', 'secret1', 401);
  await f.login('member', 'newpassword');
  await f.request('POST', `/members/${m.user.id}/reset-password`, f.token, { newPassword: 'resetpwd' });
  await f.login('member', 'newpassword', 401);
  await f.login('member', 'resetpwd');
  await f.request('PATCH', `/members/${m.user.id}`, f.token, { active: false });
  await f.request('GET', '/auth/me', m.token, undefined, 401);
  await f.login('member', 'resetpwd', 401);
  await f.request('DELETE', `/members/${m.user.id}`, f.token);
  assert.deepEqual(await f.request('GET', '/members', f.token), [f.admin]);
});

test('任务筛选含跨日交集，成员仅可查看和微调自己的任务', async t => {
  const f = await fixture(t);
  const m = await f.newMember('member');
  const own = await f.newTask(m.user.id, { endDate: '2026-03-04' });
  const other = await f.newTask(f.admin.id, { projectId: f.projects[1].id });
  assert.equal((await f.request('GET', '/tasks', f.token)).length, 2);
  assert.deepEqual(await f.request('GET', `/tasks?assigneeId=${f.admin.id}`, m.token), [own]);
  assert.deepEqual(await f.request('GET', `/tasks?projectId=${other.projectId}&assigneeId=${f.admin.id}&status=todo`, f.token), [other]);
  assert.deepEqual(await f.request('GET', '/tasks?startDate=2026-03-03&endDate=2026-03-03', f.token), [own]);
  assert.deepEqual(await f.request('GET', '/tasks?status=done', f.token), []);
  await f.request('POST', '/tasks', m.token, undefined, 403);
  await f.request('DELETE', `/tasks/${own.id}`, m.token, undefined, 403);
  await f.request('PATCH', `/tasks/${other.id}`, m.token, { status: 'done' }, 403);
  for (const patch of [{ title: 'x' }, { priority: 'high' }, { projectId: other.projectId }, { assigneeId: f.admin.id }]) {
    await f.request('PATCH', `/tasks/${own.id}`, m.token, patch, 403);
  }
  await f.request('PATCH', `/tasks/${own.id}`, m.token, { startDate: '2026-03-05' }, 400);
  const patch = { status: 'in_progress', description: '更新', startDate: '2026-03-03', endDate: '2026-03-03', startTime: '11:00', endTime: '12:00' };
  const result = await f.request('PATCH', `/tasks/${own.id}`, m.token, patch);
  assert.deepEqual(result, { ...own, ...patch, adjustedByMember: true, updatedAt: result.updatedAt });
  await f.request('DELETE', `/projects/${own.projectId}`, f.token, undefined, 400);
  await f.request('PATCH', `/tasks/${own.id}`, f.token, { assigneeId: 'missing' }, 400);
  await f.request('PATCH', `/tasks/${own.id}`, f.token, { title: '转移', projectId: other.projectId, assigneeId: f.admin.id });
  assert.deepEqual(await f.request('GET', '/tasks', m.token), []);
  await f.request('DELETE', `/projects/${own.projectId}`, f.token);
  await f.request('DELETE', `/tasks/${own.id}`, f.token);
});

test('管理员代填和成员自助请假，隔离读写、归属以及日期筛选', async t => {
  const f = await fixture(t);
  const m = await f.newMember('member');
  const own = await f.request('POST', '/leaves', m.token, { ...span, type: 'annual', memberId: f.admin.id }, 201);
  assert.equal(own.memberId, m.user.id);
  const assigned = await f.request('POST', '/leaves', f.token, { ...span, type: 'sick', memberId: m.user.id, endDate: '2026-03-04' }, 201);
  assert.equal(assigned.createdBy, f.admin.id);
  const other = await f.request('POST', '/leaves', f.token, { ...span, type: 'other' }, 201);
  assert.equal(other.memberId, f.admin.id);
  assert.deepEqual(await f.request('GET', `/leaves?memberId=${f.admin.id}`, m.token), [own, assigned]);
  assert.deepEqual(await f.request('GET', `/leaves?memberId=${f.admin.id}`, f.token), [other]);
  assert.deepEqual(await f.request('GET', '/leaves?startDate=2026-03-03&endDate=2026-03-03', m.token), [assigned]);
  await f.request('PATCH', `/leaves/${other.id}`, m.token, { type: 'personal' }, 403);
  await f.request('DELETE', `/leaves/${other.id}`, m.token, undefined, 403);
  await f.request('PATCH', `/leaves/${own.id}`, m.token, { memberId: f.admin.id }, 403);
  await f.request('PATCH', `/leaves/${own.id}`, m.token, { endTime: '08:30' }, 400);
  assert.equal((await f.request('PATCH', `/leaves/${own.id}`, m.token, { reason: '更新' })).reason, '更新');
  await f.request('PATCH', `/leaves/${assigned.id}`, f.token, { memberId: f.admin.id });
  await f.request('DELETE', `/leaves/${own.id}`, m.token);
  await f.request('DELETE', `/leaves/${assigned.id}`, f.token);
  assert.deepEqual(await f.request('GET', '/leaves', m.token), []);
});

test('工作时段无重叠，节假日按年或全量替换及重置', async t => {
  const f = await fixture(t);
  const m = await f.newMember('member');
  const slotsPath = '/settings/work-slots';
  const holidayPath = '/settings/holidays';
  assert.deepEqual(await f.request('GET', slotsPath, m.token), { slots: DEFAULT_WORK_SLOTS });
  await f.request('PUT', slotsPath, m.token, {}, 403);
  await f.request('PUT', holidayPath, m.token, {}, 403);
  await f.request('POST', `${holidayPath}/reset`, m.token, undefined, 403);
  const slot = DEFAULT_WORK_SLOTS[0];
  for (const slots of [[], [slot, slot], [slot, { ...slot, id: 'x' }], [{ ...slot, endTime: '07:00' }], [{ ...slot, startTime: '25:00' }]]) {
    await f.request('PUT', slotsPath, f.token, { slots }, 400);
  }
  assert.deepEqual(await f.request('GET', slotsPath, m.token), { slots: DEFAULT_WORK_SLOTS });
  const next = { ...slot, id: 'next', startTime: slot.endTime, endTime: '15:00' };
  assert.deepEqual(await f.request('PUT', slotsPath, f.token, { slots: [next, slot] }), { slots: [slot, next] });
  const holiday = { date: '2026-03-02', kind: 'holiday', name: '自定义' };
  const nextYear = DEFAULT_CN_HOLIDAYS.filter(h => h.date.startsWith('2027-'));
  await f.request('PUT', holidayPath, f.token, { year: 2026, holidays: [holiday] });
  for (const body of [{ year: 2025, holidays: [holiday] }, { year: 2027, holidays: [holiday] }, { holidays: [holiday, holiday] }, { holidays: [{ ...holiday, date: '2026-02-30' }] }]) {
    await f.request('PUT', holidayPath, f.token, body, 400);
  }
  await f.request('GET', `${holidayPath}?year=2025`, m.token, undefined, 400);
  assert.deepEqual(await f.request('GET', `${holidayPath}?year=2026`, m.token), { holidays: [holiday] });
  assert.deepEqual(await f.request('GET', `${holidayPath}?year=2027`, m.token), { holidays: nextYear });
  await f.request('PUT', holidayPath, f.token, { holidays: [] });
  assert.deepEqual(await f.request('GET', holidayPath, m.token), { holidays: [] });
  const expectedReset = DEFAULT_CN_HOLIDAYS.filter(h => h.date >= '2026-01-01');
  assert.deepEqual(await f.request('POST', `${holidayPath}/reset`, f.token), { holidays: expectedReset });
});

test('周/月统计扣除请假、按并集计算排期并隔离项目和人员明细', async t => {
  const f = await fixture(t);
  const m = await f.newMember('member');
  const a = await f.newTask(m.user.id, { status: 'done' });
  await f.newTask(m.user.id, { projectId: f.projects[1].id, startTime: '11:00' });
  await f.newTask(f.admin.id, { endTime: '18:00' });
  await f.request('POST', '/leaves', m.token, { ...span, type: 'annual', endTime: '10:00' }, 201);
  for (const [startDate, endDate, weekdays] of [
    ['2026-03-02', '2026-03-08', 5], ['2026-03-01', '2026-03-31', 22],
  ] as const) {
    const path = `/summary?startDate=${startDate}&endDate=${endDate}`;
    const summary: PeriodSummaryResponse = await f.request('GET', `${path}&memberId=${f.admin.id}`, m.token);
    assert.equal(summary.startDate, startDate);
    assert.equal(summary.endDate, endDate);
    assert.deepEqual(summary.members.map(v => v.member.id), [m.user.id]);
    assert.equal(summary.members[0].leaveMinutes, 60);
    assert.equal(summary.members[0].statusCounts.done, 1);
    assert.equal(summary.members[0].taskCount, 2);
    assert.equal(summary.totalExpectedMinutes, weekdays * 450 - 60);
    assert.equal(summary.totalScheduledMinutes, 120);
    assert.equal(summary.totalGapMinutes, weekdays * 450 - 180);
    assert.ok(summary.projects.every(p => p.byMember.every(entry => entry.memberId === m.user.id)));
    const all = await f.request('GET', path, f.token);
    assert.equal(all.totalScheduledMinutes, 450 + 120);
    assert.equal(all.totalExpectedMinutes, weekdays * 900 - 60);
    const filtered = await f.request('GET', `${path}&projectId=${a.projectId}&memberId=${m.user.id}`, f.token);
    assert.deepEqual(filtered.members[0].tasks, [a]);
    assert.equal(filtered.projects.length, 1);
    assert.equal(filtered.projects[0].totalMinutes, 120);
  }
  const sunday = '2026-03-08';
  const sundaySummary = `/summary?startDate=${sunday}&endDate=${sunday}`;
  await f.newTask(m.user.id, { startDate: sunday, endDate: sunday });
  assert.equal((await f.request('GET', sundaySummary, m.token)).totalExpectedMinutes, 0);
  await f.request('PUT', '/settings/holidays', f.token, {
    year: 2026, holidays: [{ date: sunday, kind: 'workday', name: '补班' }],
  });
  await f.request('PUT', '/settings/work-slots', f.token, {
    slots: [{ id: 'short', label: '短班', startTime: '10:00', endTime: '13:00' }],
  });
  const sundayResult = await f.request('GET', sundaySummary, m.token);
  assert.equal(sundayResult.totalExpectedMinutes, 180);
  assert.equal(sundayResult.totalScheduledMinutes, 120);
  assert.equal(sundayResult.totalGapMinutes, 60);
  await f.request('GET', '/summary?startDate=2026-03-31&endDate=2026-03-01', f.token, undefined, 400);
  await f.request('GET', '/summary', f.token, undefined, 400);
});

test('SQLite 重新打开保留账号、时段及已清空的节假日和示例项目', t => {
  const dir = mkdtempSync(join(tmpdir(), 'calendar-api-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'nested', 'calendar.db');
  const first = createDb(path);
  const admin = first.prepare('SELECT id, passwordHash FROM members').get() as { id: string; passwordHash: string };
  assert.match(admin.passwordHash, /^\$2/);
  const slots = JSON.stringify([DEFAULT_WORK_SLOTS[0]]);
  first.prepare("UPDATE settings SET value = ? WHERE key = 'workSlots'").run(slots);
  first.exec('DELETE FROM projects; DELETE FROM holidays');
  first.close();
  const second = createDb(path);
  t.after(() => second.close());
  assert.deepEqual(second.prepare('SELECT id, passwordHash FROM members').get(), admin);
  assert.deepEqual(second.prepare('SELECT * FROM holidays').all(), []);
  assert.deepEqual(second.prepare('SELECT * FROM projects').all(), []);
  assert.equal((second.prepare("SELECT value FROM settings WHERE key = 'workSlots'").get() as { value: string }).value, slots);
});

test('回归测试：按年重置不覆盖其他年份、改密后旧 JWT 失效、复盘跨度上限保护', async t => {
  const f = await fixture(t);
  const m = await f.newMember('member');

  // 1. 按年重置仅重置指定年份，不影响其他年份自定义记录
  const custom2027 = { date: '2027-06-18', kind: 'holiday', name: '公司周年假' };
  await f.request('PUT', '/settings/holidays', f.token, { year: 2027, holidays: [custom2027] });
  await f.request('POST', '/settings/holidays/reset', f.token, { year: 2026 });
  assert.deepEqual(await f.request('GET', '/settings/holidays?year=2027', f.token), { holidays: [custom2027] });

  // 2. 成员改密后，旧 token 立即失效
  await f.request('POST', '/auth/change-password', m.token, { oldPassword: 'secret1', newPassword: 'newpassword1' });
  await f.request('GET', '/auth/me', m.token, undefined, 401);

  // 3. 管理员重置密码后，旧 token 立即失效
  const m2 = await f.newMember('member2');
  await f.request('POST', `/members/${m2.user.id}/reset-password`, f.token, { newPassword: 'resetpass99' });
  await f.request('GET', '/auth/me', m2.token, undefined, 401);

  // 4. 复盘查询超过 366 天返回 400
  await f.request('GET', '/summary?startDate=2026-01-01&endDate=2027-12-31', f.token, undefined, 400);

  // 5. 创建成员不传颜色时自动分配不重复颜色 + 账号邮箱忘记密码重置
  const u1: Member = await f.request('POST', '/members', f.token, {
    username: 'u1', email: 'u1@example.com', password: 'password1', name: '成员一', role: 'member',
  }, 201);
  const u2: Member = await f.request('POST', '/members', f.token, {
    username: 'u2', email: 'u2@example.com', password: 'password1', name: '成员二', role: 'member',
  }, 201);
  assert.notEqual(u1.avatarColor.toLowerCase(), u2.avatarColor.toLowerCase());
  const { token: u1OldToken } = await f.login('u1', 'password1');
  await f.request('POST', '/auth/forgot-password', undefined, {
    username: 'u1', email: 'wrong@example.com', newPassword: 'newpassword9',
  }, 400);
  await f.request('POST', '/auth/forgot-password', undefined, {
    username: 'admin', email: 'admin@calendar.local', newPassword: 'hackedpassword',
  }, 400);
  const badReset = await f.app.request('/api/settings/holidays/reset', {
    method: 'POST',
    headers: { Authorization: `Bearer ${f.token}`, 'Content-Type': 'application/json' },
    body: '{broken',
  });
  assert.equal(badReset.status, 400);
  await f.request('POST', '/auth/forgot-password', undefined, {
    username: 'u1', email: 'U1@example.com', newPassword: 'newpassword9',
  });
  await f.request('GET', '/auth/me', u1OldToken, undefined, 401);
  await f.login('u1', 'newpassword9');
});
