import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import {
  alpha,
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';

import { usePermissions } from '@/hooks/usePermissions';
import {
  getShiftStatusForPumpDay,
  type ShiftMachineHolder,
  type ShiftStatusRow,
  type ShiftStatusSummary,
} from '@/services/shiftStatusService';
import {
  SHIFT_STATUS_UPDATED_EVENT,
  shiftActivityPath,
  shiftLifecycleLabel,
  shiftUiPhase,
  shiftUiSurface,
  type ShiftActivitySlot,
} from '@/utils/shiftStatusDisplay';
import { SHIFT_SALES_UPDATED_EVENT } from '@/utils/shiftSalesDisplay';

function SummaryTile(props: { label: string; value: number; accent: string }) {
  const { label, value, accent } = props;
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: (t) => alpha(accent, t.palette.mode === 'dark' ? 0.12 : 0.06),
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: accent }}>
        {value}
      </Typography>
    </Box>
  );
}

function peopleOnShift(row: ShiftStatusRow): {
  name: string;
  machineLabel: string;
  startTimeLabel: string;
  endTimeLabel: string;
  durationLabel: string;
}[] {
  const scheduled = {
    startTimeLabel: row.scheduledStartLabel,
    endTimeLabel: row.scheduledEndLabel,
    durationLabel: row.scheduledDurationLabel,
  };
  if (row.machineHolders.length > 0) {
    const order: string[] = [];
    const machines = new Map<string, string[]>();
    const times = new Map<string, Pick<ShiftMachineHolder, 'startTimeLabel' | 'endTimeLabel' | 'durationLabel'>>();
    for (const holder of row.machineHolders) {
      const key = holder.name.toLowerCase();
      if (!machines.has(key)) {
        order.push(holder.name);
        machines.set(key, []);
        times.set(key, {
          startTimeLabel: holder.startTimeLabel,
          endTimeLabel: holder.endTimeLabel,
          durationLabel: holder.durationLabel,
        });
      }
      const list = machines.get(key)!;
      if (holder.machineLabel && holder.machineLabel !== '—' && !list.includes(holder.machineLabel)) {
        list.push(holder.machineLabel);
      }
    }
    return order.map((name) => ({
      name,
      machineLabel: (machines.get(name.toLowerCase()) ?? []).join(', ') || '—',
      ...(times.get(name.toLowerCase()) ?? scheduled),
    }));
  }
  if (row.presentNames.length > 0) {
    return row.presentNames.map((name) => ({
      name,
      machineLabel: row.machineLabel !== '—' ? row.machineLabel : '—',
      startTimeLabel: row.startTimeLabel,
      endTimeLabel: row.endTimeLabel,
      durationLabel: row.durationLabel,
    }));
  }
  return [];
}

function DetailRow(props: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.75 }}>
      <Typography variant="body2" color="text.secondary">
        {props.label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
        {props.value}
      </Typography>
    </Stack>
  );
}

function ShiftSelectCard(props: {
  row: ShiftStatusRow;
  pumpDayIso: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { row, pumpDayIso, selected, onSelect } = props;
  const phase = shiftUiPhase(row.status, pumpDayIso, row.shiftLabel, row.shiftId);
  const surface = shiftUiSurface(phase);

  return (
    <Card
      component="button"
      type="button"
      onClick={onSelect}
      elevation={0}
      sx={{
        textAlign: 'left',
        width: '100%',
        cursor: 'pointer',
        borderRadius: 2,
        border: '2px solid',
        borderColor: selected ? surface.accent : surface.border,
        bgcolor: surface.bg,
        overflow: 'hidden',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: selected ? `0 0 0 3px ${alpha(surface.accent, 0.2)}` : 'none',
        '&:hover': {
          borderColor: surface.accent,
        },
      }}
    >
      <Box sx={{ height: 4, bgcolor: surface.accent }} />
      <Box sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {row.displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.shiftLabel}
            </Typography>
          </Box>
          <Chip
            size="small"
            label={surface.chipLabel}
            sx={{
              height: 24,
              fontWeight: 700,
              bgcolor: alpha(surface.accent, 0.15),
              color: surface.accent,
              border: '1px solid',
              borderColor: alpha(surface.accent, 0.35),
            }}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.5 }}>
          {row.shiftId
            ? `Started ${row.startTimeLabel !== '—' ? row.startTimeLabel : '—'}`
            : `Scheduled ${row.scheduledStartLabel} – ${row.scheduledEndLabel}`}
        </Typography>
      </Box>
    </Card>
  );
}

