import type {
  CreateMemberRequest, InvitationDetails, InvitationLink, LoginResponse, Member, RoleLabels,
} from '@calendar/shared';
import { request } from './client';

export type InviteMemberInput = Omit<CreateMemberRequest, 'password'>;

export const teamApi = {
  inviteMember: (profile: InviteMemberInput) =>
    request<InvitationLink & { member: Member }>('/api/members/invitations', {
      method: 'POST', body: JSON.stringify(profile),
    }),
  renewInvitation: (id: string) =>
    request<InvitationLink>(`/api/members/${id}/invitation`, { method: 'POST' }),
  revokeInvitation: (id: string) =>
    request(`/api/members/${id}/invitation`, { method: 'DELETE' }),
  previewInvitation: (token: string, signal?: AbortSignal) =>
    request<InvitationDetails>('/api/auth/invitations/preview', {
      method: 'POST', body: JSON.stringify({ token }), authenticate: false, signal,
    }),
  acceptInvitation: (token: string, password: string) =>
    request<LoginResponse>('/api/auth/invitations/accept', {
      method: 'POST', body: JSON.stringify({ token, password }), authenticate: false,
    }),
  updateProfile: async (name: string) => {
    const { user } = await request<{ user: Member }>('/api/auth/me', {
      method: 'PATCH', body: JSON.stringify({ name }),
    });
    return user;
  },
  getRoleLabels: (signal?: AbortSignal) =>
    request<RoleLabels>('/api/settings/role-labels', { signal }),
  saveRoleLabels: (labels: RoleLabels) =>
    request<RoleLabels>('/api/settings/role-labels', {
      method: 'PUT', body: JSON.stringify(labels),
    }),
};
