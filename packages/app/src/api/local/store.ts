import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  DEFAULT_CN_HOLIDAYS, DEFAULT_WORK_SLOTS,
  type HolidayOverride, type Leave, type Member, type Project, type Task, type WorkSlot,
} from '@calendar/shared';

import type { ThemePreference } from '../../store/themeStore';

export const LOCAL_ADMIN_ID = 'local-admin';

interface LocalState {
  members: Member[];
  projects: Project[];
  tasks: Task[];
  leaves: Leave[];
  workSlots: WorkSlot[];
  holidays: HolidayOverride[];
  theme?: ThemePreference;
  hideNonWorkdays?: boolean;
}

function initialState(): LocalState {
  const now = new Date().toISOString();
  return {
    members: [{
      id: LOCAL_ADMIN_ID, username: '', email: '', name: '我', title: '',
      avatarColor: '#2563eb', role: 'admin', active: true, createdAt: now, updatedAt: now,
    }],
    projects: [{
      id: 'default-project', name: '默认项目', color: '#1677ff', description: '',
      archived: false, createdAt: now, updatedAt: now,
    }],
    tasks: [],
    leaves: [],
    workSlots: DEFAULT_WORK_SLOTS,
    holidays: DEFAULT_CN_HOLIDAYS,
  };
}

interface CalendarStorage extends DBSchema {
  workspace: { key: string; value: LocalState };
}

let connection: Promise<IDBPDatabase<CalendarStorage>> | undefined;

function openCalendar() {
  connection ??= openDB<CalendarStorage>('calendar-team-workspace', 1, {
    upgrade(db) {
      void db.createObjectStore('workspace').add(initialState(), 'calendar').catch(() => {});
    },
    blocking() {
      void connection?.then(db => db.close());
      connection = undefined;
    },
    terminated() { connection = undefined; },
  }).catch((error: unknown) => {
    connection = undefined;
    throw error;
  });
  return connection;
}

function requireWorkspace(state?: LocalState): LocalState {
  if (!state) throw new Error('无法打开个人版数据');
  return state;
}

export async function readLocal<T>(operation: (state: LocalState) => T) {
  const db = await openCalendar();
  return operation(requireWorkspace(await db.get('workspace', 'calendar')));
}

// Keep the read and write in one transaction so concurrent tabs see each other's edits.
export async function writeLocal<T>(operation: (state: LocalState) => T) {
  const db = await openCalendar();
  const tx = db.transaction('workspace', 'readwrite');
  const handled = tx.done.catch(() => {});
  try {
    const state = requireWorkspace(await tx.store.get('calendar'));
    const result = operation(state);
    await tx.store.put(state, 'calendar');
    await tx.done;
    return result;
  } finally {
    await handled;
  }
}

export async function resetLocalWorkspace() {
  const db = await openCalendar();
  const tx = db.transaction('workspace', 'readwrite');
  const handled = tx.done.catch(() => {});
  try {
    await tx.store.put(initialState(), 'calendar');
    await tx.done;
  } finally {
    await handled;
  }
}
