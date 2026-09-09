import { useEffect, useState } from 'react';
import { Box, Container, Drawer, Snackbar, useMediaQuery, useTheme } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getMobileBottomNavItems, getNavGroupsForRole } from '@/config/navConfig';
import { parseUserRole } from '@/utils/roles';
import { DRAWER_WIDTH } from '@/theme/theme';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { Sidebar, SidebarDrawerContent } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';

export function AppShell() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deniedOpen, setDeniedOpen] = useState(false);
  const location = useLocation();
  const { profile } = useAuth();

  useEffect(() => {
    if ((location.state as { accessDenied?: boolean } | null)?.accessDenied) {
      setDeniedOpen(true);
    }
  }, [location.state, location.pathname]);

  const role = parseUserRole(profile?.role);
  const navGroups = getNavGroupsForRole(role);
  const bottomNavItems = getMobileBottomNavItems(role);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar groups={navGroups} />
      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <SidebarDrawerContent groups={navGroups} onNavigate={() => setDrawerOpen(false)} />
      </Drawer>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar showMenuButton={isMobile} onMenuClick={() => setDrawerOpen(true)} />
        <Box component="main" sx={{ flex: 1, pb: { xs: 9, md: 3 }, pt: { xs: 2, sm: 3 } }}>
          <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
            <Outlet />
          </Container>
        </Box>
        <MobileBottomNav items={bottomNavItems} />
      </Box>
      <Snackbar
        open={deniedOpen}
        autoHideDuration={4000}
        onClose={() => setDeniedOpen(false)}
        message="You don't have access to this page."
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
