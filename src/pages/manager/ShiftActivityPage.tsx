import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import { format, isSameDay } from 'date-fns';
import { ReadOnlyBanner } from '@/components/ui/ReadOnlyBanner';
import { usePermissions } from '@/hooks/usePermissions';
import { getShiftActivityForSlot, type ShiftMachineHolder, type ShiftStatusRow } from '@/services/shiftStatusService';
import { parsePumpDayParam, withPumpDayQuery } from '@/utils/dateEntryPolicy';
import {
  SHIFT_STATUS_UPDATED_EVENT,
  parseShiftActivitySlot,
  shiftStatusChipColor,
  shiftStatusEmoji,
  shiftStatusLabel,
} from '@/utils/shiftStatusDisplay';
import { SHIFT_SALES_UPDATED_EVENT } from '@/utils/shiftSalesDisplay';

function parseLocalYmd(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function initialPumpDay(searchDay: string | null): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  const fromQuery = parsePumpDayParam(searchDay);
  if (fromQuery && fromQuery <= today) return fromQuery;
  return today;
}

function RightText(props: { children: string }) {
  return (
    <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
      {props.children}
    </Typography>
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
  return [
    {
      name: '—',
      machineLabel: row.machineLabel !== '—' ? row.machineLabel : '—',
      ...scheduled,
    },
  ];
}

function ShiftDetailCard(props: {
  row: ShiftStatusRow;
  attendant: string;
  machineLabel: string;
  startTimeLabel: string;
  endTimeLabel: string;
  durationLabel: string;
}) {
  const theme = useTheme();
  const { row, attendant, machineLabel, startTimeLabel, endTimeLabel, durationLabel } = props;
  const chipColor = shiftStatusChipColor(row.status);
  const accent =
    chipColor === 'success'
      ? theme.palette.success.main
      : chipColor === 'info'
        ? theme.palette.info.main
        : chipColor === 'error'
          ? theme.palette.error.main
          : chipColor === 'warning'
            ? theme.palette.warning.main
            : theme.palette.grey[500];

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ height: 3, bgcolor: accent }} />
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
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
            label={`${shiftStatusEmoji(row.status)} ${shiftStatusLabel(row.status)}`}
            color={chipColor === 'default' ? 'default' : chipColor}
            variant={chipColor === 'default' ? 'outlined' : 'filled'}
            sx={{ height: 24, fontWeight: 600 }}
          />
        </Stack>

        <Stack spacing={0.75} sx={{ mt: 1.75 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Attendant
            </Typography>
            {attendant === '—' ? (
              <RightText>—</RightText>
            ) : (
              <Chip size="small" label={attendant} sx={{ fontWeight: 600 }} />
            )}
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Machine
            </Typography>
            <RightText>{machineLabel}</RightText>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Start
            </Typography>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {startTimeLabel}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              End
            </Typography>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {endTimeLabel}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Duration
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {durationLabel}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function ShiftActivityPage() {
  const { role, readOnlyOps } = usePermissions();
  const useScheduledTimes = role === 'admin';
  const location = useLocation();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const maxSelectableIso = format(new Date(), 'yyyy-MM-dd');
  const slot = parseShiftActivitySlot(searchParams.get('slot'));
  const [reportIso, setReportIso] = useState(() => initialPumpDay(searchParams.get('day')));
  const [row, setRow] = useState<ShiftStatusRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setReportIso(initialPumpDay(searchParams.get('day')));
  }, [searchParams]);

  const reportDay = useMemo(() => parseLocalYmd(reportIso), [reportIso]);
  const isSelectedToday = Number.isFinite(reportDay.getTime()) && isSameDay(reportDay, new Date());

  const load = useCallback(async () => {
    setErr(null);
    try {
      setRow(await getShiftActivityForSlot(reportIso, slot));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load shift activity');
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [reportIso, slot]);

  useEffect(() => {
    setLoading(true);
    void load();
    const onRefresh = () => void load();
    window.addEventListener(SHIFT_STATUS_UPDATED_EVENT, onRefresh);
    window.addEventListener(SHIFT_SALES_UPDATED_EVENT, onRefresh);
    window.addEventListener('focus', onRefresh);
    return () => {
      window.removeEventListener(SHIFT_STATUS_UPDATED_EVENT, onRefresh);
      window.removeEventListener(SHIFT_SALES_UPDATED_EVENT, onRefresh);
      window.removeEventListener('focus', onRefresh);
    };
  }, [load]);

  function setPumpDay(next: string) {
    if (!next || next > maxSelectableIso) return;
    setReportIso(next);
    nav(withPumpDayQuery(`${location.pathname}?slot=${slot}`, next), { replace: true });
  }

  return (
    <Stack spacing={2.5} sx={{ pb: 4 }}>
      {readOnlyOps ? <ReadOnlyBanner /> : null}

      <Paper
        elevation={0}
        sx={{
          p: 1.75,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <CalendarMonthOutlinedIcon sx={{ fontSize: 22, color: 'text.secondary', display: { xs: 'none', sm: 'block' } }} />
          <TextField
            type="date"
            label="Pump day"
            value={reportIso}
            onChange={(e) => setPumpDay(e.target.value)}
            size="small"
            slotProps={{
              htmlInput: { max: maxSelectableIso },
              inputLabel: { shrink: true },
            }}
            sx={{ minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
          />
          {isSelectedToday ? (
            <Chip label="Today" size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
          ) : null}
        </Stack>
      </Paper>

      {err ? <Alert severity="error">{err}</Alert> : null}

      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress size={32} />
        </Stack>
      ) : row ? (
        <Stack spacing={2}>
          {peopleOnShift(row).map((person) => (
            <ShiftDetailCard
              key={`${person.name}-${person.machineLabel}`}
              row={row}
              attendant={person.name}
              machineLabel={person.machineLabel}
              startTimeLabel={useScheduledTimes ? row.scheduledStartLabel : person.startTimeLabel}
              endTimeLabel={useScheduledTimes ? row.scheduledEndLabel : person.endTimeLabel}
              durationLabel={useScheduledTimes ? row.scheduledDurationLabel : person.durationLabel}
            />
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
