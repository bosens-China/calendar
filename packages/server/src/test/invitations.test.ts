import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eq } from 'drizzle-orm';
import { invitations } from '../schema.js';
import { fixture } from './fixture.js';

const profile = { username: 'invited-user', name: '受邀成员', role: 'member' };
const password = 'invited-fixture-password';
const preview = '/auth/invitations/preview';
const accept = '/auth/invitations/accept';

test('管理员分配账号和角色，链接成功开通一次', async t => {
  const f = await fixture(t);
  const outsider = await f.newMember('outsider');
  await f.request('POST', '/members/invitations', outsider.token, profile, 403);

  const invite = await f.request('POST', '/members/invitations', f.token, profile, 201);
  assert.equal(invite.member.pendingInvitation, true);
  assert.equal(invite.member.active, false);
  assert.ok(!('passwordHash' in invite.member));
  await f.login(profile.username, password, 401);
  const details = await f.request('POST', preview, undefined, { token: invite.token });
  assert.equal(details.username, profile.username);
  assert.equal(details.name, profile.name);

  const attempts = await Promise.all([1, 2].map(() => f.app.request('/api' + accept, {
    method: 'POST', body: JSON.stringify({ token: invite.token, password }),
  })));
  assert.deepEqual(attempts.map(response => response.status).sort(), [200, 410]);
  const success = await attempts.find(response => response.ok)!.json();
  const session = await f.request('GET', '/auth/me', success.token);
  assert.equal(session.user.role, profile.role);
  assert.equal(session.user.id, invite.member.id);
  assert.equal(session.user.active, true);
  await f.login(profile.username, password);
  await f.request('POST', preview, undefined, { token: invite.token }, 410);
});

test('过期、撤销和重新生成的旧链接均无法开通账号', async t => {
  const f = await fixture(t);
  const invite = await f.request('POST', '/members/invitations', f.token, profile, 201);
  const invitationPath = `/members/${invite.member.id}/invitation`;

  f.db.update(invitations).set({ expiresAt: '2000-01-01T00:00:00.000Z' })
    .where(eq(invitations.memberId, invite.member.id)).run();
  await f.request('POST', accept, undefined, { token: invite.token, password }, 410);

  const pending = await f.request('POST', invitationPath, f.token);
  const newest = await f.request('POST', invitationPath, f.token);
  await f.request('POST', preview, undefined, { token: pending.token }, 410);
  await f.request('DELETE', invitationPath, f.token);
  await f.request('POST', accept, undefined, { token: newest.token, password }, 410);
  await f.login(profile.username, password, 401);
});
