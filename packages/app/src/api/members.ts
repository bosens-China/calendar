import { request } from './client';
import type {
  CreateMemberRequest,
  Member,
  ResetPasswordRequest,
  UpdateMemberRequest,
} from '@calendar/shared';

export async function getMembersApi(signal?: AbortSignal): Promise<Member[]> {
  const list = await request<Member[]>('/api/members', { signal });
  if (!Array.isArray(list)) throw new Error('服务器返回的数据格式不正确');
  return list;
}

// The local workspace creates roster entries without account credentials.
export type ManagedMemberInput = Omit<CreateMemberRequest, 'username' | 'password' | 'role'> &
  Partial<Pick<CreateMemberRequest, 'username' | 'password' | 'role'>>;

export async function createMemberApi(data: ManagedMemberInput): Promise<Member> {
  return request<Member>('/api/members', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateMemberApi(id: string, data: UpdateMemberRequest): Promise<Member> {
  return request<Member>(`/api/members/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function resetMemberPasswordApi(id: string, data: ResetPasswordRequest): Promise<void> {
  await request(`/api/members/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteMemberApi(id: string): Promise<void> {
  await request(`/api/members/${id}`, {
    method: 'DELETE',
  });
}

export const membersApi = {
  getMembers: getMembersApi,
  createMember: createMemberApi,
  updateMember: updateMemberApi,
  resetPassword: resetMemberPasswordApi,
  deleteMember: deleteMemberApi,
};

