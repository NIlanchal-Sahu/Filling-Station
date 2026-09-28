import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { panelStretchSx, panelTitleSx } from '@/components/dashboard/owner/ownerPanelStyles';
import { withPumpDayQuery } from '@/utils/dateEntryPolicy';

const LINKS = [
  { label: 'Full reports hub', to: '/manager/reports' },
  { label: 'Attendant sheet', to: '/manager/attendant-sheet', withPumpDay: true },
  { label: 'Daily cash sheet', to: '/manager/daily-sheet', withPumpDay: true },
  { label: 'Expenses report', to: '/manager/reports?report=expenses', withPumpDay: true },
  { label: 'Fuel stock history', to: '/manager/fuel-stock/daily' },
  {
    label: 'Dip value register',
    to: '/manager/reports?report=fuel-stock&kind=dipValue',
    withPumpDay: true,
  },
  { label: 'Fuel purchase register', to: '/manager/fuel-stock/purchase', withPumpDay: true },
  { label: 'Credit register', to: '/manager/credit' },
  { label: 'Reconciliation review', to: '/manager/reconciliations' },
] as const;

type Props = {
  pumpDayIso: string;
};

export function OwnerDetailedReports({ pumpDayIso }: Props) {
  return (
    <Box sx={panelStretchSx}>
      <Typography sx={{ ...panelTitleSx, mb: 1.25 }}>Detailed reports</Typography>
      <Stack spacing={0.5} sx={{ flex: 1 }}>
        {LINKS.map((link) => (
          <Button
            key={link.to}
            component={RouterLink}
            to={'withPumpDay' in link && link.withPumpDay ? withPumpDayQuery(link.to, pumpDayIso) : link.to}
            size="small"
            endIcon={<OpenInNewOutlinedIcon sx={{ fontSize: 16 }} />}
            sx={{ justifyContent: 'space-between', textTransform: 'none', fontWeight: 600, py: 0.75 }}
          >
            {link.label}
          </Button>
        ))}
      </Stack>
    </Box>
  );
}
