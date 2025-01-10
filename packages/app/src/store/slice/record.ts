import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';

export interface Records {
  tagId: string;
  content?: string;
  id: string;
  startTime: number;
  endTime: number;
  // 跳过的节假日日期
  skipDate: Array<number>;
  // 是否跳过节假日
  selectedHoliday: boolean;
}

export interface RecordState {
  records: Records[];
}

const initialState: RecordState = {
  records: [],
};

const recordSlice = createSlice({
  name: 'record',
  initialState,
  reducers: {
    addRecord: (state, action: PayloadAction<Records>) => {
      state.records.push(action.payload);
    },
    updateRecord: (
      state,
      action: PayloadAction<{
        id: string;
        data: Partial<Records>;
      }>,
    ) => {
      const { id, data } = action.payload;

      const record = state.records.find((f) => f.id === id);
      if (!record) {
        return;
      }
      Object.assign(record, data);
    },
    removeRecordTag: (state, action: PayloadAction<string>) => {
      const tagId = action.payload;
      state.records = state.records.filter((f) => f.tagId !== tagId);
    },

    removeRecord: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      state.records = state.records.filter((f) => f.id !== id);
    },
  },
});

export const { addRecord, updateRecord, removeRecordTag, removeRecord } =
  recordSlice.actions;

export default recordSlice.reducer;
export const selectRecord = (state: RootState) => state.record;
