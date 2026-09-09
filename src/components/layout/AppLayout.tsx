import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';

type Props = {
  variant?: 'public' | 'app';
  children?: ReactNode;
};

export function AppLayout({ variant = 'app', children }: Props) {
  if (variant === 'public') {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {children ?? <Outlet />}
      </Box>
    );
  }

  return <AppShell />;
}
