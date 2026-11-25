import test from 'node:test';
import assert from 'node:assert/strict';
import { getCalendarDate, getCalendarYear } from '../../dist/index.js';

test('uses the Shanghai date at the UTC year boundary', () => {
  const now = new Date('2026-12-31T17:00:00Z');
  assert.equal(getCalendarDate(now), '2027-01-01');
  assert.equal(getCalendarYear(now), 2027);
});
