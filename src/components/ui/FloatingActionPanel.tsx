import { useState } from 'react';
import {
  alpha,
  Box,
  IconButton,
  Paper,
  Stack,
  Tooltip,
} from '@mui/material';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import ChevronLeftOutlinedIcon from '@mui/icons-material/ChevronLeftOutlined';
import AppsOutlinedIcon from '@mui/icons-material/AppsOutlined';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import type { QuickAction } from '@/components/ui/QuickActionBar';

type Props = {
  actions: QuickAction[];
  label?: string;
};

function isActivePath(pathname: string, to: string): boolean {
  const path = to.split('?')[0].split('#')[0];
  return pathname === path || pathname.startsWith(`${path}/`);
}

const panelSx = {
  position: 'fixed' as const,
  zIndex: 1100,
  right: 0,
  top: '50%',
  transform: 'translateY(-50%)',
};

export function FloatingActionPanel({ actions, label = 'Shortcuts' }: Props) {
  const [open, setOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1200 : false));
  const location = useLocation();

  if (actions.length === 0) {
    return null;
  }

  const panel = !open ? (
    <Tooltip title={label} placement="left">
      <IconButton
        onClick={() => setOpen(true)}
        aria-label={`Open ${label}`}
        sx={{
          ...panelSx,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          borderRadius: '10px 0 0 10px',
          width: 40,
          height: 52,
          boxShadow: (t) => `0 4px 16px ${alpha(t.palette.common.black, 0.18)}`,
          '&:hover': { bgcolor: 'primary.dark' },
        }}
      >
        <ChevronLeftOutlinedIcon />
      </IconButton>
    </Tooltip>
  ) : (
    <Paper
      elevation={6}
      sx={{
        ...panelSx,
        borderRadius: '12px 0 0 12px',
        border: '1px solid',
        borderColor: 'divider',
        borderRight: 'none',
        overflow: 'hidden',
        boxShadow: (t) => `0 8px 28px ${alpha(t.palette.common.black, 0.14)}`,
        maxHeight: 'calc(100vh - 120px)',
      }}
    >
      <Stack alignItems="center" sx={{ py: 0.75, px: 0.5 }}>
        <IconButton
          size="small"
          onClick={() => setOpen(false)}
          aria-label={`Collapse ${label}`}
          sx={{ mb: 0.25, color: 'text.secondary' }}
        >
          <ChevronRightOutlinedIcon fontSize="small" />
        </IconButton>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            mb: 0.5,
            borderRadius: 1.5,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
            color: 'primary.main',
          }}
        >
          <AppsOutlinedIcon sx={{ fontSize: 18 }} />
        </Box>

        <Stack
          spacing={0.75}
          sx={{
            py: 0.5,
            overflowY: 'auto',
            maxHeight: 280,
            width: '100%',
            alignItems: 'center',
          }}
        >
          {actions.map((action) => {
            const active = isActivePath(location.pathname, action.to);
            return (
              <Tooltip key={action.to + action.label} title={action.label} placement="left" arrow>
                <IconButton
                  component={RouterLink}
                  to={action.to}
                  aria-label={action.label}
                  aria-current={active ? 'page' : undefined}
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 1.5,
                    color: active ? 'primary.contrastText' : 'primary.main',
                    bgcolor: (t) =>
                      active ? t.palette.primary.main : alpha(t.palette.primary.main, 0.08),
                    '&:hover': {
                      bgcolor: (t) =>
                        active ? t.palette.primary.dark : alpha(t.palette.primary.main, 0.16),
                    },
                  }}
                >
                  {action.icon}
                </IconButton>
              </Tooltip>
            );
          })}
        </Stack>
      </Stack>
    </Paper>
  );

  return <Box sx={{ display: { xs: 'block', md: 'none' } }}>{panel}</Box>;
}
