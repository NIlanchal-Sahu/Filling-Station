import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { alpha, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import { getShiftStatusForPumpDay, type ShiftStatusRow } from '@/services/shiftStatusService';
import { SHIFT_STATUS_UPDATED_EVENT, shiftStatusLabel } from '@/utils/shiftStatusDisplay';
import { withPumpDayQuery } from '@/utils/dateEntryPolicy';

type Props = {
  pumpDayIso: string;
};

function getStatusBadgeConfig(status: ShiftStatusRow['status']): {
  label: string;
  color: string;
  bg: string;
} {
  switch (status) {
    case 'active':
      return { label: 'Active', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)' };
    case 'completed':
      return { label: 'Completed', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)' };
    case 'reconciliation_pending':
      return { label: 'Recon Pending', color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)' };
    case 'overdue':
      return { label: 'Overdue', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.12)' };
    case 'not_started':
    default:
      return { label: 'Not Started', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' };
  }
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
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3.5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          minHeight: 180,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
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
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
      }}
    >
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'text.secondary',
              fontSize: '0.68rem',
            }}
          >
            SHIFT OVERVIEW
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
              color: 'primary.main',
            }}
          >
            <AccessTimeOutlinedIcon sx={{ fontSize: 16 }} />
          </Box>
        </Stack>

        <Stack spacing={1.25}>
          {rows.map((row) => {
            const shiftName = row.displayName.replace(' Shift', '');
            const badge = getStatusBadgeConfig(row.status);

            return (
              <Stack
                key={row.slot}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{
                  py: 0.75,
                  px: 1.25,
                  borderRadius: 2,
                  bgcolor: (t) =>
                    t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.04) : '#f8fafc',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {shiftName}
                </Typography>

                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.75}
                  sx={{
                    px: 1,
                    py: 0.35,
                    borderRadius: 1.5,
                    bgcolor: badge.bg,
                  }}
                >
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      bgcolor: badge.color,
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      color: badge.color,
                      fontSize: '0.72rem',
                    }}
                  >
                    {shiftStatusLabel(row.status)}
                  </Typography>
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      </Box>

      <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          component={RouterLink}
          to={withPumpDayQuery('/owner/shift-activity', pumpDayIso)}
          size="small"
          endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.82rem',
            p: 0,
            color: 'primary.main',
            '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
          }}
        >
          View Shift Report
        </Button>
      </Box>
    </Paper>
  );
}
