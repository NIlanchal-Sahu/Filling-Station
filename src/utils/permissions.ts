import type { UserRole } from '@/types/entities';

export type Permission =
  | 'view:dashboard'
  | 'view:reports'
  | 'view:operations'
  | 'view:credit'
  | 'view:ledger'
  | 'edit:shifts'
  | 'edit:credit'
  | 'edit:ledger'
  | 'edit:fuel'
  | 'edit:reconciliation'
  | 'approve:reconciliation'
  | 'backdate:entries'
  | 'manage:team'
  | 'manage:settings';

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  admin: new Set([
    'view:dashboard',
    'view:reports',
    'view:operations',
    'view:credit',
    'view:ledger',
    'edit:shifts',
    'edit:credit',
    'edit:ledger',
    'edit:fuel',
    'edit:reconciliation',
    'approve:reconciliation',
    'backdate:entries',
    'manage:team',
    'manage:settings',
  ]),
  owner: new Set([
    'view:dashboard',
    'view:reports',
    'view:operations',
    'view:credit',
    'view:ledger',
    'approve:reconciliation',
    'backdate:entries',
  ]),
  manager: new Set([
    'view:dashboard',
    'view:reports',
    'view:operations',
    'view:credit',
    'view:ledger',
    'edit:shifts',
    'edit:credit',
    'edit:ledger',
    'edit:fuel',
    'edit:reconciliation',
    'approve:reconciliation',
    'manage:team',
  ]),
  operator: new Set(['view:dashboard', 'view:operations', 'edit:shifts', 'edit:reconciliation']),
};

/** Paths an owner may open (read-only operational views). */
const OWNER_READ_PATH_PREFIXES = [
  '/owner',
  '/manager/reports',
  '/manager/reconciliations',
  '/manager/shift-activity',
  '/manager/fuel-stock',
  '/manager/fuel',
  '/manager/credit',
  '/manager/ledger',
  '/manager/transfers',
  '/manager/daily-sheet',
] as const;

export function hasPermission(
  role: UserRole | null | undefined,
  permission: Permission,
): boolean {
  if (!role) {
    return false;
  }
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function hasAnyPermission(
  role: UserRole | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/** Manager or admin — legacy helper for ops screens that allow write. */
export function isOpsWriter(role: UserRole | null | undefined): boolean {
  return hasPermission(role, 'edit:credit') || hasPermission(role, 'edit:ledger');
}

/** Can view manager-style operational pages (manager, owner, admin). */
export function isOpsViewer(role: UserRole | null | undefined): boolean {
  return hasPermission(role, 'view:operations');
}

export function canAccessRoute(role: UserRole | null | undefined, pathname: string): boolean {
  if (!role) {
    return false;
  }

  const path = pathname.split('?')[0] ?? pathname;

  if (path.startsWith('/admin')) {
    return role === 'admin';
  }
  if (path === '/owner' || path.startsWith('/owner/')) {
    return role === 'owner';
  }
  if (path === '/operator' || path.startsWith('/operator/')) {
    return role === 'operator';
  }
  if (path.startsWith('/shifts')) {
    return role === 'operator' || role === 'manager' || role === 'admin';
  }
  if (path.startsWith('/manager')) {
    if (role === 'manager' || role === 'admin') {
      return true;
    }
    if (role === 'owner') {
      return OWNER_READ_PATH_PREFIXES.some(
        (prefix) => path === prefix || path.startsWith(prefix + '/'),
      );
    }
    return false;
  }

  return path === '/';
}

export function routeRequiresPermission(pathname: string): Permission | null {
  const path = pathname.split('?')[0] ?? pathname;
  if (path.startsWith('/admin/team') || path.startsWith('/manager/team')) {
    return 'manage:team';
  }
  if (path.startsWith('/admin/settings')) {
    return 'manage:settings';
  }
  if (path.startsWith('/manager/credit')) {
    return 'view:credit';
  }
  if (path.startsWith('/manager/ledger') || path.startsWith('/manager/transfers') || path.startsWith('/manager/daily-sheet')) {
    return 'view:ledger';
  }
  if (path.startsWith('/manager/lubricants') || path.startsWith('/manager/fuel-stock/purchase')) {
    return 'edit:fuel';
  }
  if (path.startsWith('/manager/fuel-stock')) {
    return 'view:operations';
  }
  if (path.startsWith('/manager/reports')) {
    return 'view:reports';
  }
  return null;
}
