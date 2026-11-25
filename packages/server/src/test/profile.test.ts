import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture } from './fixture.js';

test('成员只能修改自己的姓名，管理员可以修改角色显示名称', async t => {
  const f = await fixture(t);
  const member = await f.newMember('profile-member');
  const profile = await f.request('PATCH', '/auth/me', member.token, { name: '新的姓名' });
  assert.equal(profile.user.name, '新的姓名');
  assert.equal(profile.user.username, member.user.username);
  await f.request('PATCH', '/auth/me', member.token, { role: 'admin' }, 400);
  await f.request('PATCH', '/auth/me', member.token, { id: f.admin.id, name: '无效' }, 400);

  const labels = { admin: '统筹人', member: '协作者' };
  await f.request('PUT', '/settings/role-labels', member.token, labels, 403);
  assert.deepEqual(await f.request('PUT', '/settings/role-labels', f.token, labels), labels);
  assert.deepEqual(await f.request('GET', '/settings/role-labels', member.token), labels);
  await f.request('POST', '/members/invitations', member.token, undefined, 403);
});
