import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { homePathForRole } from '@/utils/roles';
import { Box, CircularProgress, Typography } from '@mui/material';
import { LandingPage } from '@/pages/auth/LandingPage';

export function HomeRedirectPage() {
  const { profile, loading, firebaseUser } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!firebaseUser) {
      return;
    }
    if (!profile) {
      return;
    }
    nav(homePathForRole(profile.role), { replace: true });
  }, [profile, loading, firebaseUser, nav]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress size={24} />
        <Typography>Loading…</Typography>
      </Box>
    );
  }

  if (!firebaseUser) {
    return <LandingPage />;
  }

  if (!profile) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress size={24} />
        <Typography>Loading profile…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center', minHeight: '40vh' }}>
      <CircularProgress size={24} />
      <Typography>Redirecting…</Typography>
    </Box>
  );
}
