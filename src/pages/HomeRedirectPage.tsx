import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Box, CircularProgress, Typography } from '@mui/material';

export function HomeRedirectPage() {
  const { profile, loading, firebaseUser } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!firebaseUser) {
      nav('/login', { replace: true });
      return;
    }
    if (!profile) {
      return;
    }
    nav(profile.role === 'manager' ? '/manager' : '/operator', { replace: true });
  }, [profile, loading, firebaseUser, nav]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center', minHeight: '40vh' }}>
      <CircularProgress size={24} />
      <Typography>Redirecting…</Typography>
    </Box>
  );
}
