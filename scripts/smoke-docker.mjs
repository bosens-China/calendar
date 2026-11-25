import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const image = process.argv[2] || 'calendar:ci';
const name = `calendar-smoke-${randomUUID()}`;
const password = randomUUID();

function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8' }).trim();
}

function start(initializing) {
  docker('run', '--detach', '--name', name, '--publish', '127.0.0.1::3001',
    '--volume', `${name}:/data`,
    ...(initializing ? ['--env', `ADMIN_INIT_PASSWORD=${password}`] : []),
    image);
  return 'http://' + docker('port', name, '3001/tcp');
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 75; attempt++) {
    try {
      const response = await fetch(url + '/api/health', { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {
      // Docker may publish the port before the process starts listening.
    }
    await delay(200);
  }
  throw new Error('Calendar did not become ready');
}

docker('volume', 'create', name);
try {
  const url = start(true);
  await waitForServer(url);
  const html = await (await fetch(url)).text();
  const asset = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  assert.ok(asset, 'Expected a built frontend asset');
  assert.ok((await fetch(url + asset)).ok, 'Frontend asset should be served by the container');

  const login = await fetch(url + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password }),
  });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const created = await fetch(url + '/api/projects', {
    method: 'POST', headers, body: JSON.stringify({ name: 'Persistence check' }),
  });
  assert.equal(created.status, 201);
  const { id } = await created.json();

  docker('rm', '--force', name);
  const restartedUrl = start(false);
  await waitForServer(restartedUrl);
  const persisted = await fetch(restartedUrl + '/api/projects', { headers });
  assert.equal(persisted.status, 200);
  assert.ok((await persisted.json()).some(project => project.id === id));
  console.log('Docker serves the UI and API and retains SQLite data and sessions across replacement.');
} catch (error) {
  try { console.error(docker('logs', name)); } catch { /* Container initialization failed. */ }
  throw error;
} finally {
  try { docker('rm', '--force', name); } catch { /* Nothing to remove. */ }
  docker('volume', 'rm', name);
}
