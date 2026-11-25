import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture } from './fixture.js';

test('publishes documentation from the mounted API and validation schemas', async t => {
  const f = await fixture(t);
  const response = await f.app.request('/api/openapi.json');
  assert.equal(response.status, 200);
  const spec = await response.json();
  const save = spec.paths['/api/settings/holidays/{date}'].put;
  assert.deepEqual(save.requestBody.content['application/json'].schema.required, ['name', 'kind']);
  assert.deepEqual(spec.paths['/api/auth/login'].post.security, []);
  assert.deepEqual(spec.security, [{ bearerAuth: [] }]);
  const docs = await f.app.request('/api/docs');
  assert.equal(docs.status, 200);
  assert.match(await docs.text(), /\/api\/openapi\.json/);
});
