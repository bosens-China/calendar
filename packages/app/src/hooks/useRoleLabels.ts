import { useQuery } from '@tanstack/react-query';
import { DEFAULT_ROLE_LABELS } from '@calendar/shared';
import { LOCAL_MODE } from '../api';
import { teamApi } from '../api/team';

export const roleLabelsKey = ['settings', 'roleLabels'] as const;

export function useRoleLabels() {
  const query = useQuery({
    queryKey: roleLabelsKey,
    queryFn: ({ signal }) => teamApi.getRoleLabels(signal),
    enabled: !LOCAL_MODE,
  });
  return { ...query, labels: query.data ?? DEFAULT_ROLE_LABELS };
}
