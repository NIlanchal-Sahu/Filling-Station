import { useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types/entities';
import { parseUserRole } from '@/utils/roles';
import {
  canAccessRoute,
  hasAnyPermission,
  hasPermission,
  isOpsViewer,
  isOpsWriter,
  type Permission,
} from '@/utils/permissions';

export function usePermissions() {
  const { profile } = useAuth();
  const role: UserRole | null = profile ? parseUserRole(profile.role) : null;

  const can = useCallback((permission: Permission) => hasPermission(role, permission), [role]);
  const canAny = useCallback(
    (permissions: Permission[]) => hasAnyPermission(role, permissions),
    [role],
  );
  const canAccess = useCallback((pathname: string) => canAccessRoute(role, pathname), [role]);

  return useMemo(
    () => ({
      role,
      can,
      canAny,
      canAccess,
      isOpsWriter: isOpsWriter(role),
      isOpsViewer: isOpsViewer(role),
      readOnlyOps: role === 'owner',
    }),
    [role, can, canAny, canAccess],
  );
}
