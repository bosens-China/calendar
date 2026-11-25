import { request } from './client';
import type {
  CreateTaskRequest,
  Task,
  UpdateTaskRequest,
} from '@calendar/shared';

export interface TaskQueryParams {
  startDate?: string;
  endDate?: string;
  projectId?: string;
  assigneeId?: string;
  status?: string;
}

export async function getTasksApi(params?: TaskQueryParams, signal?: AbortSignal): Promise<Task[]> {
  const list = await request<Task[]>('/api/tasks', {
    params: { ...params }, signal,
  });
  if (!Array.isArray(list)) throw new Error('服务器返回的数据格式不正确');
  return list;
}

export async function createTaskApi(data: CreateTaskRequest): Promise<Task> {
  return request<Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTaskApi(id: string, data: UpdateTaskRequest): Promise<Task> {
  return request<Task>(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteTaskApi(id: string): Promise<void> {
  await request(`/api/tasks/${id}`, {
    method: 'DELETE',
  });
}

export const tasksApi = {
  getTasks: getTasksApi,
  createTask: createTaskApi,
  updateTask: updateTaskApi,
  deleteTask: deleteTaskApi,
};

