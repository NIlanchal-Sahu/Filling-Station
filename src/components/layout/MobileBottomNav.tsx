import { BottomNavigation, BottomNavigationAction, Paper, alpha } from '@mui/material';
import { NavLink, useLocation } from 'react-router-dom';
import type { NavItem } from '@/config/navConfig';

type Props = {
  items: NavItem[];
};

export function MobileBottomNav({ items }: Props) {
  const location = useLocation();

  const currentIndex = items.findIndex((item) => {
    if (item.end) {
      return location.pathname === item.to;
    }
    return location.pathname === item.to || location.pathname.startsWith(item.to + '/');
  });

  return (
    <Paper
      elevation={6}
      sx={{
        display: { xs: 'block', md: 'none' },
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (t) => t.zIndex.appBar,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: (t) => alpha(t.palette.background.paper, 0.96),
        backdropFilter: 'blur(10px)',
        boxShadow: (t) =>
          t.palette.mode === 'dark'
            ? '0 -4px 16px rgba(0,0,0,0.5)'
            : '0 -4px 16px rgba(0,0,0,0.06)',
      }}
    >
      <BottomNavigation
        showLabels
        value={currentIndex >= 0 ? currentIndex : false}
        sx={{
          bgcolor: 'transparent',
          '& .MuiBottomNavigationAction-root': {
            minWidth: 0,
            minHeight: 56,
            py: 1,
            color: 'text.secondary',
            '&.active': {
              color: 'primary.main',
              fontWeight: 700,
            },
          },
        }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <BottomNavigationAction
              key={item.to + item.label}
              label={item.label}
              icon={<Icon />}
              component={NavLink}
              to={item.to}
            />
          );
        })}
      </BottomNavigation>
    </Paper>
  );
}
