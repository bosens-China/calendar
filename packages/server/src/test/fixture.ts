import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import type { Member, Task } from '@calendar/shared';
import { createApp } from '../app.js';
import { createDb } from '../db.js';

export const TEST_ADMIN_PASSWORD = 'fixture-admin-47';

export const span = { startDate: '2026-03-02', startTime: '09:00', endDate: '2026-03-02', endTime: '12:00' };

export async function fixture(t: TestContext) {
  const db = createDb(':memory:', TEST_ADMIN_PASSWORD);
  t.after(() => db.$client.close());
  const app = createApp(db);
  async function request(method: string, path: string, token?: string, body?: unknown, expected = 200) {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const res = await app.request(`/api${path}`, { method, headers, body: JSON.stringify(body) });
    const json = await res.json();
    assert.equal(res.status, expected, `${method} ${path} ${JSON.stringify(json)}`);
    if (expected >= 400) {
      if (/^\/settings\/holidays\/\d{4}-\d{2}-\d{2}$/.test(path)) {
        assert.equal(json.data, null);
        assert.equal(typeof json.code, 'string');
        assert.equal(typeof json.message, 'string');
      } else {
        assert.deepEqual(Object.keys(json), ['error']);
        assert.equal(typeof json.error, 'string');
      }
    }
    return json;
  }
  const login = (username: string, password: string, expected = 200) => request('POST', '/auth/login', undefined, { username, password }, expected);
  const { user: admin, token }: { user: Member; token: string } = await login('admin', TEST_ADMIN_PASSWORD);
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
