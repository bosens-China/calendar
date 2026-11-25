import { request } from './client';
import type {
  HolidayOverride,
  WorkSlot,
} from '@calendar/shared';

export async function getWorkSlotsApi(): Promise<WorkSlot[]> {
  const res = await request<{ slots: WorkSlot[] } | WorkSlot[]>('/api/settings/work-slots');
  const list = (res as { slots: WorkSlot[] }).slots ?? res;
  return Array.isArray(list) ? list : [];
}

export async function updateWorkSlotsApi(slots: WorkSlot[]): Promise<WorkSlot[]> {
  const res = await request<{ slots: WorkSlot[] } | WorkSlot[]>('/api/settings/work-slots', {
    method: 'PUT',
    body: JSON.stringify({ slots }),
  });
  const list = (res as { slots: WorkSlot[] }).slots ?? res;
  return Array.isArray(list) ? list : [];
}

export async function getHolidaysApi(year?: number): Promise<HolidayOverride[]> {
  const res = await request<{ holidays: HolidayOverride[] } | HolidayOverride[]>('/api/settings/holidays', {
    params: year ? { year } : undefined,
  });
  const list = (res as { holidays: HolidayOverride[] }).holidays ?? res;
  return Array.isArray(list) ? list : [];
}

export async function updateHolidaysApi(
  holidays: HolidayOverride[],
  year?: number,
): Promise<HolidayOverride[]> {
  const res = await request<{ holidays: HolidayOverride[] } | HolidayOverride[]>(
    '/api/settings/holidays',
    {
      method: 'PUT',
      body: JSON.stringify(year !== undefined ? { year, holidays } : { holidays }),
    },
  );
  const list = (res as { holidays: HolidayOverride[] }).holidays ?? res;
  return Array.isArray(list) ? list : [];
}

export interface HolidaySyncResponse {
  year: number;
  holidays: HolidayOverride[];
  source: 'github' | 'cache';
  updated: boolean;
}

export async function syncHolidaysApi(year: number): Promise<HolidaySyncResponse> {
  return request<HolidaySyncResponse>('/api/settings/holidays/sync', {
    method: 'POST',
    body: JSON.stringify({ year }),
  });
}

export async function resetHolidaysApi(year?: number): Promise<HolidayOverride[]> {
  const res = await request<{ holidays: HolidayOverride[] } | HolidayOverride[]>(
    '/api/settings/holidays/reset',
    {
      method: 'POST',
      body: JSON.stringify(year ? { year } : {}),
    },
  );
  const list = (res as { holidays: HolidayOverride[] }).holidays ?? res;
  return Array.isArray(list) ? list : [];
}

export const settingsApi = {
  getWorkSlots: getWorkSlotsApi,
  updateWorkSlots: updateWorkSlotsApi,
  getHolidays: getHolidaysApi,
  updateHolidays: updateHolidaysApi,
  syncHolidays: syncHolidaysApi,
  resetHolidays: resetHolidaysApi,
};

