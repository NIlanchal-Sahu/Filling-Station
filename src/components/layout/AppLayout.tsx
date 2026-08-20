import type { ReactNode } from 'react';
import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import { useNavigate, Outlet, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

type Props = {
  showNav?: boolean;
  children?: ReactNode;
};

export function AppLayout({ showNav = true, children }: Props) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const home =
    profile?.role === 'manager' ? '/manager' : profile?.role === 'operator' ? '/operator' : '/';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      {showNav && (
        <AppBar position="sticky" color="primary" enableColorOnDark>
          <Toolbar>
            <Typography
              component={RouterLink}
              to={home}
              variant="h6"
              sx={{ flexGrow: 1, textDecoration: 'none', color: 'inherit' }}
            >
              PumpStock
            </Typography>
            {profile && (
              <Button
                color="inherit"
                onClick={async () => {
                  await signOut();
                  navigate('/login', { replace: true });
                }}
              >
                Logout
              </Button>
            )}
          </Toolbar>
        </AppBar>
      )}
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {children ?? <Outlet />}
      </Container>
    </Box>
  );
}
