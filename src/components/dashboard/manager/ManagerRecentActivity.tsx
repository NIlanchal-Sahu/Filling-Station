import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { alpha, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { getShiftStatusForPumpDay } from '@/services/shiftStatusService';
import { SHIFT_STATUS_UPDATED_EVENT, shiftStatusLabel } from '@/utils/shiftStatusDisplay';
import { withPumpDayQuery } from '@/utils/dateEntryPolicy';

type ActivityLine = {
  id: string;
  timeLabel: string;
  message: string;
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
          });
        } else if (row.status === 'active' && row.startTimeLabel !== '—') {
          next.push({
            id: `active-${row.slot}`,
            timeLabel: row.startTimeLabel,
            message: `${row.displayName} started`,
          });
        } else if (row.status === 'reconciliation_pending') {
          next.push({
            id: `recon-${row.slot}`,
            timeLabel: row.endTimeLabel !== '—' ? row.endTimeLabel : '—',
            message: `${row.displayName}: ${shiftStatusLabel(row.status)}`,
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
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3.5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          justifyContent: 'center',
          py: 2.5,
        }}
      >
        <CircularProgress size={24} />
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.25 },
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
          <HistoryOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
          RECENT ACTIVITY
        </Typography>
      </Stack>

      {visible.length === 0 ? (
        <Box
          sx={{
            py: 1.5,
            px: 1.25,
            borderRadius: 2,
            bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.04) : '#f8fafc'),
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            No shift activity recorded for this pump day yet.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {visible.map((line) => (
            <Stack
              key={line.id}
              direction="row"
              spacing={1.25}
              sx={{
                py: 0.75,
                px: 1.25,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.04) : '#f8fafc'),
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'text.secondary', minWidth: 52 }}
              >
                {line.timeLabel}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.82rem', fontWeight: 600, flex: 1, minWidth: 0 }}>
                {line.message}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}

      <Button
        component={RouterLink}
        to={withPumpDayQuery('/manager/shift-activity', pumpDayIso)}
        size="small"
        endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: 16 }} />}
        sx={{
          mt: 1.5,
          textTransform: 'none',
          fontWeight: 700,
          fontSize: '0.82rem',
          p: 0,
          color: 'primary.main',
          '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
        }}
      >
        View All Activity
      </Button>
    </Paper>
  );
}
