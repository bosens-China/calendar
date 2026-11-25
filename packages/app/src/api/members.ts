import { request } from './client';
import type {
  CreateMemberRequest,
  Member,
  ResetPasswordRequest,
  UpdateMemberRequest,
} from '@calendar/shared';

export async function getMembersApi(): Promise<Member[]> {
  const res = await request<{ members: Member[] } | Member[]>('/api/members');
  const list = (res as { members: Member[] }).members ?? res;
  return Array.isArray(list) ? list : [];
}

export async function createMemberApi(data: CreateMemberRequest): Promise<Member> {
  const res = await request<{ member: Member } | Member>('/api/members', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return ((res as { member: Member }).member ?? res) as Member;
}

export async function updateMemberApi(id: string, data: UpdateMemberRequest): Promise<Member> {
  const res = await request<{ member: Member } | Member>(`/api/members/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return ((res as { member: Member }).member ?? res) as Member;
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

