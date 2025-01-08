import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';

export interface List {
  name: string;
  color: string;
  id: string;
  roleId: string;
}

export interface TagState {
  list: Record<string, List>;
}

const initialState: TagState = {
  list: {},
};

export const tagSlice = createSlice({
  name: 'tag',
  // `createSlice` 将从 `initialState` 参数推断 state 类型
  initialState,
  reducers: {
    addTag: (state, action: PayloadAction<List>) => {
      const { id } = action.payload;
      state.list[id] = action.payload;
    },
    removeTag: (state, action: PayloadAction<string>) => {
      const name = action.payload;
      delete state.list[name];
    },
    updateTag: (
      state,
      action: PayloadAction<{ id: string; data: Omit<List, 'id'> }>,
    ) => {
      const { id, data } = action.payload;
      Object.assign(state.list[id], data);
    },
  },
});

export const { addTag, removeTag, updateTag } = tagSlice.actions;
// 选择器等其他代码可以使用导入的 `RootState` 类型
export const selectTag = (state: RootState) => state.tag;

export default tagSlice.reducer;
