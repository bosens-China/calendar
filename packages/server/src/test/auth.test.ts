import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture } from './fixture.js';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import type { Member } from '@calendar/shared';

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

test('修改或重置密码后旧会话失效', async t => {
  const f = await fixture(t);
  const m = await f.newMember('member');
  // 2. 成员改密后，旧 token 立即失效
  await f.request('POST', '/auth/change-password', m.token, { oldPassword: 'secret1', newPassword: 'newpassword1' });
  await f.request('GET', '/auth/me', m.token, undefined, 401);

  // 3. 管理员重置密码后，旧 token 立即失效
  const m2 = await f.newMember('member2');
  await f.request('POST', `/members/${m2.user.id}/reset-password`, f.token, { newPassword: 'resetpass99' });
  await f.request('GET', '/auth/me', m2.token, undefined, 401);
});

test('邮箱找回校验匹配地址并注销旧会话', async t => {
  const f = await fixture(t);
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
  await f.request('POST', '/auth/forgot-password', undefined, {
    username: 'u1', email: 'U1@example.com', newPassword: 'newpassword9',
  });
  await f.request('GET', '/auth/me', u1OldToken, undefined, 401);
  await f.login('u1', 'newpassword9');
});
