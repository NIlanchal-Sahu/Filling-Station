import { useEffect, useState } from 'react';
import {
  alpha,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
  Paper,
} from '@mui/material';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { listOpenShiftsForOperator } from '@/services/shiftsService';
import type { Shift } from '@/types/entities';

function calendarDateDdMmYyyy(cal?: string): string | undefined {
  if (!cal || !/^\d{4}-\d{2}-\d{2}$/.test(cal)) return undefined;
  const [y, m, d] = cal.split('-');
  return `${d}-${m}-${y}`;
}

export function OperatorDashboardPage() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }
    let ok = true;
    (async () => {
      setLoading(true);
      try {
        const list = await listOpenShiftsForOperator(profile.id);
        if (ok) {
          setShifts(list);
        }
      } catch (e) {
        if (ok) {
          setErr(e instanceof Error ? e.message : 'Failed to load shifts');
        }
      } finally {
        if (ok) {
          setLoading(false);
        }
      }
    })();
    return () => {
      ok = false;
    };
  }, [profile]);

  if (!profile) {
    return null;
  }

  const open = shifts[0] ?? null;
  const openBusinessDateDdMm = open ? calendarDateDdMmYyyy(open.calendarDate) : undefined;

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      <Box
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          background: (t) =>
            `linear-gradient(120deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 52%, ${t.palette.primary.light} 115%)`,
          color: 'primary.contrastText',
          p: { xs: 2.5, sm: 3 },
          boxShadow: (t) => `0 12px 40px ${alpha(t.palette.primary.main, 0.28)}`,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <LocalGasStationOutlinedIcon sx={{ opacity: 0.95 }} />
          <Typography variant="overline" sx={{ opacity: 0.92, letterSpacing: '0.12em', fontWeight: 600 }}>
            Dispenser ops
          </Typography>
        </Stack>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Operator dashboard
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.75, maxWidth: 560 }}>
          End meters when your shift wraps, then reconcile payment channels before close. Managers review your submission.
        </Typography>
      </Box>

      {err && <Alert severity="error">{err}</Alert>}

      {loading ? (
        <Paper variant="outlined" sx={{ borderRadius: 2, py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={44} thickness={4} />
          <Typography color="text.secondary">Loading your shift…</Typography>
        </Paper>
      ) : (
        <>
          <Card
            elevation={0}
            sx={{
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
              '&:hover': { boxShadow: (t) => `0 8px 24px ${alpha(t.palette.common.black, 0.06)}` },
            }}
          >
            <Box sx={{ height: 3, bgcolor: open ? 'info.main' : 'text.disabled' }} />
            <CardContent sx={{ pt: 2.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                Your open shift
              </Typography>
              {open ? (
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" useFlexGap>
                    <Chip label={open.shiftLabel} color="primary" variant="outlined" sx={{ fontWeight: 600 }} />
                    {openBusinessDateDdMm != null ? (
                      <Chip label={openBusinessDateDdMm} size="small" variant="filled" sx={{ fontWeight: 600 }} />
                    ) : null}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Complete meter readings, then reconcile Paytm / cards / credit and cash against the meter total.
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                    {!open.readingsCompleteAt && (
                      <Button variant="contained" size="large" onClick={() => nav(`/shifts/${open.id}/meters`)} sx={{ borderRadius: 1.5 }}>
                        Enter meter readings
                      </Button>
                    )}
                    {open.readingsCompleteAt && (
                      <Button variant="contained" size="large" onClick={() => nav(`/shifts/${open.id}/reconcile`)} sx={{ borderRadius: 1.5 }}>
                        End-of-shift reconciliation
                      </Button>
                    )}
                  </Stack>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No active shift — start one when you arrive on duty.
                </Typography>
              )}
            </CardContent>
          </Card>

          <Button
            variant="contained"
            color="secondary"
            size="large"
            startIcon={<PlayCircleOutlineOutlinedIcon />}
            onClick={() => nav('/shifts/new')}
            disabled={!!open}
            sx={{ borderRadius: 1.5, alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
          >
            {open ? 'Finish current shift before starting another' : 'Start shift'}
          </Button>
        </>
      )}
    </Stack>
  );
}
