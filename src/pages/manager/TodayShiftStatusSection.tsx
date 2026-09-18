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

import { usePermissions } from '@/hooks/usePermissions';
import { getShiftStatusForPumpDay, type ShiftStatusRow, type ShiftStatusSummary } from '@/services/shiftStatusService';
import {
  SHIFT_STATUS_UPDATED_EVENT,
  shiftActivityPath,
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

function ShiftStatusCard(props: { row: ShiftStatusRow; to: string }) {
  const theme = useTheme();
  const { row, to } = props;
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
        height: '100%',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <CardActionArea component={RouterLink} to={to} sx={{ height: '100%', alignItems: 'stretch' }}>
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

          <Box sx={{ mt: 1.75 }}>
            {row.presentNames.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                —
              </Typography>
            ) : (
              <Stack direction="row" flexWrap="wrap" useFlexGap sx={{ gap: 0.5 }}>
                {row.presentNames.map((name) => (
                  <Chip key={name} size="small" label={name} sx={{ fontWeight: 600 }} />
                ))}
              </Stack>
            )}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export function TodayShiftStatusSection(props: { pumpDayIso: string; createShiftTo?: string }) {
  const theme = useTheme();
  const { role, readOnlyOps } = usePermissions();
  const { pumpDayIso, createShiftTo = '/shifts/new' } = props;
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
            Who is present on each shift. Tap a card for machine holders.
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
              <ShiftStatusCard
                key={row.shiftLabel}
                row={row}
                to={shiftActivityPath({ owner: role === 'owner', pumpDayIso, slot: row.slot })}
              />
            ))}
          </Box>
        </>
      ) : null}
    </Stack>
  );
}
