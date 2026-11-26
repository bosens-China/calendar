import { create } from 'zustand';
import { toast } from 'sonner';
import { getCalendarDate } from '@calendar/shared';
import { LOCAL_MODE } from '../api';
import { readLocal, writeLocal } from '../api/local/store';
import { dayjs, clampDateMin, canNavigatePrev } from '../utils/date';

export type PeriodType = 'week' | 'month';

const NON_WORKDAYS_KEY = 'calendar_hide_non_workdays';
let displayPreferenceChanged = false;

function readHideNonWorkdays() {
  if (LOCAL_MODE) return false;
  try {
    return window.localStorage.getItem(NON_WORKDAYS_KEY) === 'true';
  } catch {
    return false;
  }
}

interface UiState {
  calendarPeriod: PeriodType;
  currentDate: string; // YYYY-MM-DD
  selectedProjectIds: string[]; // empty means all
  selectedMemberIds: string[]; // empty means all
  onlyGap: boolean;
  hideNonWorkdays: boolean;

  setCalendarPeriod: (period: PeriodType) => void;
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
  calendarPeriod: 'week',
  currentDate: clampDateMin(getCalendarDate()),
  selectedProjectIds: [],
  selectedMemberIds: [],
  onlyGap: false,
  hideNonWorkdays: readHideNonWorkdays(),

  setCalendarPeriod: (period) => set({ calendarPeriod: period }),
  setCurrentDate: (date) => set({ currentDate: clampDateMin(date) }),
  setSelectedProjectIds: (ids) => set({ selectedProjectIds: ids }),
  setSelectedMemberIds: (ids) => set({ selectedMemberIds: ids }),
  setOnlyGap: (onlyGap) => set({ onlyGap }),
  setHideNonWorkdays: async (hideNonWorkdays) => {
    displayPreferenceChanged = true;
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
      calendarPeriod: 'week',
      currentDate: clampDateMin(getCalendarDate()),
      selectedProjectIds: [],
      selectedMemberIds: [],
      onlyGap: false,
    });
  },
}));

if (LOCAL_MODE) {
  void readLocal(state => state.hideNonWorkdays ?? false).then(hideNonWorkdays => {
    if (!displayPreferenceChanged) useUiStore.setState({ hideNonWorkdays });
  }).catch(() => {}); // IndexedDB errors are handled on startup.
}
