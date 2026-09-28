import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import { getShiftStatusForPumpDay } from '@/services/shiftStatusService';
import { SHIFT_STATUS_UPDATED_EVENT, shiftStatusLabel } from '@/utils/shiftStatusDisplay';
import { panelCardSx, panelTitleSx } from '@/components/dashboard/manager/dashboardPanelStyles';

type ActivityLine = {
  id: string;
  timeLabel: string;
  message: string;
  sortKey: number;
};

type Props = {
  pumpDayIso: string;
};

export function ManagerRecentActivity({ pumpDayIso }: Props) {
  const [lines, setLines] = useState<ActivityLine[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const summary = await getShiftStatusForPumpDay(pumpDayIso);
      const next: ActivityLine[] = [];
      for (const row of summary.rows) {
        if (row.status === 'completed' && row.endTimeLabel !== '—') {
          next.push({
            id: `done-${row.slot}`,
            timeLabel: row.endTimeLabel,
            message: `${row.displayName} closed`,
            sortKey: 2,
          });
        } else if (row.status === 'active' && row.startTimeLabel !== '—') {
          next.push({
            id: `active-${row.slot}`,
            timeLabel: row.startTimeLabel,
            message: `${row.displayName} started`,
            sortKey: 1,
          });
        } else if (row.status === 'reconciliation_pending') {
          next.push({
            id: `recon-${row.slot}`,
            timeLabel: row.endTimeLabel !== '—' ? row.endTimeLabel : '—',
            message: `${row.displayName}: ${shiftStatusLabel(row.status)}`,
            sortKey: 3,
          });
        }
      }
      setLines(next);
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

  const visible = useMemo(() => lines.slice(0, 5), [lines]);

  if (loading) {
    return (
      <Box sx={{ ...panelCardSx, display: 'flex', justifyContent: 'center', py: 2.5 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={panelCardSx}>
      <Typography sx={{ ...panelTitleSx, mb: 1.25 }}>Recent activity</Typography>
      {visible.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No shift activity recorded for this pump day yet.
        </Typography>
      ) : (
        <Stack spacing={0.75}>
          {visible.map((line) => (
            <Typography key={line.id} variant="body2" sx={{ minWidth: 0 }}>
              <Box component="span" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {line.timeLabel}
              </Box>
              {' — '}
              {line.message}
            </Typography>
          ))}
        </Stack>
      )}
      <Button
        component={RouterLink}
        to={`/manager/shift-activity?day=${pumpDayIso}`}
        size="small"
        endIcon={<ArrowForwardOutlinedIcon />}
        sx={{ mt: 1.25, textTransform: 'none', fontWeight: 600, px: 0 }}
      >
        View all activity
      </Button>
    </Box>
  );
}
