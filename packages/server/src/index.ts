import { relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.js';
import { createDb } from './db.js';

export { createApp } from './app.js';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须为有效的端口号');
  const db = createDb();
  const staticRoot = relative(process.cwd(), fileURLToPath(new URL('../../app/dist', import.meta.url)));
  const app = createApp(db);
  app.get('/', serveStatic({ root: staticRoot, path: 'index.html' }));
  app.get('/assets/*', serveStatic({ root: staticRoot }));
  app.get('/favicon.svg', serveStatic({ root: staticRoot }));
  const server = serve({ fetch: app.fetch, port }, info => {
    console.log(JSON.stringify({ time: new Date().toISOString(), level: 'info', service: 'calendar', port: info.port, message: 'Calendar listening' }));
  });
  function stop() {
    server.close(() => db.$client.close());
  }
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
