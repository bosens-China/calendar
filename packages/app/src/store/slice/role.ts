import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';

export interface Role {
  id: string;
  name: string;
}

export interface RoleState {
  roles: Role[];
  currentRole: string[];
}

const initialState: RoleState = {
  roles: [
    {
      id: '-1',
      name: '默认用户',
    },
  ],
  currentRole: ['-1'],
};

const roleSlice = createSlice({
  name: 'role',
  initialState,
  reducers: {
    addRole: (state, action: PayloadAction<Role>) => {
      state.roles.push(action.payload);
    },
    updateRole: (state, action: PayloadAction<Role>) => {
      const index = state.roles.findIndex((f) => f.id === action.payload.id);
      state.roles[index] = action.payload;
    },
    removeRole: (state, action: PayloadAction<string>) => {
      state.roles = state.roles.filter((f) => f.id !== action.payload);
    },
    setCurrentRole: (state, action: PayloadAction<string[]>) => {
      state.currentRole = action.payload;
    },
  },
});

export const { addRole, setCurrentRole, removeRole, updateRole } =
  roleSlice.actions;
export default roleSlice.reducer;

export const selectRole = (state: RootState) => state.role;
