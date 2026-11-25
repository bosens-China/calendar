import { expect, type Page } from '@playwright/test';

export const localUrl = 'http://127.0.0.1:3312/calendar/';
export const teamUrl = 'http://127.0.0.1:3311/';
export const testDate = new Date('2026-11-25T04:00:00Z');
export const adminPassword = 'calendar-browser-fixture';

export async function login(page: Page, username: string, password: string) {
  await page.getByPlaceholder('请输入登录账号').fill(username);
  await page.getByPlaceholder('请输入密码').fill(password);
  await page.getByRole('button', { name: '进入工作台', exact: true }).click();
  await expect(page.getByLabel('日历布局')).toBeVisible();
}
