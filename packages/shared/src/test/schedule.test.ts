import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHolidayMap, computeMemberDaySchedule, DEFAULT_WORK_SLOTS, type Leave, type Task,
} from '../../dist/index.js';

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
