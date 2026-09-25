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
import { DRAWER_WIDTH } from '@/theme/theme';

type Props = {
  actions: QuickAction[];
  label?: string;
};

function isActivePath(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function FloatingActionPanel({ actions, label = 'Shortcuts' }: Props) {
  const [open, setOpen] = useState(true);
  const location = useLocation();

  if (actions.length === 0) {
    return null;
  }

  const panelSx = {
    position: 'fixed' as const,
    zIndex: 1100,
    // Stay on the viewport edge until the app content reaches its 1200px
    // maximum, then follow the centered content edge on wide desktops.
    right: {
      xs: 0,
      lg: `max(0px, calc((100% - ${DRAWER_WIDTH}px - 1200px) / 2))`,
    },
    top: { xs: 'auto', sm: '50%' },
    bottom: { xs: 88, sm: 'auto' },
    transform: { xs: 'none', sm: 'translateY(-50%)' },
  };

  if (!open) {
    return (
      <Tooltip title={label} placement="left">
        <IconButton
          onClick={() => setOpen(true)}
          aria-label={`Open ${label}`}
          sx={{
            ...panelSx,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            borderRadius: '10px 0 0 10px',
            width: { xs: 40, sm: 44 },
            height: { xs: 52, sm: 56 },
            boxShadow: (t) => `0 4px 16px ${alpha(t.palette.common.black, 0.18)}`,
            '&:hover': { bgcolor: 'primary.dark' },
          }}
        >
          <ChevronLeftOutlinedIcon />
        </IconButton>
      </Tooltip>
    );
  }

  return (
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
        maxHeight: { xs: 'calc(100vh - 160px)', sm: 'calc(100vh - 120px)' },
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
            width: { xs: 36, sm: 40 },
            height: { xs: 36, sm: 40 },
            mb: 0.5,
            borderRadius: 1.5,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
            color: 'primary.main',
          }}
        >
          <AppsOutlinedIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
        </Box>

        <Stack
          spacing={0.75}
          sx={{
            py: 0.5,
            overflowY: 'auto',
            maxHeight: { xs: 280, sm: 360 },
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
                    width: { xs: 44, sm: 48 },
                    height: { xs: 44, sm: 48 },
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
}
