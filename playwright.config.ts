import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'packages/app/test',
  workers: 1,
  use: { browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'node packages/server/dist/index.js',
      url: 'http://127.0.0.1:3311/api/health',
      env: {
        PORT: '3311',
        DB_PATH: ':memory:',
        ADMIN_INIT_PASSWORD: 'calendar-browser-fixture',
        DISABLE_REMOTE_HOLIDAY_SYNC: '1',
        TZ: 'UTC',
      },
    },
    {
      command: 'pnpm --filter @calendar/app exec vite preview --host 127.0.0.1 --port 3312 --strictPort --mode pages --outDir dist-pages --base /calendar/',
      url: 'http://127.0.0.1:3312/calendar/',
    },
  ],
});
