import { request } from './client';
import type {
  CreateProjectRequest,
  Project,
  UpdateProjectRequest,
} from '@calendar/shared';

export async function getProjectsApi(signal?: AbortSignal): Promise<Project[]> {
  const list = await request<Project[]>('/api/projects', { signal });
  if (!Array.isArray(list)) throw new Error('服务器返回的数据格式不正确');
  return list;
}

export async function createProjectApi(data: CreateProjectRequest): Promise<Project> {
  return request<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProjectApi(id: string, data: UpdateProjectRequest): Promise<Project> {
  return request<Project>(`/api/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteProjectApi(id: string): Promise<void> {
  await request(`/api/projects/${id}`, {
    method: 'DELETE',
  });
}

export const projectsApi = {
  getProjects: getProjectsApi,
  createProject: createProjectApi,
  updateProject: updateProjectApi,
  deleteProject: deleteProjectApi,
};

