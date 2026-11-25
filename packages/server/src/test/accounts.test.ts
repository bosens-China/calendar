import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture } from './fixture.js';

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
