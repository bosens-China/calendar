import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture } from './fixture.js';
import { DEFAULT_CN_HOLIDAYS, DEFAULT_WORK_SLOTS } from '@calendar/shared';

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

test('single-date holiday edits preserve unrelated records and require an administrator', async t => {
  const f = await fixture(t);
  const member = await f.newMember('holiday-member');
  const paths = ['/settings/holidays/2026-06-15', '/settings/holidays/2026-06-16'];
  const forbidden = await f.request('PUT', paths[0], member.token, { name: '不应保存', kind: 'holiday' }, 403);
  assert.equal(forbidden.code, 'FORBIDDEN');
  const before = (await f.request('GET', '/settings/holidays?year=2026', f.token)).holidays;
  const [first, second] = await Promise.all(paths.map((path, index) =>
    f.request('PUT', path, f.token, { name: `补班 ${index}`, kind: 'workday' })));
  assert.equal(first.code, 'OK');
  assert.equal(second.code, 'OK');
  await f.request('DELETE', paths[0], f.token);
  const after = (await f.request('GET', '/settings/holidays?year=2026', f.token)).holidays;
  assert.deepEqual(after.filter((day: { date: string }) => day.date !== second.data.date), before);
  assert.ok(after.some((day: { date: string }) => day.date === second.data.date));
});

test('重置某年的节假日保留其他年份的规则', async t => {
  const f = await fixture(t);
  const custom2027 = { date: '2027-06-18', kind: 'holiday', name: '公司周年假' };
  await f.request('PUT', '/settings/holidays', f.token, { year: 2027, holidays: [custom2027] });
  await f.request('POST', '/settings/holidays/reset', f.token, { year: 2026 });
  assert.deepEqual(await f.request('GET', '/settings/holidays?year=2027', f.token), { holidays: [custom2027] });
});

test('节假日重置拒绝无效的 JSON', async t => {
  const f = await fixture(t);
  const badReset = await f.app.request('/api/settings/holidays/reset', {
    method: 'POST',
    headers: { Authorization: `Bearer ${f.token}`, 'Content-Type': 'application/json' },
    body: '{broken',
  });
  assert.equal(badReset.status, 400);
});
