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

export async function getLeavesApi(params?: LeaveQueryParams, signal?: AbortSignal): Promise<Leave[]> {
  const list = await request<Leave[]>('/api/leaves', {
    params: { ...params }, signal,
  });
  if (!Array.isArray(list)) throw new Error('服务器返回的数据格式不正确');
  return list;
}

export async function createLeaveApi(data: CreateLeaveRequest): Promise<Leave> {
  return request<Leave>('/api/leaves', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateLeaveApi(id: string, data: UpdateLeaveRequest): Promise<Leave> {
  return request<Leave>(`/api/leaves/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
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

