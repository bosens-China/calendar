import { request, setToken } from './client';
import type {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  Member,
} from '@calendar/shared';

export async function loginApi(data: LoginRequest): Promise<LoginResponse> {
  const res = await request<LoginResponse | { token: string; user?: Member }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (res.token) {
    setToken(res.token);
  }
  return res as LoginResponse;
}

export async function getMeApi(): Promise<Member> {
  const res = await request<{ user: Member } | Member>('/api/auth/me');
  return ((res as { user: Member }).user ?? res) as Member;
}

export async function changePasswordApi(data: ChangePasswordRequest): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function forgotPasswordApi(data: ForgotPasswordRequest): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export const authApi = {
  login: loginApi,
  getMe: getMeApi,
  changePassword: changePasswordApi,
  forgotPassword: forgotPasswordApi,
};

