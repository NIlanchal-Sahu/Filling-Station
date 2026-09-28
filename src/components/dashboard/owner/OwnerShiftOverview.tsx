import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import { getShiftStatusForPumpDay, type ShiftStatusRow } from '@/services/shiftStatusService';
import { SHIFT_STATUS_UPDATED_EVENT, shiftStatusLabel } from '@/utils/shiftStatusDisplay';
import { panelStretchSx, panelTitleSx } from '@/components/dashboard/owner/ownerPanelStyles';
import { withPumpDayQuery } from '@/utils/dateEntryPolicy';

type Props = {
  pumpDayIso: string;
};

function statusTone(status: ShiftStatusRow['status']): 'success.main' | 'warning.main' | 'error.main' | 'text.secondary' {
  if (status === 'completed' || status === 'active') return 'success.main';
  if (status === 'overdue') return 'error.main';
  if (status === 'reconciliation_pending') return 'warning.main';
  return 'text.secondary';
}

export function OwnerShiftOverview({ pumpDayIso }: Props) {
  const [rows, setRows] = useState<ShiftStatusRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const summary = await getShiftStatusForPumpDay(pumpDayIso);
      setRows(summary.rows);
    } finally {
      setLoading(false);
    }
  }, [pumpDayIso]);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener(SHIFT_STATUS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(SHIFT_STATUS_UPDATED_EVENT, refresh);
  }, [load]);

  if (loading) {
    return (
      <Box sx={{ ...panelStretchSx, display: 'flex', justifyContent: 'center', py: 2.5 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={panelStretchSx}>
      <Typography sx={{ ...panelTitleSx, mb: 1.25 }}>Shift overview</Typography>
      <Stack spacing={0.75} sx={{ flex: 1 }}>
        {rows.map((row) => (
          <Stack key={row.slot} direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }}>
              {row.displayName.replace(' Shift', '')}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: statusTone(row.status), flexShrink: 0 }}>
              {shiftStatusLabel(row.status)}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Button
        component={RouterLink}
        to={withPumpDayQuery('/owner/shift-activity', pumpDayIso)}
        size="small"
        endIcon={<ArrowForwardOutlinedIcon />}
        sx={{ mt: 1.25, textTransform: 'none', fontWeight: 600, px: 0 }}
      >
        View shift report
      </Button>
    </Box>
  );
}
