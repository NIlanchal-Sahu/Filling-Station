import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types/entities';
import { homePathForRole, isManagerLike } from '@/utils/roles';

type Props = {
  /** Exact role, or any of the listed roles. */
  requireRole?: UserRole | UserRole[];
  /** If true, only manager and admin may enter (operators redirected). */
  managerOnly?: boolean;
};

function matchesRequireRole(role: UserRole, requireRole: UserRole | UserRole[]): boolean {
  const list = Array.isArray(requireRole) ? requireRole : [requireRole];
  return list.includes(role);
}

export function ProtectedRoute({ requireRole, managerOnly }: Props) {
  const { firebaseUser, profile, loading } = useAuth();
  const location = useLocation();

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

  if (!profile) {
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

  if (managerOnly && !isManagerLike(profile.role)) {
    return <Navigate to="/operator" replace />;
  }

  if (requireRole && !matchesRequireRole(profile.role, requireRole)) {
    return <Navigate to={homePathForRole(profile.role)} replace />;
  }

  return <Outlet />;
}
