import { request } from './client';
import type {
  CreateProjectRequest,
  Project,
  UpdateProjectRequest,
} from '@calendar/shared';

export async function getProjectsApi(): Promise<Project[]> {
  const res = await request<{ projects: Project[] } | Project[]>('/api/projects');
  const list = (res as { projects: Project[] }).projects ?? res;
  return Array.isArray(list) ? list : [];
}

export async function createProjectApi(data: CreateProjectRequest): Promise<Project> {
  const res = await request<{ project: Project } | Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return ((res as { project: Project }).project ?? res) as Project;
}

export async function updateProjectApi(id: string, data: UpdateProjectRequest): Promise<Project> {
  const res = await request<{ project: Project } | Project>(`/api/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return ((res as { project: Project }).project ?? res) as Project;
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

