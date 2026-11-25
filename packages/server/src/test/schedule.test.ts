import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, span } from './fixture.js';
import type { PeriodSummaryResponse } from '@calendar/shared';

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

test('复盘拒绝超过 366 天的日期范围', async t => {
  const f = await fixture(t);
  await f.request('GET', '/summary?startDate=2026-01-01&endDate=2027-12-31', f.token, undefined, 400);
});
