import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
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
      elevation={8}
      sx={{
        display: { xs: 'block', md: 'none' },
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (t) => t.zIndex.appBar,
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <BottomNavigation
        showLabels
        value={currentIndex >= 0 ? currentIndex : false}
        sx={{
          '& .MuiBottomNavigationAction-root': {
            minWidth: 0,
            minHeight: 56,
            py: 1,
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
              sx={{
                '&.active': {
                  color: 'primary.main',
                },
              }}
            />
          );
        })}
      </BottomNavigation>
    </Paper>
  );
}
