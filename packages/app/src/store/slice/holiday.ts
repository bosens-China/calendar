import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';

export interface Holiday {
  $schema: string;
  $id: string;
  year: number;
  papers: string[];
  days: Day[];
}

interface Day {
  name: string;
  date: string;
  isOffDay: boolean;
}

interface HolidayState {
  holidays: {
    [year: string]: Holiday;
  };
}

const initialState: HolidayState = {
  holidays: {},
};

const holidaySlice = createSlice({
  name: 'holiday',
  initialState,
  reducers: {
    setHolidays: (
      state,
      action: PayloadAction<{ year: string; holidays: Holiday }>,
    ) => {
      const { year, holidays } = action.payload;
      state.holidays[year] = holidays;
    },

    clearHolidays: (state) => {
      state.holidays = {};
    },
  },
});

export const { setHolidays, clearHolidays } = holidaySlice.actions;
export default holidaySlice.reducer;

export const selectHoliday = (state: RootState) => state.holiday;
