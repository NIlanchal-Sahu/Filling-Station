import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types/entities';
import { homePathForRole, parseUserRole } from '@/utils/roles';
import { canAccessRoute, hasPermission, type Permission } from '@/utils/permissions';

type Props = {
  requireRole?: UserRole | UserRole[];
  requirePermission?: Permission;
  managerOnly?: boolean;
};

function matchesRequireRole(role: UserRole, requireRole: UserRole | UserRole[]): boolean {
  const list = Array.isArray(requireRole) ? requireRole : [requireRole];
  return list.includes(role);
}

export function ProtectedRoute({ requireRole, requirePermission, managerOnly }: Props) {
  const { firebaseUser, profile, loading } = useAuth();
  const location = useLocation();

  const role = profile ? parseUserRole(profile.role) : null;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh', gap: 2 }}>
        <CircularProgress size={24} />
        <Typography variant="body2">Loading…</Typography>
      </Box>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!profile || !role) {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto', mt: 4 }}>
        <Alert severity="error">
          <Typography variant="subtitle1">User profile not found</Typography>
          <Typography variant="body2">
            An administrator must create a Firestore document in <code>users/{'{'}uid{'}'}</code>{' '}
            with your role, name, and isActive. Then refresh this page.
          </Typography>
        </Alert>
      </Box>
    );
  }

  if (managerOnly && role !== 'manager' && role !== 'admin') {
    return <Navigate to={homePathForRole(role)} replace state={{ accessDenied: true }} />;
  }

  if (requireRole && !matchesRequireRole(role, requireRole)) {
    return <Navigate to={homePathForRole(role)} replace state={{ accessDenied: true }} />;
  }

  if (requirePermission && !hasPermission(role, requirePermission)) {
    return <Navigate to={homePathForRole(role)} replace state={{ accessDenied: true }} />;
  }

  if (!canAccessRoute(role, location.pathname)) {
    return <Navigate to={homePathForRole(role)} replace state={{ accessDenied: true }} />;
  }

  return <Outlet />;
}
