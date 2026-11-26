import { expect, test } from '@playwright/test';
import { adminPassword, login, teamUrl, testDate } from './fixtures';

test('team mode isolates users and synchronizes logout between tabs', async ({ page, browser, request }) => {
  const response = await request.post(teamUrl + 'api/auth/login', { data: { username: 'admin', password: adminPassword } });
  expect(response.ok()).toBeTruthy();
  const { token, user: admin } = await response.json();
  const headers = { Authorization: `Bearer ${token}` };
  const account = { username: 'browser-member', password: 'calendar-member-fixture', name: '团队成员', role: 'member' };
  const memberResponse = await request.post(teamUrl + 'api/members', { headers, data: account });
  expect(memberResponse.ok()).toBeTruthy();
  const member = await memberResponse.json();
  const projectResponse = await request.get(teamUrl + 'api/projects', { headers });
  const [project] = await projectResponse.json();
  for (const [assigneeId, title] of [[admin.id, '管理员专属任务'], [member.id, '成员专属任务']]) {
    const taskResponse = await request.post(teamUrl + 'api/tasks', {
      headers, data: {
        assigneeId, title, projectId: project.id,
        startDate: '2026-11-25', startTime: '09:00', endDate: '2026-11-25', endTime: '12:00',
      },
    });
    expect(taskResponse.ok()).toBeTruthy();
  }

  await page.clock.setFixedTime(testDate);
  await page.goto(teamUrl);
  await login(page, 'admin', adminPassword);
  await expect(page.getByText('管理员专属任务', { exact: true })).toBeVisible();
  await expect(page.getByText('成员专属任务', { exact: true })).toBeVisible();
  const monthToggle = page.getByRole('button', { name: '月', exact: true });
  await monthToggle.click();
  await expect(monthToggle).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(monthToggle).toHaveAttribute('aria-pressed', 'true');
  const teamCanvas = page.getByRole('region', { name: '排期画布' });
  await expect(teamCanvas.locator('[data-non-workday="2026-11-28"]')).toHaveCount(2);
  const dateScrollbar = page.locator('.schedule-scrollbar[data-orientation="horizontal"]');
  await expect(dateScrollbar).toBeVisible();
  expect((await dateScrollbar.boundingBox())?.x).toBe((await teamCanvas.locator('[data-date="2026-11-01"]').boundingBox())?.x);

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await memberPage.clock.setFixedTime(testDate);
  await memberPage.goto(teamUrl);
  await login(memberPage, account.username, account.password);
  await expect(memberPage.getByText('成员专属任务', { exact: true })).toBeVisible();
  await expect(memberPage.getByText('管理员专属任务', { exact: true })).toHaveCount(0);
  await expect(memberPage.getByRole('button', { name: '全部成员', exact: true })).toHaveCount(0);
  await memberPage.getByRole('button', { name: '月', exact: true }).click();
  await memberPage.getByRole('button', { name: '账户菜单' }).click();
  await memberPage.getByText('系统设置', { exact: true }).click();
  await memberPage.getByRole('tab', { name: '重置' }).click();
  await expect(memberPage.getByRole('button', { name: '重置我的数据' })).toBeVisible();
  await expect(memberPage.getByRole('button', { name: '清空排期数据' })).toHaveCount(0);
  await expect(memberPage.getByRole('button', { name: '恢复初始化状态' })).toHaveCount(0);
  memberPage.once('dialog', dialog => dialog.accept());
  await memberPage.getByRole('button', { name: '重置我的数据' }).click();
  await expect(memberPage.getByText('已清空本人请假记录并重置界面偏好')).toBeVisible();
  await memberPage.reload();
  await expect(memberPage.getByRole('button', { name: '周', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await memberContext.close();

  const secondTab = await page.context().newPage();
  await secondTab.goto(teamUrl);
  await expect(secondTab.getByRole('button', { name: '周', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '账户菜单' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByText('退出登录', { exact: true }).click();
  await expect(secondTab.getByPlaceholder('请输入密码')).toBeVisible();
});

test('team read failures show retries and prevent editing unloaded holiday data', async ({ page }) => {
  await page.clock.setFixedTime(testDate);
  await page.route('**/api/tasks?*', route => route.abort());
  await page.goto(teamUrl);
  await login(page, 'admin', adminPassword);
  const error = page.getByRole('alert').filter({ hasText: '无法加载完整的排期数据' });
  await expect(error).toBeVisible();
  await expect(page.getByText('全天空档', { exact: true })).toHaveCount(0);
  await page.unroute('**/api/tasks?*');
  await error.getByRole('button', { name: '重试' }).click();
  await expect(error).toHaveCount(0);

  await page.route('**/api/summary?*', route => route.abort());
  await page.getByRole('button', { name: '复盘', exact: true }).click();
  const review = page.getByRole('dialog');
  await expect(review.getByText('无法加载复盘数据')).toBeVisible();
  await page.unroute('**/api/summary?*');
  await review.getByRole('button', { name: '重试' }).click();
  await expect(review.getByText('应出勤工时', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.route('**/api/settings/holidays?year=2027', route => route.abort());
  await page.getByRole('button', { name: '账户菜单' }).click();
  await page.getByText('系统设置', { exact: true }).click();
  await page.getByRole('tab', { name: '法定节假日与调休' }).click();
  await page.getByLabel('节假日年份').selectOption('2027');
  await expect(page.getByText('无法加载节假日规则', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '添加', exact: true })).toBeDisabled();
});

test('team invitation opens an assigned account using only a password', async ({ page, browser }) => {
  await page.goto(teamUrl);
  await login(page, 'admin', adminPassword);

  await page.getByRole('button', { name: '账户菜单' }).click();
  await page.getByText('系统设置', { exact: true }).click();
  await page.getByRole('tab', { name: '角色显示名称' }).click();
  await page.getByLabel('成员的显示名称').fill('协作者');
  await page.getByRole('button', { name: '保存角色显示名称' }).click();
  await expect(page.getByText('角色显示名称已更新', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '邀请成员', exact: true }).click();
  const manager = page.getByRole('dialog');
  await manager.getByRole('button', { name: '邀请成员', exact: true }).click();
  await manager.getByLabel('登录账号').fill('browser-invite');
  await manager.getByLabel('姓名').fill('受邀同事');
  await manager.getByLabel('权限角色').selectOption('member');
  await manager.getByRole('button', { name: '生成邀请链接' }).click();
  const inviteLink = manager.getByRole('textbox', { name: '邀请链接' });
  await expect(inviteLink).toBeVisible();

  const context = await browser.newContext();
  const join = await context.newPage();
  await join.goto(await inviteLink.inputValue());
  await expect(join.getByText('受邀同事，', { exact: false })).toBeVisible();
  await expect(join.getByText('协作者', { exact: false })).toBeVisible();
  await expect(join.locator('input')).toHaveCount(1);
  await join.getByLabel('设置密码').fill('browser-invited-password');
  await join.getByRole('button', { name: '加入团队' }).click();
  await expect(join.getByRole('button', { name: '周', exact: true })).toBeVisible();
  await expect(join.getByRole('button', { name: '请假', exact: true })).toBeVisible();

  await join.getByRole('button', { name: '账户菜单' }).click();
  await join.getByText('系统设置', { exact: true }).click();
  await expect(join.getByRole('tab', { name: '角色显示名称' })).toHaveCount(0);
  await join.getByRole('tab', { name: '个人资料' }).click();
  await join.getByLabel('姓名').fill('新的姓名');
  await join.getByRole('button', { name: '保存姓名' }).click();
  await expect(join.getByText('姓名已更新', { exact: true })).toBeVisible();
  await context.close();
});
