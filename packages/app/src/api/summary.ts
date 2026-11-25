import { request } from './client';
import type { PeriodSummaryResponse } from '@calendar/shared';

export interface SummaryQueryParams {
  startDate: string;
  endDate: string;
  projectId?: string;
  memberId?: string;
}

export async function getSummaryApi(params: SummaryQueryParams, signal?: AbortSignal): Promise<PeriodSummaryResponse> {
  return request<PeriodSummaryResponse>('/api/summary', {
    params: { ...params }, signal,
  });
}

export const summaryApi = {
  getSummary: getSummaryApi,
};

