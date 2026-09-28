import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { getManagerMobileShortcuts } from '@/config/dashboardMobileShortcuts';
import { panelCardSx, panelTitleSx } from '@/components/dashboard/manager/dashboardPanelStyles';

type Props = {
  pumpDayIso: string;
};

export function ManagerQuickActions({ pumpDayIso }: Props) {
  const actions = getManagerMobileShortcuts(pumpDayIso);

  return (
    <Box sx={{ ...panelCardSx, display: { xs: 'none', md: 'block' } }}>
      <Typography sx={{ ...panelTitleSx, mb: 1.25 }}>Quick actions</Typography>
      <Stack direction="row" flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
        {actions.map((a) => (
          <Button
            key={a.label}
            component={RouterLink}
            to={a.to}
            variant="outlined"
            size="small"
            startIcon={a.icon}
            sx={{
              flex: '0 1 auto',
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              py: 0.85,
            }}
          >
            {a.label}
          </Button>
        ))}
      </Stack>
    </Box>
  );
}
