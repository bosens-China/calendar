import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePeriodSummary, type Leave, type Member, type Project, type Task,
} from '../../dist/index.js';

const member: Member = {
  id: 'm1',
  username: 'alice',
  email: '',
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


test('summary lists only the available interval after a morning leave', () => {
  const date = '2026-11-25';
  const leave: Leave = {
    id: 'morning-leave', memberId: member.id, type: 'annual', reason: '',
    startDate: date, startTime: '09:00', endDate: date, endTime: '12:00',
    createdBy: member.id, createdAt: '', updatedAt: '',
  };
  const summary = computePeriodSummary({
    startDate: date, endDate: date, members: [member], projects: [project],
    tasks: [], leaves: [leave], holidays: [],
  });
  assert.deepEqual(summary.members[0].gapDetails, [{
    date, slotLabel: '下午', startTime: '13:30', endTime: '18:00', minutes: 270, isFullDay: false,
  }]);
});
