import { expect, test, type Page } from '@playwright/test';
import { localUrl, testDate } from './fixtures';

async function addTask(page: Page, title: string) {
  await page.getByRole('button', { name: '新建', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('例如：完成首页画布交互开发').fill(title);
  await dialog.getByRole('button', { name: '新建任务', exact: true }).click();
  await expect(dialog).toBeHidden();
}

test('Pages uses IndexedDB, persists across reloads and supports traditional views', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
  });
  await page.clock.setFixedTime(testDate);
  await page.goto(localUrl + '#invite=ignored-in-personal-edition');
  await expect(page.getByLabel('日历布局')).toBeVisible();
  await expect(page.getByPlaceholder('请输入密码')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '接受团队邀请' })).toHaveCount(0);

  await page.getByRole('button', { name: '添加排期人员' }).click();
  const memberDialog = page.getByRole('dialog');
  await memberDialog.getByRole('button', { name: '添加排期人员' }).click();
  await expect(memberDialog.getByLabel('登录账号')).toHaveCount(0);
  await expect(memberDialog.getByLabel('权限角色')).toHaveCount(0);
  await memberDialog.getByPlaceholder('如：张三').fill('本机成员');
  await memberDialog.getByRole('button', { name: '保存' }).click();
  await expect(memberDialog.getByText('本机成员', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await addTask(page, '本机保存的任务');
  await expect(page.getByText('本机保存的任务', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('本机保存的任务', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '账户菜单' }).click();
  await page.getByText('项目管理', { exact: true }).click();
  const projects = page.getByRole('dialog');
  await projects.getByRole('button', { name: '新建项目' }).click();
  await projects.getByPlaceholder('如：核心研发').fill('另一项目');
  await projects.getByRole('button', { name: '保存' }).click();
  await expect(projects.getByText('另一项目', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  const gapsBefore = await page.getByRole('button', { name: /人空档/ }).innerText();
  await page.getByRole('button', { name: '全部项目', exact: true }).click();
  await page.getByRole('button', { name: '另一项目', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('本机保存的任务', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /人空档/ })).toHaveText(gapsBefore);
  await page.getByRole('button', { name: '另一项目', exact: true }).click();
  await page.getByRole('button', { name: '全部项目', exact: true }).click();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '新建', exact: true }).click();
  const taskDialog = page.getByRole('dialog');
  await taskDialog.locator('input[type="date"]').nth(0).fill('2027-01-01');
  await taskDialog.locator('input[type="date"]').nth(1).fill('2027-01-01');
  await expect(taskDialog.getByText('0h', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  const memberFilter = page.getByLabel('按成员筛选');
  await memberFilter.selectOption({ label: '本机成员' });
  await expect(page.getByText('本机保存的任务', { exact: true })).toHaveCount(0);
  await memberFilter.selectOption('');
  await page.getByLabel('日历布局').selectOption('calendar');
  await expect(page.getByLabel('传统日历', { exact: true })).toBeVisible();
  await expect(page.locator('[aria-label="2026-11-25"]')).toBeVisible();
  await page.getByRole('button', { name: '月', exact: true }).click();
  await expect(page.locator('[aria-label="2026-11-01"]')).toBeVisible();
  await expect(page.locator('[aria-label="2026-11-30"]')).toBeVisible();
  await page.getByRole('button', { name: '账户菜单' }).click();
  await page.getByText('系统设置', { exact: true }).click();
  await expect(page.getByRole('tab', { name: '角色显示名称' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(apiRequests).toEqual([]);
});
