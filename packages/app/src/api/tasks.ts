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

export async function getTasksApi(params?: TaskQueryParams): Promise<Task[]> {
  const res = await request<{ tasks: Task[] } | Task[]>('/api/tasks', {
    params: params as Record<string, string | undefined>,
  });
  const list = (res as { tasks: Task[] }).tasks ?? res;
  return Array.isArray(list) ? list : [];
}

export async function createTaskApi(data: CreateTaskRequest): Promise<Task> {
  const res = await request<{ task: Task } | Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return ((res as { task: Task }).task ?? res) as Task;
}

export async function updateTaskApi(id: string, data: UpdateTaskRequest): Promise<Task> {
  const res = await request<{ task: Task } | Task>(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return ((res as { task: Task }).task ?? res) as Task;
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

