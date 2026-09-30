import { alpha, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import { getManagerMobileShortcuts } from '@/config/dashboardMobileShortcuts';

type Props = {
  pumpDayIso: string;
};

export function ManagerQuickActions({ pumpDayIso }: Props) {
  const actions = getManagerMobileShortcuts(pumpDayIso);

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 3.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: (t) =>
          t.palette.mode === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.03)',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'text.secondary',
            fontSize: '0.68rem',
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
          }}
        >
          <BoltOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
          QUICK ACTIONS
        </Typography>
      </Stack>
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          pb: 0.5,
          mx: -0.5,
          px: 0.5,
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
        }}
      >
        {actions.map((a) => (
          <Button
            key={a.label}
            component={RouterLink}
            to={a.to}
            variant="outlined"
            size="small"
            startIcon={a.icon}
            sx={{
              flexShrink: 0,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.78rem',
              py: 0.65,
              px: 1.25,
              borderColor: 'divider',
              bgcolor: (t) => alpha(t.palette.primary.main, 0.03),
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
              },
            }}
          >
            {a.label}
          </Button>
        ))}
      </Box>
    </Paper>
  );
}
