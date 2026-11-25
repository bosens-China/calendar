import { request } from './client';
import type {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  Member,
} from '@calendar/shared';

export async function loginApi(data: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
    authenticate: false,
  });
}

export async function getMeApi(): Promise<Member> {
  const { user } = await request<{ user: Member }>('/api/auth/me');
  return user;
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
    authenticate: false,
  });
}

export const authApi = {
  login: loginApi,
  getMe: getMeApi,
  changePassword: changePasswordApi,
  forgotPassword: forgotPasswordApi,
};

