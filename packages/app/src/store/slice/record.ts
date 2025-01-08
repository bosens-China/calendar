import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import dayjs from 'dayjs';

export interface Records {
  tagId: string;
  content: string;
  id: string;
  time: number;
  roleId: string;
}

export interface RecordState {
  records: Record<string, Records[]>;
}

const initialState: RecordState = {
  records: {},
};

const recordSlice = createSlice({
  name: 'record',
  initialState,
  reducers: {
    addRecord: (state, action: PayloadAction<Records>) => {
      const { time } = action.payload;
      const timeStr = dayjs(time).format('YYYY-MM-DD');
      state.records[timeStr] ||= [];
      state.records[timeStr].push(action.payload);
    },
    updateRecord: (
      state,
      action: PayloadAction<{ id: string; data: Partial<Records> }>,
    ) => {
      const { id, data } = action.payload;
      const timeStr = dayjs(data.time).format('YYYY-MM-DD');
      const record = state.records[timeStr]?.find((f) => f.id === id);
      if (!record) {
        return;
      }
      Object.assign(record, data);
    },
    removeRecordTag: (state, action: PayloadAction<string>) => {
      const tagId = action.payload;
      Object.entries(state.records).forEach(([time, records]) => {
        state.records[time] = records.filter((f) => f.tagId !== tagId);
      });
    },
    removeRecord: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      Object.entries(state.records).forEach(([time, records]) => {
        state.records[time] = records.filter((f) => f.id !== id);
      });
    },
  },
});

export const { addRecord, updateRecord, removeRecordTag, removeRecord } =
  recordSlice.actions;

export const selectRecord = (state: RootState) => state.record;
export default recordSlice.reducer;
