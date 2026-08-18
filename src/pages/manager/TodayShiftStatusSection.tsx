import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import {
  alpha,
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';

import { getShiftStatusForPumpDay, type ShiftStatusRow, type ShiftStatusSummary } from '@/services/shiftStatusService';
import {
  SHIFT_STATUS_UPDATED_EVENT,
  shiftStatusChipColor,
  shiftStatusEmoji,
  shiftStatusLabel,
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

function ShiftStatusCard(props: { row: ShiftStatusRow }) {
  const theme = useTheme();
  const { row } = props;
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

  const body = (
    <>
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
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Attendant
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
              {row.attendant}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Machine
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
              {row.machineLabel}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Start
            </Typography>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {row.startTimeLabel}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              End
            </Typography>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {row.endTimeLabel}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Duration
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {row.durationLabel}
            </Typography>
          </Stack>
        </Stack>

        {row.detailPath ? (
          <Typography variant="caption" color="primary" sx={{ mt: 2, display: 'block', fontWeight: 600 }}>
            Tap card for readings, sales & reconciliation →
          </Typography>
        ) : null}
      </CardContent>
    </>
  );

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      {row.detailPath ? (
        <CardActionArea component={RouterLink} to={row.detailPath} sx={{ height: '100%', alignItems: 'stretch' }}>
          {body}
        </CardActionArea>
      ) : (
        body
      )}
    </Card>
  );
}

export function TodayShiftStatusSection(props: { pumpDayIso: string }) {
  const theme = useTheme();
  const { pumpDayIso } = props;
  const [summary, setSummary] = useState<ShiftStatusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setSummary(await getShiftStatusForPumpDay(pumpDayIso));
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
          <GroupsOutlinedIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            👨‍💼 Today&apos;s Shift Status
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Monitor shift activity and staff attendance for the selected day.
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

          {!summary.hasAnyShiftRecord ? (
            <Alert
              severity="info"
              sx={{ borderRadius: 2 }}
              action={
                <Button
                  component={RouterLink}
                  to="/shifts/new"
                  color="inherit"
                  size="small"
                  startIcon={<AddOutlinedIcon />}
                  sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  Create shift
                </Button>
              }
            >
              No shifts have been scheduled for this day.
            </Alert>
          ) : null}

          {summary.alerts.length > 0 ? (
            <Stack spacing={1}>
              {summary.alerts.map((msg) => (
                <Alert
                  key={msg}
                  severity="warning"
                  icon={<WarningAmberOutlinedIcon fontSize="inherit" />}
                  sx={{ borderRadius: 2, py: 0.25 }}
                >
                  {msg}
                </Alert>
              ))}
            </Stack>
          ) : null}

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            }}
          >
            {summary.rows.map((row) => (
              <ShiftStatusCard key={row.shiftLabel} row={row} />
            ))}
          </Box>
        </>
      ) : null}
    </Stack>
  );
}