function ShiftDetailPanel(props: {
  row: ShiftStatusRow;
  pumpDayIso: string;
  createShiftTo: string;
  readOnlyOps: boolean;
}) {
  const { row, pumpDayIso, createShiftTo, readOnlyOps } = props;
  const phase = shiftUiPhase(row.status, pumpDayIso, row.shiftLabel, row.shiftId);
  const surface = shiftUiSurface(phase);
  const people = peopleOnShift(row);
  const activityTo = shiftActivityPath({ owner: false, pumpDayIso, slot: row.slot });

  return (
    <Box
      sx={{
        mt: 2,
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2,
        border: '1px solid',
        borderColor: surface.border,
        bgcolor: surface.bg,
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            {row.displayName} — details
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {shiftLifecycleLabel(row.status, row.shiftId)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            component={RouterLink}
            to={activityTo}
            variant="outlined"
            size="small"
            endIcon={<OpenInNewOutlinedIcon />}
            sx={{ fontWeight: 600, borderRadius: 2 }}
          >
            View shift activity
          </Button>
          {!row.shiftId && !readOnlyOps ? (
            <Button
              component={RouterLink}
              to={createShiftTo}
              variant="contained"
              size="small"
              startIcon={<PlayCircleOutlineOutlinedIcon />}
              sx={{ fontWeight: 600, borderRadius: 2 }}
            >
              Start shift
            </Button>
          ) : null}
        </Stack>
      </Stack>

      <Divider sx={{ mb: 1.5, borderColor: alpha(surface.accent, 0.25) }} />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        }}
      >
        <Box>
          <DetailRow label="Scheduled window" value={`${row.scheduledStartLabel} – ${row.scheduledEndLabel}`} />
          <DetailRow
            label="Actual start / end"
            value={`${row.startTimeLabel} / ${row.endTimeLabel}`}
          />
          <DetailRow label="Duration" value={row.durationLabel} />
          <DetailRow label="Dispensers" value={row.machineLabel} />
        </Box>
        <Box>
          <DetailRow label="Operator (starter)" value={row.operatorName} />
          {people.length === 0 ? (
            <DetailRow label="Attendants on duty" value="—" />
          ) : (
            <Box sx={{ pt: 0.75 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Attendants on duty
              </Typography>
              <Stack spacing={1}>
                {people.map((person) => (
                  <Box
                    key={person.name}
                    sx={{
                      p: 1.25,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {person.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {person.machineLabel !== '—' ? person.machineLabel : 'No machine assigned'} ·{' '}
                      {person.startTimeLabel} – {person.endTimeLabel}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export function AdminShiftStatusBoard(props: { pumpDayIso: string; createShiftTo?: string }) {
  const theme = useTheme();
  const { readOnlyOps } = usePermissions();
  const { pumpDayIso, createShiftTo = '/shifts/new' } = props;
  const [summary, setSummary] = useState<ShiftStatusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ShiftActivitySlot | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const next = await getShiftStatusForPumpDay(pumpDayIso);
      setSummary(next);
      setSelectedSlot((prev) => {
        if (prev && next.rows.some((r) => r.slot === prev)) {
          return prev;
        }
        return next.rows[0]?.slot ?? null;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load shift status');
    } finally {
      setLoading(false);
    }
  }, [pumpDayIso]);

  useEffect(() => {
    setLoading(true);
    void load();
    const onRefresh = () => void load();
    window.addEventListener(SHIFT_STATUS_UPDATED_EVENT, onRefresh);
    window.addEventListener(SHIFT_SALES_UPDATED_EVENT, onRefresh);
    window.addEventListener('focus', onRefresh);
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      window.removeEventListener(SHIFT_STATUS_UPDATED_EVENT, onRefresh);
      window.removeEventListener(SHIFT_SALES_UPDATED_EVENT, onRefresh);
      window.removeEventListener('focus', onRefresh);
      window.clearInterval(timer);
    };
  }, [load]);

  const attentionCount = useMemo(() => {
    if (!summary) return 0;
    return summary.rows.filter((r) => {
      const phase = shiftUiPhase(r.status, pumpDayIso, r.shiftLabel, r.shiftId);
      return phase === 'overdue' || phase === 'recon_pending';
    }).length;
  }, [summary, pumpDayIso]);

  const selectedRow = summary?.rows.find((r) => r.slot === selectedSlot) ?? null;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box
          sx={{
            p: 1,
            borderRadius: 2,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
            color: 'primary.main',
            display: 'flex',
          }}
        >
          <ScheduleOutlinedIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Pump day shifts
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Select a shift to see operator, attendants, and started / ended status.
          </Typography>
        </Box>
      </Stack>

      {err ? <Alert severity="error">{err}</Alert> : null}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : summary ? (
        <>
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
            }}
          >
            <SummaryTile label="Total shifts" value={summary.totals.totalShifts} accent={theme.palette.text.primary} />
            <SummaryTile label="Active" value={summary.totals.active} accent={theme.palette.success.main} />
            <SummaryTile label="Completed" value={summary.totals.completed} accent={theme.palette.info.main} />
            <SummaryTile
              label="Pending reconciliation"
              value={summary.totals.pendingReconciliation}
              accent={theme.palette.warning.main}
            />
          </Box>

          {attentionCount > 0 ? (
            <Alert severity="warning" sx={{ borderRadius: 2, py: 0.5 }}>
              {attentionCount} shift{attentionCount === 1 ? '' : 's'} need attention (overdue or reconciliation pending).
            </Alert>
          ) : null}

          {!summary.hasAnyShiftRecord ? (
            <Alert
              severity="info"
              sx={{ borderRadius: 2 }}
              action={
                readOnlyOps ? undefined : (
                  <Button
                    component={RouterLink}
                    to={createShiftTo}
                    color="inherit"
                    size="small"
                    startIcon={<AddOutlinedIcon />}
                    sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    Create shift
                  </Button>
                )
              }
            >
              No shifts have been scheduled for this day.
            </Alert>
          ) : null}

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            }}
          >
            {summary.rows.map((row) => (
              <ShiftSelectCard
                key={row.slot}
                row={row}
                pumpDayIso={pumpDayIso}
                selected={selectedSlot === row.slot}
                onSelect={() => setSelectedSlot(row.slot)}
              />
            ))}
          </Box>

          {selectedRow ? (
            <ShiftDetailPanel
              row={selectedRow}
              pumpDayIso={pumpDayIso}
              createShiftTo={createShiftTo}
              readOnlyOps={readOnlyOps}
            />
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
