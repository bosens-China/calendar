import { expect, test, type Page } from '@playwright/test';
import { localUrl, testDate } from './fixtures';

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

async function addTask(page: Page, title: string) {
  await page.getByRole('button', { name: '新建', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('例如：完成首页画布交互开发').fill(title);
  await dialog.getByRole('button', { name: '新建任务', exact: true }).click();
  await expect(dialog).toBeHidden();
}

test('Pages uses IndexedDB, persists across reloads and supports workbench filters', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
  });
  await page.clock.setFixedTime(testDate);
  await page.goto(localUrl + '#invite=ignored-in-personal-edition');
  const canvas = page.getByRole('region', { name: '排期画布' });
  const gapToggle = page.getByRole('button', { name: /检查空闲/ });
  await expect(canvas).toBeVisible();
  await expect(page.getByLabel('日历布局')).toHaveCount(0);
  await expect(page.getByPlaceholder('请输入密码')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '接受团队邀请' })).toHaveCount(0);
  await expect(page.getByText('未排期', { exact: true })).toHaveCount(2);
  await expect(page.getByText('全天空档', { exact: true })).toHaveCount(3);
  await expect(gapToggle).toHaveAttribute('aria-pressed', 'false');
  await gapToggle.click();
  await expect(gapToggle).toHaveAttribute('aria-pressed', 'true');
  await page.getByTitle('上一周期').click();
  await expect(canvas.getByText('当前周期没有待排空档')).toBeVisible();
  await page.getByTitle('下一周期').click();
  await expect(canvas.getByText('全天空档', { exact: true })).toHaveCount(3);
  await gapToggle.click();
  await page.getByText('未排期', { exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

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
  const gapsBefore = await gapToggle.getAttribute('title');
  expect(gapsBefore).toMatch(/人空档/);
  await page.getByRole('button', { name: '全部项目', exact: true }).click();
  await page.getByRole('checkbox', { name: '另一项目', exact: true }).check();
  await expect(canvas.getByText('本机保存的任务', { exact: true })).toHaveCount(0);
  await expect(gapToggle).toHaveAttribute('title', gapsBefore!);
  await page.getByRole('checkbox', { name: '默认项目', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: '另一项目', exact: true })).toBeChecked();
  await expect(canvas.getByText('本机保存的任务', { exact: true })).toBeVisible();
  await expect(page.getByText('隐藏周末与节假日')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: '全部项目', exact: true }).click();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '新建', exact: true }).click();
  const taskDialog = page.getByRole('dialog');
  await taskDialog.locator('input[type="date"]').nth(0).fill('2027-01-01');
  await taskDialog.locator('input[type="date"]').nth(1).fill('2027-01-01');
  await expect(taskDialog.getByText('0h', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '全部成员', exact: true }).click();
  await page.getByRole('checkbox', { name: '本机成员', exact: true }).check();
  await expect(canvas.getByText('本机保存的任务', { exact: true })).toHaveCount(0);
  await page.getByRole('checkbox', { name: '我', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: '本机成员', exact: true })).toBeChecked();
  await expect(canvas.getByText('本机保存的任务', { exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: '全部成员', exact: true }).click();
  await page.keyboard.press('Escape');

  const weekend = canvas.locator('[data-date="2026-11-28"]');
  await expect(weekend).toBeVisible();
  await page.getByRole('button', { name: '账户菜单' }).click();
  await page.getByText('系统设置', { exact: true }).click();
  await page.getByRole('tab', { name: '日历显示' }).click();
  const hideNonWorkdays = page.getByRole('checkbox', { name: '隐藏周末与节假日' });
  await expect(hideNonWorkdays).not.toBeChecked();
  await hideNonWorkdays.click();
  await expect(hideNonWorkdays).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(weekend).toHaveCount(0);
  await page.reload();
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: '账户菜单' }).click();
  await page.getByText('系统设置', { exact: true }).click();
  await page.getByRole('tab', { name: '日历显示' }).click();
  await expect(hideNonWorkdays).toBeChecked();
  await expect(page.getByRole('tab', { name: '角色显示名称' })).toHaveCount(0);
  await page.getByRole('tab', { name: '重置' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '恢复初始化状态' }).click();
  await expect(page.getByText('已恢复到初始化状态')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('本机保存的任务', { exact: true })).toHaveCount(0);
  await expect(page.getByText('本机成员', { exact: true })).toHaveCount(0);
  await expect(weekend).toBeVisible();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(apiRequests).toEqual([]);
});


test('month has fixed date columns and scrolls with the add-member action pinned', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 680 });
  await page.clock.setFixedTime(testDate);
  await page.goto(localUrl);
  const canvas = page.getByRole('region', { name: '排期画布' });
  const addMember = page.getByRole('button', { name: '添加排期人员', exact: true });
  await addMember.click();
  const members = page.getByRole('dialog');
  for (const name of ['成员甲', '成员乙', '成员丙', '成员丁', '成员戊']) {
    await members.getByRole('button', { name: '添加排期人员' }).click();
    await members.getByPlaceholder('如：张三').fill(name);
    await members.getByRole('button', { name: '保存' }).click();
    await expect(members.getByText(name, { exact: true })).toBeVisible();
  }
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '月', exact: true }).click();
  const date = (day: string) => canvas.locator(`[data-date="2026-11-${day}"]`);
  await expect(date('01')).toBeVisible();
  await expect(date('30')).toBeVisible();
  expect(await date('01').boundingBox()).toMatchObject({ width: 104 });
  expect(await date('30').boundingBox()).toMatchObject({ width: 104 });
  const background = (day: string) => date(day).evaluate(el => getComputedStyle(el).backgroundColor);
  expect(await background('26')).toBe(await background('01'));
  expect(await background('26')).not.toBe(await background('24'));

  await page.setViewportSize({ width: 1100, height: 390 });
  const viewport = (await canvas.boundingBox())!;
  const pinned = (await addMember.boundingBox())!;
  const firstMember = canvas.getByText('我', { exact: true });
  const initialMember = (await firstMember.boundingBox())!;
  expect(await canvas.evaluate(el => el.offsetHeight > el.clientHeight && el.offsetWidth > el.clientWidth)).toBe(true);
  await page.mouse.move(viewport.x + 320, viewport.y + 20);
  await page.mouse.down();
  await page.mouse.move(viewport.x + 200, viewport.y + 20, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => canvas.evaluate(el => el.scrollLeft)).toBe(120);
  expect((await firstMember.boundingBox())?.x).toBe(initialMember.x);
  await page.mouse.wheel(300, 0);
  await expect.poll(() => canvas.evaluate(el => el.scrollLeft)).toBeGreaterThan(120);
  await page.mouse.move(viewport.x + 64, viewport.y + 120);
  await page.mouse.wheel(0, 240);
  await expect.poll(() => canvas.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect((await firstMember.boundingBox())?.y).toBeLessThan(initialMember.y);
  expect(await addMember.boundingBox()).toEqual(pinned);
});
