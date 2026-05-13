import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { format } from 'date-fns';

import { listLedgerInRange } from '@/services/ledgerService';
import { listAllReconciliations } from '@/services/reportsHelpers';
import { getShift, listShiftsForCashSheetMerge } from '@/services/shiftsService';
import type { LedgerEntry, Shift, ShiftReconciliation } from '@/types/entities';
import {
  buildDailyCashSheet,
  DEFAULT_PARTY_SHEET_KEYS,
  fmtSheet,
} from '@/utils/dailyCashSheet';
import type { CashBookSummaryRow } from '@/utils/cashBookSummary';
import {
  buildVerticalCashBookForDay,
  cashBookAmtDisplay,
} from '@/utils/dailyCashBookVertical';

const headerSx = {
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  fontSize: '0.72rem',
  letterSpacing: '0.06em',
  bgcolor: 'action.hover',
  color: 'text.secondary',
  whiteSpace: 'nowrap' as const,
  border: '1px solid',
  borderColor: 'divider',
};

const cellSx = {
  fontSize: '0.8125rem',
  whiteSpace: 'nowrap' as const,
  border: '1px solid',
  borderColor: 'divider',
  fontVariantNumeric: 'tabular-nums' as const,
};

export function DailyCashSheetPage() {
  const theme = useTheme();
  const [fromIso, setFromIso] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [toIso, setToIso] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [rows, setRows] = useState<ReturnType<typeof buildDailyCashSheet>>([]);
  const [sheetCache, setSheetCache] = useState<{
    ledger: LedgerEntry[];
    recons: ShiftReconciliation[];
    shiftByShiftId: Map<string, Shift | null>;
  } | null>(null);
  const [cashBookDlg, setCashBookDlg] = useState<{ iso: string; opening: number } | null>(null);
  const [cashBookDialogRows, setCashBookDialogRows] = useState<CashBookSummaryRow[]>([]);
  const [cashBookDlgLoading, setCashBookDlgLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const rangeOk = useMemo(() => {
    const a = new Date(fromIso + 'T00:00:00').getTime();
    const b = new Date(toIso + 'T23:59:59.999').getTime();
    return Number.isFinite(a) && Number.isFinite(b) && a <= b;
  }, [fromIso, toIso]);

  useEffect(() => {
    if (!rangeOk) {
      setRows([]);
      setSheetCache(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const fromD = new Date(fromIso + 'T00:00:00');
        const toD = new Date(toIso + 'T23:59:59.999');
        const [ledger, recons] = await Promise.all([
          listLedgerInRange(fromD, toD),
          listAllReconciliations(),
        ]);
        if (cancelled) return;

        const shiftIds = [...new Set(recons.map((r) => r.shiftId))];
        const pairs = await Promise.all(
          shiftIds.map(async (id) => [id, await getShift(id)] as const),
        );
        const shiftByShiftId = new Map<string, Shift | null>();
        for (const [id, sh] of pairs) {
          shiftByShiftId.set(id, sh);
        }

        const shiftsInReportRange = await listShiftsForCashSheetMerge(fromD, toD);
        if (!cancelled) {
          for (const s of shiftsInReportRange) {
            if (!shiftByShiftId.has(s.id)) {
              shiftByShiftId.set(s.id, s);
            }
          }
        }

        const built = buildDailyCashSheet({ start: fromD, end: toD }, ledger, recons, shiftByShiftId);
        setRows(built);
        setSheetCache({ ledger, recons, shiftByShiftId });
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Load failed');
          setSheetCache(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fromIso, toIso, rangeOk, refreshNonce]);

  const partyKeys = DEFAULT_PARTY_SHEET_KEYS;

  const cashBookDialogLabel = cashBookDlg
    ? format(new Date(cashBookDlg.iso + 'T12:00:00'), 'dd-MMM-yyyy')
    : '';

  useEffect(() => {
    if (!cashBookDlg || !sheetCache) {
      setCashBookDialogRows([]);
      setCashBookDlgLoading(false);
      return;
    }

    let cancelled = false;
    setCashBookDlgLoading(true);

    buildVerticalCashBookForDay(
      cashBookDlg.iso,
      sheetCache.ledger,
      sheetCache.recons,
      sheetCache.shiftByShiftId,
      { openingBalanceOverride: cashBookDlg.opening },
    )
      .then((rows) => {
        if (!cancelled) {
          setCashBookDialogRows(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCashBookDialogRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCashBookDlgLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cashBookDlg, sheetCache]);

  const emptyColSpan = 14 + partyKeys.length;

  const rangeSummary = useMemo(() => {
    if (!rangeOk) {
      return { calendarDays: 0 };
    }
    const startMs = new Date(fromIso + 'T12:00:00').getTime();
    const endMs = new Date(toIso + 'T12:00:00').getTime();
    const calendarDays =
      Number.isFinite(startMs) && Number.isFinite(endMs)
        ? Math.floor((endMs - startMs) / 86400000) + 1
        : 0;
    return { calendarDays };
  }, [rangeOk, fromIso, toIso]);

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
          boxShadow: (t) => `0 12px 40px ${alpha(t.palette.primary.main, 0.3)}`,
        }}
      >
        <Stack spacing={2}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <TableChartOutlinedIcon sx={{ opacity: 0.95 }} />
              <Typography variant="overline" sx={{ opacity: 0.92, letterSpacing: '0.12em', fontWeight: 600 }}>
                Pump day workbook
              </Typography>
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Daily cash sheet
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.75, maxWidth: 720 }}>
              Excel-style pivot: one row per calendar day. <strong>Total cash</strong> uses the same rule as{' '}
              <strong>Ledger</strong> cash in hand: meter sales − PhonePe − ICICI − Fleet − credit − short (latest
              reconciliation per shift). The rightmost <strong>Cash in hand</strong> column is what remains after your
              named bank / party payouts for that day.
            </Typography>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.12 : 0.98),
              color: 'text.primary',
              border: '1px solid',
              borderColor: alpha('#fff', 0.35),
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
              <TextField
                type="date"
                label="From"
                size="small"
                value={fromIso}
                onChange={(e) => setFromIso(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              />
              <TextField
                type="date"
                label="To"
                size="small"
                value={toIso}
                onChange={(e) => setToIso(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              />
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ flex: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshOutlinedIcon />}
                  disabled={loading}
                  onClick={() => setRefreshNonce((n) => n + 1)}
                  sx={{ borderRadius: 1.5, color: 'text.primary', borderColor: alpha('#fff', 0.5) }}
                >
                  Reload data
                </Button>
                <Button
                  component={RouterLink}
                  to="/manager/ledger"
                  variant="contained"
                  color="secondary"
                  sx={{ borderRadius: 1.5 }}
                >
                  Open ledger
                </Button>
              </Stack>
              {!loading && rangeOk ? (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Chip
                    label={`${rangeSummary.calendarDays} calendar day${rangeSummary.calendarDays === 1 ? '' : 's'} in range`}
                    size="small"
                    sx={{ bgcolor: alpha('#fff', 0.14), color: 'inherit', fontWeight: 600 }}
                  />
                  <Chip
                    label={`${rows.length} row${rows.length === 1 ? '' : 's'} built`}
                    size="small"
                    variant="outlined"
                    sx={{ borderColor: alpha('#fff', 0.45), color: 'inherit', fontWeight: 600 }}
                  />
                </Stack>
              ) : null}
            </Stack>
          </Paper>
        </Stack>
      </Box>

      {!rangeOk ? (
        <Alert severity="warning">Choose a valid range (from date must be on or before to date).</Alert>
      ) : null}
      {err && <Alert severity="error">{err}</Alert>}

      {loading ? (
        <Paper variant="outlined" sx={{ borderRadius: 2, py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={44} thickness={4} />
          <Typography color="text.secondary">Building pivot from shifts, reconciliation, and ledger…</Typography>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            gap={1}
            sx={{
              px: 2,
              py: 1.5,
              bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.12 : 0.06),
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Cash sheet grid
              </Typography>
              <Chip label="Scroll → for banks / parties; last column = cash in hand" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 420 }}>
              Date column stays fixed while scrolling. Values follow the same column names as your station spreadsheet.
            </Typography>
          </Stack>
          <Box sx={{ overflowX: 'auto' }}>
            <TableContainer sx={{ minWidth: 1200 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={(t) => ({
                        ...headerSx,
                        position: 'sticky',
                        left: 0,
                        zIndex: 4,
                        bgcolor: 'action.hover',
                        boxShadow: `1px 0 0 ${t.palette.divider}`,
                      })}
                    >
                      Date
                    </TableCell>
                    <TableCell sx={headerSx} align="right">
                      Opening balance
                    </TableCell>
                    <TableCell sx={headerSx} align="right">
                      Total cash
                    </TableCell>
                    <TableCell sx={headerSx} align="right">
                      Expenses
                    </TableCell>
                    <TableCell sx={headerSx} align="right">
                      Salary
                    </TableCell>
                    <TableCell sx={headerSx} align="right">
                      Advance salary
                    </TableCell>
                    <TableCell sx={headerSx} align="right">
                      Balance cash
                    </TableCell>
                    <TableCell sx={headerSx} align="right">
                      Cash adj.
                    </TableCell>
                    <TableCell sx={headerSx} align="right">
                      Total cash 2
                    </TableCell>
                    <TableCell sx={headerSx} align="right">
                      Locker
                    </TableCell>
                    <TableCell sx={headerSx} align="right">
                      Odd balance
                    </TableCell>
                    <TableCell sx={headerSx} align="right">
                      Subtotal (pre-bank)
                    </TableCell>
                    {partyKeys.map((k) => (
                      <TableCell key={k} sx={headerSx} align="right">
                        {k}
                      </TableCell>
                    ))}
                    <TableCell sx={headerSx} align="right">
                      Cash in hand
                    </TableCell>
                    <TableCell sx={{ ...headerSx, minWidth: 108 }} align="center">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 && !loading && rangeOk ? (
                    <TableRow>
                      <TableCell colSpan={emptyColSpan} sx={{ ...cellSx, py: 4, color: 'text.secondary', textAlign: 'center' }}>
                        No rows for this window — enter shifts and reconciliations, and post ledger lines for these dates.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r, idx) => {
                      const stripeBg =
                        idx % 2 === 1 ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.1 : 0.045) : undefined;
                      return (
                        <TableRow key={r.dateIso} sx={{ ...(stripeBg ? { bgcolor: stripeBg } : {}) }}>
                          <TableCell
                            sx={{
                              ...cellSx,
                              position: 'sticky',
                              left: 0,
                              zIndex: 1,
                              fontWeight: 700,
                              bgcolor: stripeBg ?? 'background.paper',
                              boxShadow: (t) => `1px 0 0 ${t.palette.divider}`,
                            }}
                          >
                            {r.dateLabel}
                          </TableCell>
                          <TableCell sx={{ ...cellSx, bgcolor: stripeBg }} align="right">
                            {fmtSheet(r.openingBalance)}
                          </TableCell>
                          <TableCell sx={{ ...cellSx, bgcolor: stripeBg }} align="right">
                            {fmtSheet(r.totalCashShift)}
                          </TableCell>
                          <TableCell sx={{ ...cellSx, bgcolor: stripeBg }} align="right">
                            {fmtSheet(r.expenses)}
                          </TableCell>
                          <TableCell sx={{ ...cellSx, bgcolor: stripeBg }} align="right">
                            {fmtSheet(r.salary)}
                          </TableCell>
                          <TableCell sx={{ ...cellSx, bgcolor: stripeBg }} align="right">
                            {fmtSheet(r.advanceSalary)}
                          </TableCell>
                          <TableCell sx={{ ...cellSx, bgcolor: stripeBg }} align="right">
                            {fmtSheet(r.balanceCash)}
                          </TableCell>
                          <TableCell sx={{ ...cellSx, bgcolor: stripeBg }} align="right">
                            {fmtSheet(r.cashAdjustColumn)}
                          </TableCell>
                          <TableCell sx={{ ...cellSx, bgcolor: stripeBg }} align="right">
                            {fmtSheet(r.totalCash2)}
                          </TableCell>
                          <TableCell sx={{ ...cellSx, bgcolor: stripeBg }} align="right">
                            {fmtSheet(r.locker)}
                          </TableCell>
                          <TableCell sx={{ ...cellSx, bgcolor: stripeBg }} align="right">
                            {fmtSheet(r.oddBalance)}
                          </TableCell>
                          <TableCell sx={{ ...cellSx, bgcolor: stripeBg }} align="right">
                            {fmtSheet(r.cashInHand)}
                          </TableCell>
                          {partyKeys.map((k) => (
                            <TableCell key={`${r.dateIso}-${k}`} sx={{ ...cellSx, bgcolor: stripeBg }} align="right">
                              {fmtSheet(r.parties[k] ?? 0)}
                            </TableCell>
                          ))}
                          <TableCell sx={{ ...cellSx, bgcolor: stripeBg, fontWeight: 700 }} align="right">
                            {fmtSheet(r.closingBalance)}
                          </TableCell>
                          <TableCell sx={{ ...cellSx, bgcolor: stripeBg }} align="center">
                            <Stack direction="row" spacing={0} sx={{ justifyContent: 'center' }}>
                              <Tooltip title="Cash book — Excel-style TOTAL SALES → CLOSING">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  aria-label="Cash book"
                                  onClick={() => setCashBookDlg({ iso: r.dateIso, opening: r.openingBalance })}
                                >
                                  <DescriptionOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Jump to Ledger for this date">
                                <IconButton
                                  size="small"
                                  component={RouterLink}
                                  to={`/manager/ledger?from=${encodeURIComponent(r.dateIso)}&to=${encodeURIComponent(r.dateIso)}`}
                                  aria-label="Open ledger"
                                >
                                  <OpenInNewOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Paper>
      )}

      <Dialog
        open={cashBookDlg != null}
        onClose={() => setCashBookDlg(null)}
        fullWidth
        maxWidth="sm"
        slotProps={{
          paper: { elevation: 0, sx: { borderRadius: 2, border: '1px solid', borderColor: 'divider' } },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <DescriptionOutlinedIcon color="primary" fontSize="small" />
            <span>Cash book — {cashBookDialogLabel}</span>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pb: 0 }}>
          {cashBookDlgLoading ? (
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', py: 4 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                Resolving meter totals and ledger lines…
              </Typography>
            </Stack>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 2, borderRadius: 1.5 }}>
              <Table size="small">
                <TableBody>
                  {cashBookDialogRows.map((line) => (
                    <TableRow
                      key={line.key}
                      sx={{
                        '&:last-child td': { borderBottom: 0 },
                        bgcolor: line.bold ? (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.12 : 0.06) : 'transparent',
                      }}
                    >
                      <TableCell
                        sx={{
                          fontWeight: line.bold ? 700 : 400,
                          borderColor: 'divider',
                          py: 1,
                        }}
                      >
                        {line.label}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: line.bold ? 700 : 400,
                          borderColor: 'divider',
                          fontVariantNumeric: 'tabular-nums',
                          py: 1,
                        }}
                      >
                        {cashBookAmtDisplay(line)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {!cashBookDlgLoading ? (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', lineHeight: 1.6 }}>
                Opening balance matches this row in the pivot; other lines enumerate paid-out ledger entries for the day.
              </Typography>
            </>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 2, gap: 1 }}>
          <Button onClick={() => setCashBookDlg(null)} sx={{ borderRadius: 1.5 }}>
            Close
          </Button>
          <Button
            component={RouterLink}
            variant="contained"
            color="secondary"
            to={
              cashBookDlg
                ? `/manager/ledger?from=${encodeURIComponent(cashBookDlg.iso)}&to=${encodeURIComponent(cashBookDlg.iso)}`
                : '/manager/ledger'
            }
            onClick={() => setCashBookDlg(null)}
            sx={{ borderRadius: 1.5 }}
          >
            Edit in ledger
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
