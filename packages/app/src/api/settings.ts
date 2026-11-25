import type { HolidayOverride, WorkSlot } from '@calendar/shared';
import { request } from './client';

function checkedList<T>(value: T[]): T[] {
  if (!Array.isArray(value)) throw new Error('服务器返回的数据格式不正确');
  return value;
}

export async function getWorkSlotsApi(signal?: AbortSignal): Promise<WorkSlot[]> {
  const { slots } = await request<{ slots: WorkSlot[] }>('/api/settings/work-slots', { signal });
  return checkedList(slots);
}

export async function updateWorkSlotsApi(slots: WorkSlot[]): Promise<WorkSlot[]> {
  const result = await request<{ slots: WorkSlot[] }>('/api/settings/work-slots', {
    method: 'PUT',
    body: JSON.stringify({ slots }),
  });
  return checkedList(result.slots);
}

export async function getHolidaysApi(year?: number, signal?: AbortSignal): Promise<HolidayOverride[]> {
  const { holidays } = await request<{ holidays: HolidayOverride[] }>('/api/settings/holidays', {
    params: { year }, signal,
  });
  return checkedList(holidays);
}

export async function saveHolidayApi({ date, ...fields }: HolidayOverride): Promise<HolidayOverride> {
  const { data } = await request<{ data: HolidayOverride }>(`/api/settings/holidays/${date}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
  return data;
}

export async function deleteHolidayApi(date: string): Promise<void> {
  await request(`/api/settings/holidays/${date}`, { method: 'DELETE' });
}

export interface HolidaySyncResponse {
  year: number;
  holidays: HolidayOverride[];
  source: 'github' | 'cache';
  updated: boolean;
}

export async function syncHolidaysApi(year?: number): Promise<HolidaySyncResponse> {
  return request<HolidaySyncResponse>('/api/settings/holidays/sync', {
    method: 'POST',
    body: JSON.stringify({ year }),
  });
}

export async function resetHolidaysApi(year?: number): Promise<HolidayOverride[]> {
  const { holidays } = await request<{ holidays: HolidayOverride[] }>('/api/settings/holidays/reset', {
    method: 'POST',
    body: JSON.stringify({ year }),
  });
  return checkedList(holidays);
}

export const settingsApi = {
  getWorkSlots: getWorkSlotsApi,
  updateWorkSlots: updateWorkSlotsApi,
  getHolidays: getHolidaysApi,
  saveHoliday: saveHolidayApi,
  deleteHoliday: deleteHolidayApi,
  syncHolidays: syncHolidaysApi,
  resetHolidays: resetHolidaysApi,
};
