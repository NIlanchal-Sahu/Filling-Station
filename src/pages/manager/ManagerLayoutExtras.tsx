import type { CSSProperties } from 'react';
import { Box, Stack, useTheme } from '@mui/material';
import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/manager', label: 'Home' },
  { to: '/manager/credit', label: 'Credit' },
  { to: '/manager/ledger', label: 'Ledger' },
  { to: '/manager/daily-sheet', label: 'Daily sheet' },
  { to: '/manager/fuel', label: 'Fuel prices' },
  { to: '/manager/reports', label: 'Reports' },
  { to: '/manager/reconciliations', label: 'Reconciliations' },
] as const;

export function ManagerNav() {
  const theme = useTheme();
  const linkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({
    color: isActive ? theme.palette.primary.dark : theme.palette.primary.main,
    fontWeight: isActive ? 600 : 400,
    textDecoration: 'none',
    fontSize: theme.typography.body2?.fontSize,
    borderBottom: isActive
      ? `2px solid ${theme.palette.primary.main}`
      : '2px solid transparent',
    paddingBottom: 2,
  });
  return (
    <Box sx={{ mb: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === '/manager'} style={linkStyle}>
            {l.label}
          </NavLink>
        ))}
        <NavLink to="/shifts/new" style={linkStyle}>
          Start shift
        </NavLink>
      </Stack>
    </Box>
  );
}

export function ManagerLayoutWithNav() {
  return (
    <>
      <ManagerNav />
      <Outlet />
    </>
  );
}
