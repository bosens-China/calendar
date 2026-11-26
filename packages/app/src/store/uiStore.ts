import { create } from 'zustand';
import { toast } from 'sonner';
import { getCalendarDate } from '@calendar/shared';
import { LOCAL_MODE } from '../api';
import { readLocal, writeLocal } from '../api/local/store';
import { dayjs, clampDateMin, canNavigatePrev } from '../utils/date';

export type PeriodType = 'week' | 'month';

const PERIOD_KEY = 'calendar_period';
const NON_WORKDAYS_KEY = 'calendar_hide_non_workdays';
let periodChanged = false;
let nonWorkdayPreferenceChanged = false;

function readBrowserPreference(key: string) {
  if (LOCAL_MODE) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

interface UiState {
  calendarPeriod: PeriodType;
  currentDate: string; // YYYY-MM-DD
  selectedProjectIds: string[]; // empty means all
  selectedMemberIds: string[]; // empty means all
  onlyGap: boolean;
  hideNonWorkdays: boolean;

  setCalendarPeriod: (period: PeriodType) => Promise<void>;
  setCurrentDate: (date: string) => void;
  setSelectedProjectIds: (ids: string[]) => void;
  setSelectedMemberIds: (ids: string[]) => void;
  setOnlyGap: (onlyGap: boolean) => void;
  setHideNonWorkdays: (hide: boolean) => Promise<void>;

  prevPeriod: () => void;
  nextPeriod: () => void;
  goToToday: () => void;
  resetUiState: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  calendarPeriod: readBrowserPreference(PERIOD_KEY) === 'month' ? 'month' : 'week',
  currentDate: clampDateMin(getCalendarDate()),
  selectedProjectIds: [],
  selectedMemberIds: [],
  onlyGap: false,
  hideNonWorkdays: readBrowserPreference(NON_WORKDAYS_KEY) === 'true',

  setCalendarPeriod: async (calendarPeriod) => {
    periodChanged = true;
    try {
      if (LOCAL_MODE) {
        await writeLocal(state => { state.calendarPeriod = calendarPeriod; });
      } else if (calendarPeriod === 'month') {
        window.localStorage.setItem(PERIOD_KEY, calendarPeriod);
      } else {
        window.localStorage.removeItem(PERIOD_KEY);
      }
    } catch {
      toast.error('无法保存周/月视图偏好');
    }
    set({ calendarPeriod });
  },
  setCurrentDate: (date) => set({ currentDate: clampDateMin(date) }),
  setSelectedProjectIds: (ids) => set({ selectedProjectIds: ids }),
  setSelectedMemberIds: (ids) => set({ selectedMemberIds: ids }),
  setOnlyGap: (onlyGap) => set({ onlyGap }),
  setHideNonWorkdays: async (hideNonWorkdays) => {
    nonWorkdayPreferenceChanged = true;
    try {
      if (LOCAL_MODE) {
        await writeLocal(state => { state.hideNonWorkdays = hideNonWorkdays; });
      } else if (hideNonWorkdays) {
        window.localStorage.setItem(NON_WORKDAYS_KEY, 'true');
      } else {
        window.localStorage.removeItem(NON_WORKDAYS_KEY);
      }
      set({ hideNonWorkdays });
    } catch {
      toast.error('无法保存日历显示偏好');
    }
  },

  prevPeriod: () => {
    const { currentDate, calendarPeriod } = get();
    if (!canNavigatePrev(currentDate, calendarPeriod)) return;
    const d = dayjs(currentDate);
    const nextDate =
      calendarPeriod === 'week' ? d.subtract(1, 'week') : d.subtract(1, 'month');
    set({ currentDate: clampDateMin(nextDate.format('YYYY-MM-DD')) });
  },

  nextPeriod: () => {
    const { currentDate, calendarPeriod } = get();
    const d = dayjs(currentDate);
    const nextDate =
      calendarPeriod === 'week' ? d.add(1, 'week') : d.add(1, 'month');
    set({ currentDate: nextDate.format('YYYY-MM-DD') });
  },

  goToToday: () => {
    set({ currentDate: clampDateMin(getCalendarDate()) });
  },

  resetUiState: () => {
    set({
      currentDate: clampDateMin(getCalendarDate()),
      selectedProjectIds: [],
      selectedMemberIds: [],
      onlyGap: false,
    });
  },
}));

if (LOCAL_MODE) {
  void readLocal(({ calendarPeriod, hideNonWorkdays }) => ({ calendarPeriod, hideNonWorkdays })).then(preferences => {
    const savedPeriod = preferences.calendarPeriod === 'month' ? 'month' : 'week';
    useUiStore.setState(state => ({
      calendarPeriod: periodChanged ? state.calendarPeriod : savedPeriod,
      hideNonWorkdays: nonWorkdayPreferenceChanged ? state.hideNonWorkdays : preferences.hideNonWorkdays ?? false,
    }));
  }).catch(() => {}); // IndexedDB errors are handled on startup.
}
