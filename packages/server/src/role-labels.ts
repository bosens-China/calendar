import { DEFAULT_ROLE_LABELS, roleLabelsSchema } from '@calendar/shared';
import type { CalendarDb } from './db.js';
import { getSetting } from './store.js';

export function readRoleLabels(db: CalendarDb) {
  const value = getSetting(db, 'roleLabels');
  return value ? roleLabelsSchema.parse(JSON.parse(value)) : DEFAULT_ROLE_LABELS;
}
