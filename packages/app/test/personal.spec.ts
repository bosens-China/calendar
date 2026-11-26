import { expect, test, type Page } from '@playwright/test';
import { localUrl, testDate } from './fixtures';

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

  await page.getByRole('button', { name: '全部成员', exact: true }).click();
  await page.getByRole('checkbox', { name: '本机成员', exact: true }).check();
  await page.keyboard.press('Escape');
  const monthToggle = page.getByRole('button', { name: '月', exact: true });
  await monthToggle.click();
  await expect(monthToggle).toHaveAttribute('aria-pressed', 'true');
  await page.getByTitle('上一周期').click();
  await expect(canvas.locator('[data-date="2026-10-08"]')).toBeVisible();
  await gapToggle.click();
  await expect(gapToggle).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(monthToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas.locator('[data-date="2026-11-02"]')).toBeVisible();
  await expect(gapToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: '全部成员', exact: true })).toBeVisible();
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
  await page.reload();
  await expect(page.getByRole('button', { name: '周', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas).toBeVisible();
  await expect(page.getByText('本机保存的任务', { exact: true })).toHaveCount(0);
  await expect(page.getByText('本机成员', { exact: true })).toHaveCount(0);
  await expect(weekend).toBeVisible();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(apiRequests).toEqual([]);
});


test('month scrollbars start at the date columns and non-workdays are shaded per member', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 680 });
  await page.clock.setFixedTime(new Date('2026-10-08T04:00:00Z'));
  await page.goto(localUrl);
  const canvas = page.getByRole('region', { name: '排期画布' });
  const addMember = page.getByRole('button', { name: '添加排期人员', exact: true });
  const switchToMonth = () => page.getByRole('button', { name: '月', exact: true }).click();
  const date = (day: string) => canvas.locator(`[data-date="2026-10-${day}"]`);
  const nonWorkdayCells = (day: string) => canvas.locator(`[data-non-workday="2026-10-${day}"]`);

  await switchToMonth();
  await expect(nonWorkdayCells('02')).toHaveCount(1);
  await expect(nonWorkdayCells('11')).toHaveCount(1);
  await expect(nonWorkdayCells('10')).toHaveCount(0); // 补班周六
  expect(await date('01').boundingBox()).toMatchObject({ width: 104 });
  expect(await date('31').boundingBox()).toMatchObject({ width: 104 });
  const background = (day: string) => date(day).evaluate(el => getComputedStyle(el).backgroundColor);
  expect(await background('02')).toBe(await background('11'));
  expect(await background('02')).not.toBe(await background('09')); // 未来工作日
  const holidayColors = await nonWorkdayCells('02').evaluate(cell => {
    const { left, width, bottom } = cell.getBoundingClientRect();
    const below = document.elementFromPoint(left + width / 2, bottom + 20)!;
    return { cell: getComputedStyle(cell).backgroundColor, below: getComputedStyle(below).backgroundColor };
  });
  expect(holidayColors.cell).not.toBe(holidayColors.below);

  await addMember.click();
  const members = page.getByRole('dialog');
  for (const name of ['成员甲', '成员乙', '成员丙', '成员丁', '成员戊']) {
    await members.getByRole('button', { name: '添加排期人员' }).click();
    await members.getByPlaceholder('如：张三').fill(name);
    await members.getByRole('button', { name: '保存' }).click();
    await expect(members.getByText(name, { exact: true })).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await expect(nonWorkdayCells('02')).toHaveCount(6);
  await expect(nonWorkdayCells('11')).toHaveCount(6);

  await page.setViewportSize({ width: 1100, height: 390 });
  const horizontal = page.locator('.schedule-scrollbar[data-orientation="horizontal"]');
  await expect(horizontal).toBeVisible();
  await expect(page.locator('.schedule-scrollbar[data-orientation="vertical"]')).toBeVisible();
  expect((await horizontal.boundingBox())?.x).toBe((await date('01').boundingBox())?.x);
  const viewport = (await canvas.boundingBox())!;
  const pinned = (await addMember.boundingBox())!;
  const firstMember = canvas.getByText('我', { exact: true });
  const initialMember = (await firstMember.boundingBox())!;
  const scrollLeft = () => canvas.evaluate(el => el.scrollLeft);
  await page.mouse.move(viewport.x + 320, viewport.y + 20);
  await page.mouse.down();
  await page.mouse.move(viewport.x + 200, viewport.y + 20, { steps: 8 });
  await page.mouse.up();
  await expect.poll(scrollLeft).toBe(120);
  expect((await firstMember.boundingBox())?.x).toBe(initialMember.x);
  await page.mouse.wheel(300, 0);
  await expect.poll(scrollLeft).toBeGreaterThan(120);

  const beforeThumbDrag = await scrollLeft();
  const thumb = (await horizontal.locator('.schedule-scroll-thumb').boundingBox())!;
  expect(thumb.width).toBeLessThan((await horizontal.boundingBox())!.width);
  await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
  await page.mouse.down();
  await page.mouse.move(thumb.x + thumb.width / 2 + 140, thumb.y + thumb.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(scrollLeft).toBeGreaterThan(beforeThumbDrag);

  await page.mouse.move(viewport.x + 64, viewport.y + 120);
  await page.mouse.wheel(0, 240);
  await expect.poll(() => canvas.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect((await firstMember.boundingBox())?.y).toBeLessThan(initialMember.y);
  expect(await addMember.boundingBox()).toEqual(pinned);
});
