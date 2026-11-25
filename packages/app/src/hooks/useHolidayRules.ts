import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { HolidayOverride } from '@calendar/shared';
import { settingsApi } from '../api';

export function holidayYearQuery(year: number) {
  return {
    queryKey: ['settings', 'holidays', year] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) => settingsApi.getHolidays(year, signal),
  };
}

function combineYears(results: UseQueryResult<HolidayOverride[]>[]) {
  return {
    holidays: results.flatMap(result => result.data ?? []),
    hasData: results.length > 0 && results.every(result => result.data !== undefined),
    isLoading: results.some(result => result.isLoading),
    isError: results.some(result => result.isError),
    retry: () => { for (const result of results) if (result.isError) void result.refetch(); },
  };
}

export function useHolidayRules(startDate: string, endDate: string, enabled = true) {
  const start = Number(startDate.slice(0, 4));
  const end = Number(endDate.slice(0, 4));
  const years = enabled && start >= 2026 && end >= start && end - start < 75
    ? Array.from({ length: end - start + 1 }, (_, i) => start + i)
    : [];
  const result = useQueries({ queries: years.map(holidayYearQuery), combine: combineYears });
  const holidayMap = useMemo(() => new Map(result.holidays.map(day => [day.date, day])), [result.holidays]);
  return { ...result, holidayMap };
}
