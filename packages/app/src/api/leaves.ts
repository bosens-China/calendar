import { request } from './client';
import type {
  CreateLeaveRequest,
  Leave,
  UpdateLeaveRequest,
} from '@calendar/shared';

export interface LeaveQueryParams {
  startDate?: string;
  endDate?: string;
  memberId?: string;
}

export async function getLeavesApi(params?: LeaveQueryParams): Promise<Leave[]> {
  const res = await request<{ leaves: Leave[] } | Leave[]>('/api/leaves', {
    params: params as Record<string, string | undefined>,
  });
  const list = (res as { leaves: Leave[] }).leaves ?? res;
  return Array.isArray(list) ? list : [];
}

export async function createLeaveApi(data: CreateLeaveRequest): Promise<Leave> {
  const res = await request<{ leave: Leave } | Leave>('/api/leaves', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return ((res as { leave: Leave }).leave ?? res) as Leave;
}

export async function updateLeaveApi(id: string, data: UpdateLeaveRequest): Promise<Leave> {
  const res = await request<{ leave: Leave } | Leave>(`/api/leaves/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return ((res as { leave: Leave }).leave ?? res) as Leave;
}

export async function deleteLeaveApi(id: string): Promise<void> {
  await request(`/api/leaves/${id}`, {
    method: 'DELETE',
  });
}

export const leavesApi = {
  getLeaves: getLeavesApi,
  createLeave: createLeaveApi,
  updateLeave: updateLeaveApi,
  deleteLeave: deleteLeaveApi,
};

