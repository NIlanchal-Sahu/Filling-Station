import { useEffect, useState } from 'react';
import {
  alpha,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiStat } from '@/components/ui/KpiStat';
import { KpiStatSkeleton } from '@/components/ui/KpiStatSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { listOpenShiftsForOperator } from '@/services/shiftsService';
import type { Shift } from '@/types/entities';

function calendarDateDdMmYyyy(cal?: string): string | undefined {
  if (!cal || !/^\d{4}-\d{2}-\d{2}$/.test(cal)) return undefined;
  const [y, m, d] = cal.split('-');
  return `${d}-${m}-${y}`;
}

const touchButtonSx = {
  borderRadius: 1.5,
  minHeight: 48,
  width: { xs: '100%', sm: 'auto' },
};

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
      <PageHeader
        title="Worker dashboard"
        subtitle="Start or continue your shift — enter meter readings and reconcile payments before close."
      />

      {err && <Alert severity="error">{err}</Alert>}

      <Grid container spacing={2}>
        {loading ? (
          <>
            <Grid size={{ xs: 6 }}>
              <KpiStatSkeleton />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <KpiStatSkeleton />
            </Grid>
          </>
        ) : (
          <>
            <Grid size={{ xs: 6 }}>
              <KpiStat
                label="Status"
                value={open ? 'On shift' : 'Off duty'}
                icon={WorkOutlineOutlinedIcon}
                color={open ? 'success' : 'secondary'}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <KpiStat
                label="Shift"
                value={open?.shiftLabel ?? '—'}
                icon={ScheduleOutlinedIcon}
                subtitle={openBusinessDateDdMm}
              />
            </Grid>
          </>
        )}
      </Grid>

      {loading ? (
        <Card elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ py: 4 }}>
            <Stack spacing={2}>
              <Box sx={{ height: 24, bgcolor: 'action.hover', borderRadius: 1, width: '40%' }} />
              <Box sx={{ height: 16, bgcolor: 'action.hover', borderRadius: 1, width: '70%' }} />
              <Box sx={{ height: 48, bgcolor: 'action.hover', borderRadius: 1.5, width: '100%' }} />
            </Stack>
          </CardContent>
        </Card>
      ) : open ? (
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
          <Box sx={{ height: 3, bgcolor: 'info.main' }} />
          <CardContent sx={{ pt: 2.5 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" useFlexGap>
                <Chip label={open.shiftLabel} color="primary" variant="outlined" sx={{ fontWeight: 600 }} />
                {openBusinessDateDdMm != null ? (
                  <Chip label={openBusinessDateDdMm} size="small" variant="filled" sx={{ fontWeight: 600 }} />
                ) : null}
              </Stack>
              {!open.readingsCompleteAt ? (
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => nav(`/shifts/${open.id}/meters`)}
                  sx={touchButtonSx}
                >
                  Enter meter readings
                </Button>
              ) : (
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => nav(`/shifts/${open.id}/reconcile`)}
                  sx={touchButtonSx}
                >
                  End-of-shift reconciliation
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={<LocalGasStationOutlinedIcon sx={{ fontSize: 48 }} />}
          title="No active shift"
          description="Start a shift when you arrive on duty to record meter readings and reconcile payments."
          action={
            <Button
              variant="contained"
              color="secondary"
              size="large"
              startIcon={<PlayCircleOutlineOutlinedIcon />}
              onClick={() => nav('/shifts/new')}
              sx={touchButtonSx}
            >
              Start shift
            </Button>
          }
        />
      )}

    </Stack>
  );
}
