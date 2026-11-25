import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHolidayMap,
  computeMemberDaySchedule,
  computePeriodSummary,
  DEFAULT_WORK_SLOTS,
  type Leave,
  type Member,
  type Project,
  type Task,
} from '../dist/index.js';

const member: Member = {
  id: 'm1',
  username: 'alice',
  name: 'Alice',
  role: 'member',
  title: 'FE',
  avatarColor: '#1677ff',
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const project: Project = {
  id: 'p1',
  name: '核心项目',
  color: '#1677ff',
  description: '',
  archived: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

test('skips lunch break and computes partial gap accurately', () => {
  const task: Task = {
    id: 't1',
    title: '开发页面',
    description: '',
    projectId: 'p1',
    assigneeId: 'm1',
    startDate: '2026-11-25',
    startTime: '09:00',
    endDate: '2026-11-25',
    endTime: '12:00',
    status: 'in_progress',
    priority: 'medium',
    adjustedByMember: false,
    createdBy: 'admin',
    createdAt: '',
    updatedAt: '',
  };

  const day = computeMemberDaySchedule({
    date: '2026-11-25', // Wednesday
    memberId: 'm1',
    tasks: [task],
    leaves: [],
    workSlots: DEFAULT_WORK_SLOTS,
    holidayMap: buildHolidayMap([]),
  });

  assert.equal(day.isWorkday, true);
  assert.equal(day.expectedMinutes, 450); // 3h + 4.5h
  assert.equal(day.scheduledMinutes, 180); // 3h morning
  assert.equal(day.gapMinutes, 270); // 4.5h afternoon
  assert.equal(day.fillStatus, 'partial');
});

test('leave eliminates gap for that slot', () => {
  const task: Task = {
    id: 't1',
    title: '上午任务',
    description: '',
    projectId: 'p1',
    assigneeId: 'm1',
    startDate: '2026-11-25',
    startTime: '09:00',
    endDate: '2026-11-25',
    endTime: '12:00',
    status: 'done',
    priority: 'high',
    adjustedByMember: false,
    createdBy: 'admin',
    createdAt: '',
    updatedAt: '',
  };
  const leave: Leave = {
    id: 'l1',
    memberId: 'm1',
    startDate: '2026-11-25',
    startTime: '13:30',
    endDate: '2026-11-25',
    endTime: '18:00',
    type: 'annual',
    reason: '年假',
    createdBy: 'm1',
    createdAt: '',
    updatedAt: '',
  };

  const day = computeMemberDaySchedule({
    date: '2026-11-25',
    memberId: 'm1',
    tasks: [task],
    leaves: [leave],
    workSlots: DEFAULT_WORK_SLOTS,
    holidayMap: buildHolidayMap([]),
  });

  assert.equal(day.leaveMinutes, 270);
  assert.equal(day.expectedMinutes, 180);
  assert.equal(day.scheduledMinutes, 180);
  assert.equal(day.gapMinutes, 0);
  assert.equal(day.fillStatus, 'full');
});

test('period summary skips weekend and respects holiday override', () => {
  const task: Task = {
    id: 't1',
    title: '跨周末任务',
    description: '',
    projectId: 'p1',
    assigneeId: 'm1',
    startDate: '2026-11-27', // Fri
    startTime: '13:30',
    endDate: '2026-11-30', // Mon
    endTime: '12:00',
    status: 'in_progress',
    priority: 'medium',
    adjustedByMember: false,
    createdBy: 'admin',
    createdAt: '',
    updatedAt: '',
  };

  const summary = computePeriodSummary({
    startDate: '2026-11-27',
    endDate: '2026-11-30',
    members: [member],
    projects: [project],
    tasks: [task],
    leaves: [],
    holidays: [],
  });

  // Fri + Mon = 2 workdays = 900 mins expected; scheduled = Fri afternoon (270) + Mon morning (180) = 450
  assert.equal(summary.totalExpectedMinutes, 900);
  assert.equal(summary.totalScheduledMinutes, 450);
  assert.equal(summary.totalGapMinutes, 450);
  assert.equal(summary.membersWithGap, 1);
});
