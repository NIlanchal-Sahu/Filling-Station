import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types/entities';

type Props = {
  requireRole?: UserRole;
  /** If true, block operators from the route (e.g. manager-only). */
  managerOnly?: boolean;
};

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

  if (managerOnly && profile.role !== 'manager') {
    return <Navigate to="/operator" replace />;
  }

  if (requireRole && profile.role !== requireRole) {
    if (profile.role === 'manager') {
      return <Navigate to="/manager" replace />;
    }
    if (profile.role === 'operator') {
      return <Navigate to="/operator" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
