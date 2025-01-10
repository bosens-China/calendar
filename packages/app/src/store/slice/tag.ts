import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';

export interface List {
  name: string;
  color: string;
  id: string;
  roleId: string;
}

export interface TagState {
  tags: Record<string, List>;
  openKeys: string[];
}

const initialState: TagState = {
  tags: {},
  openKeys: [],
};

export const tagSlice = createSlice({
  name: 'tag',
  // `createSlice` 将从 `initialState` 参数推断 state 类型
  initialState,
  reducers: {
    addTag: (state, action: PayloadAction<List>) => {
      const { id } = action.payload;
      state.tags[id] = action.payload;
    },
    removeTag: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      delete state.tags[id];
    },
    deleteBasedOnRole: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      Object.keys(state.tags).forEach((key) => {
        if (state.tags[key].roleId === id) {
          delete state.tags[key];
        }
      });
    },
    updateTag: (
      state,
      action: PayloadAction<{ id: string; data: Omit<List, 'id'> }>,
    ) => {
      const { id, data } = action.payload;
      Object.assign(state.tags[id], data);
    },

    updateOpenKeys: (state, action: PayloadAction<string[]>) => {
      state.openKeys = action.payload;
    },

    appendOpenkeys: (state, action: PayloadAction<string>) => {
      state.openKeys.push(action.payload);
    },
  },
});

export const {
  addTag,
  removeTag,
  updateTag,
  deleteBasedOnRole,
  updateOpenKeys,
  appendOpenkeys,
} = tagSlice.actions;
// 选择器等其他代码可以使用导入的 `RootState` 类型
export const selectTag = (state: RootState) => state.tag;

export default tagSlice.reducer;
