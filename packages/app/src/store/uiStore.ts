import { create } from 'zustand';
import { getCalendarDate } from '@calendar/shared';
import { dayjs, clampDateMin, canNavigatePrev } from '../utils/date';

export type PeriodType = 'week' | 'month';

interface UiState {
  calendarLayout: 'timeline' | 'calendar';
  calendarPeriod: PeriodType;
  currentDate: string; // YYYY-MM-DD
  selectedProjectIds: string[]; // empty means all
  selectedMemberId: string | null; // null means all
  onlyGap: boolean;
  hideNonWorkdays: boolean;

  setCalendarLayout: (layout: UiState['calendarLayout']) => void;
  setCalendarPeriod: (period: PeriodType) => void;
  setCurrentDate: (date: string) => void;
  setSelectedProjectIds: (ids: string[]) => void;
  setSelectedMemberId: (id: string | null) => void;
  setOnlyGap: (onlyGap: boolean | ((prev: boolean) => boolean)) => void;
  setHideNonWorkdays: (hide: boolean | ((prev: boolean) => boolean)) => void;

  prevPeriod: () => void;
  nextPeriod: () => void;
  goToToday: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  calendarLayout: 'timeline',
  calendarPeriod: 'week',
  currentDate: clampDateMin(getCalendarDate()),
  selectedProjectIds: [],
  selectedMemberId: null,
  onlyGap: false,
  hideNonWorkdays: false,

  setCalendarLayout: (calendarLayout) => set({ calendarLayout }),
  setCalendarPeriod: (period) => set({ calendarPeriod: period }),
  setCurrentDate: (date) => set({ currentDate: clampDateMin(date) }),
  setSelectedProjectIds: (ids) => set({ selectedProjectIds: ids }),
  setSelectedMemberId: (id) => set({ selectedMemberId: id }),
  setOnlyGap: (val) =>
    set((state) => ({ onlyGap: typeof val === 'function' ? val(state.onlyGap) : val })),
  setHideNonWorkdays: (val) =>
    set((state) => ({
      hideNonWorkdays: typeof val === 'function' ? val(state.hideNonWorkdays) : val,
    })),

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
}));
