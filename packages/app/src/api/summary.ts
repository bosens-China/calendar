import { request } from './client';
import type { PeriodSummaryResponse } from '@calendar/shared';

export interface SummaryQueryParams {
  startDate: string;
  endDate: string;
  projectId?: string;
  memberId?: string;
}

export async function getSummaryApi(params: SummaryQueryParams): Promise<PeriodSummaryResponse> {
  const res = await request<PeriodSummaryResponse>('/api/summary', {
    params: params as unknown as Record<string, string | number | boolean | undefined>,
  });
  return res;
}

export const summaryApi = {
  getSummary: getSummaryApi,
};

