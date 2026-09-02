import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { createLedgerEntry, deleteLedgerEntry, listLedgerInRange, updateLedgerEntry } from '@/services/ledgerService';
import { getCashInHandAfterReconciliations } from '@/services/aggregatesService';
import { requireNonEmpty, requirePositiveNumber } from '@/utils/validation';
import { downloadCsv } from '@/utils/csvExport';
import type { LedgerEntry, LedgerPaymentChannel, LedgerType } from '@/types/entities';
import { format } from 'date-fns';
import {
  assertEntryDateAllowed,
  canBackdateEntries,
  clampEntryDateForRole,
  dateInputBoundsForRole,
  todayIso,
} from '@/utils/dateEntryPolicy';

/** Categories aligned with typical pump cash book (like your Excel ledger). */
const LEDGER_SHEET_CATEGORIES = [
  'EXPENSES',
  'SALES',
  'TRANSFER',
  'LOCKER',
  'ODD BALANCE',
  'SALARY',
  'ADVANCE SALARY',
  'MAINTENANCE',
  'MISC',
  'LOAN',
  'OTHER',
] as const;

function fmtDateSheet(d: Date): string {
  return format(d, 'dd-MM-yyyy');
}

/** TRANSACTION TYPE column: cash drawer, bank, or UPI (shown as PHONE PE like your sheet). */
function txnTypeSheetLabel(row: LedgerEntry): string {
  if (row.paymentChannel === 'upi') return 'PHONE PE';
  if (row.paymentChannel === 'bank') return 'BANK';
  if (row.paymentChannel === 'cash') return 'CASH';
  return row.type === 'income' ? 'BANK' : 'CASH';
}

function fmtPaidCell(row: LedgerEntry): string {
  return row.type === 'expense' ? row.amount.toFixed(2) : '';
}

function fmtReceivedCell(row: LedgerEntry): string {
  return row.type === 'income' ? row.amount.toFixed(2) : '';
}

function defaultEditChannel(row: LedgerEntry): LedgerPaymentChannel {
  if (row.paymentChannel === 'cash' || row.paymentChannel === 'bank' || row.paymentChannel === 'upi') {
    return row.paymentChannel;
  }
  return row.type === 'expense' ? 'cash' : 'bank';
}

function coerceLedgerCategory(c: string): string {
  return (LEDGER_SHEET_CATEGORIES as readonly string[]).includes(c) ? c : 'OTHER';
}

function fmtRs(n: number): string {
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const headerCellSx = {
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  fontSize: '0.72rem',
  letterSpacing: '0.06em',
  bgcolor: 'action.hover',
  color: 'text.secondary',
  border: '1px solid',
  borderColor: 'divider',
  whiteSpace: 'nowrap' as const,
};

const sheetCellSx = {
  border: '1px solid',
  borderColor: 'divider',
  verticalAlign: 'top' as const,
};

export function LedgerPage() {
  const theme = useTheme();
  const { profile } = useAuth();
  const dateBounds = dateInputBoundsForRole(profile?.role);
  const [searchParams] = useSearchParams();
  const [typeFilter, setTypeFilter] = useState<'all' | LedgerType>('all');
  const [from, setFrom] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [to, setTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listLedgerInRange>>>([]);
  const [bal, setBal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [entryDate, setEntryDate] = useState(() => todayIso());
  const [entryNames, setEntryNames] = useState('');
  const [entryParticular, setEntryParticular] = useState('');
  const [entryCategory, setEntryCategory] = useState<string>(LEDGER_SHEET_CATEGORIES[0]!);
  const [entryPaidOut, setEntryPaidOut] = useState(true);
  const [entryChannel, setEntryChannel] = useState<LedgerPaymentChannel>('cash');
  const [entryAmount, setEntryAmount] = useState('');

  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgRow, setDlgRow] = useState<LedgerEntry | null>(null);
  const [dlgDate, setDlgDate] = useState('');
  const [dlgNames, setDlgNames] = useState('');
  const [dlgParticular, setDlgParticular] = useState('');
  const [dlgCategory, setDlgCategory] = useState<string>(LEDGER_SHEET_CATEGORIES[0]!);
  const [dlgPaidOut, setDlgPaidOut] = useState(true);
  const [dlgChannel, setDlgChannel] = useState<LedgerPaymentChannel>('cash');
  const [dlgAmount, setDlgAmount] = useState('');
  const [dlgErr, setDlgErr] = useState<string | null>(null);
  const [dlgSaving, setDlgSaving] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const a = new Date(from + 'T00:00:00');
      const b = new Date(to + 'T23:59:59.999');
      const [l, cashOnHand] = await Promise.all([
        listLedgerInRange(a, b, typeFilter === 'all' ? undefined : typeFilter),
        getCashInHandAfterReconciliations(),
      ]);
      setRows(l);
      setBal(cashOnHand);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filter/range changes; load closes over latest state
  }, [typeFilter, from, to]);

  useEffect(() => {
    const f = searchParams.get('from');
    const t = searchParams.get('to');
    if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) {
      setFrom(f);
    }
    if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
      setTo(t);
    }
  }, [searchParams]);

  const running = useMemo(() => {
    return rows.reduce<(LedgerEntry & { run: number })[]>((acc, r) => {
      const prevRun = acc.length > 0 ? acc[acc.length - 1]!.run : 0;
      const delta = r.type === 'income' ? r.amount : -r.amount;
      return [...acc, { ...r, run: prevRun + delta }];
    }, []);
  }, [rows]);

  async function submitEntry() {
    if (!profile) {
      return;
    }
    setFormErr(null);

    const namesErr = requireNonEmpty(entryNames, 'Names');
    const partErr = requireNonEmpty(entryParticular, 'Particular');
    const amtErr = requirePositiveNumber(entryAmount, 'Amount');
    if (namesErr || partErr || amtErr) {
      setFormErr(namesErr || partErr || amtErr || null);
      return;
    }
    const amount = Number(entryAmount);
    if (amount <= 0) {
      setFormErr('Amount must be greater than zero.');
      return;
    }

    setSaving(true);
    try {
      const day = clampEntryDateForRole(profile?.role, entryDate);
      assertEntryDateAllowed(profile?.role, day);
      await createLedgerEntry({
        date: new Date(day + 'T12:00:00'),
        type: entryPaidOut ? 'expense' : 'income',
        paymentChannel: entryChannel,
        paidToOrReceivedFrom: entryNames.trim(),
        particulars: entryParticular.trim(),
        category: entryCategory,
        amount,
        createdBy: profile.id,
      });
      setEntryAmount('');
      setEntryNames('');
      setEntryParticular('');
      setEntryDate(todayIso());
      await load();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  function openEditDialog(entry: LedgerEntry) {
    setDlgRow(entry);
    setDlgDate(clampEntryDateForRole(profile?.role, format(entry.date.toDate(), 'yyyy-MM-dd')));
    setDlgNames(entry.paidToOrReceivedFrom);
    setDlgParticular(entry.particulars);
    setDlgCategory(coerceLedgerCategory(entry.category));
    setDlgPaidOut(entry.type === 'expense');
    setDlgChannel(defaultEditChannel(entry));
    setDlgAmount(String(entry.amount));
    setDlgErr(null);
    setDlgOpen(true);
  }

  function closeEditDialog() {
    setDlgOpen(false);
    setDlgRow(null);
    setDlgErr(null);
  }

  async function submitEditDialog() {
    if (!dlgRow || !profile) {
      return;
    }
    setDlgErr(null);
    const namesErr = requireNonEmpty(dlgNames, 'Names');
    const partErr = requireNonEmpty(dlgParticular, 'Particular');
    const amtErr = requirePositiveNumber(dlgAmount, 'Amount');
    if (namesErr || partErr || amtErr) {
      setDlgErr(namesErr || partErr || amtErr || null);
      return;
    }
    const amount = Number(dlgAmount);
    if (amount <= 0) {
      setDlgErr('Amount must be greater than zero.');
      return;
    }
    setDlgSaving(true);
    try {
      const day = clampEntryDateForRole(profile?.role, dlgDate);
      assertEntryDateAllowed(profile?.role, day);
      await updateLedgerEntry(dlgRow.id, {
        date: new Date(day + 'T12:00:00'),
        type: dlgPaidOut ? 'expense' : 'income',
        paymentChannel: dlgChannel,
        paidToOrReceivedFrom: dlgNames.trim(),
        particulars: dlgParticular.trim(),
        category: dlgCategory,
        amount,
      });
      await load();
      closeEditDialog();
    } catch (e) {
      setDlgErr(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setDlgSaving(false);
    }
  }

  async function handleDeleteEntry(entry: LedgerEntry) {
    const base = `Delete this ledger line?\n${entry.paidToOrReceivedFrom} — ${entry.particulars} — ₹${entry.amount.toFixed(2)}`;
    let msg = base;
    if (entry.relatedCreditPaymentId) {
      msg = `${base}\n\nThis row is linked to a credit payment; only this ledger line is removed (customer balance is not changed automatically).`;
    } else if (entry.relatedLoanRepaymentId || entry.relatedLoanId) {
      msg = `${base}\n\nThis row has legacy loan-link fields from an old feature; deleting removes only this ledger line.`;
    }
    if (!window.confirm(msg)) {
      return;
    }
    try {
      await deleteLedgerEntry(entry.id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  if (!profile) {
    return null;
  }

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
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'flex-start' }}>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <MenuBookOutlinedIcon sx={{ opacity: 0.95 }} />
                <Typography variant="overline" sx={{ opacity: 0.92, letterSpacing: '0.12em', fontWeight: 600 }}>
                  Cash book
                </Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                Cash &amp; expense ledger
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.75, maxWidth: 640 }}>
                Mirror your written ledger: <strong>PAID</strong> is money leaving the drawer or bank;{' '}
                <strong>RECEIVED</strong> is money in. Shift cash and credit receipts tie into the same running picture as{' '}
                <strong>Daily sheet</strong> and <strong>Reconciliation</strong>.
              </Typography>
            </Box>
          </Stack>

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
            <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ maxWidth: 720 }}>
              <Box
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  bgcolor: (t) => alpha(t.palette.success.main, t.palette.mode === 'dark' ? 0.2 : 0.12),
                  color: 'success.main',
                  display: 'flex',
                }}
              >
                <AccountBalanceWalletOutlinedIcon />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                  Cash in hand (estimate)
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtRs(bal)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', lineHeight: 1.55 }}>
                  <strong>Shifts:</strong> for each reconciliation (pending or approved), meter sales − PhonePe − ICICI −
                  Fleet − credit − short. Rejected shifts are omitted.{' '}
                  <strong>Ledger:</strong> only rows with transaction type <strong>CASH</strong> — extras you received in
                  cash (e.g. dues, borrowings) increase the drawer; cash you paid out decreases it. Bank and UPI ledger lines do
                  not change this figure. Totals cover <strong>all time</strong>, not the table date range below.
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Stack>
      </Box>

      {err && <Alert severity="error">{err}</Alert>}

      <Card
        elevation={0}
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          transition: 'box-shadow 0.2s ease',
          '&:hover': { boxShadow: (t) => `0 8px 24px ${alpha(t.palette.common.black, 0.06)}` },
        }}
      >
        <Box sx={{ height: 3, bgcolor: 'secondary.main' }} />
        <CardContent sx={{ pt: 2.5 }}>
          <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.5 }}>
            <NoteAddOutlinedIcon color="secondary" sx={{ mt: 0.25 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                New entry (cash book row)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                <strong>PAID</strong> = money out · <strong>RECEIVED</strong> = money in · Type ={' '}
                <strong>CASH</strong> (drawer), <strong>BANK</strong>, or <strong>PHONE PE</strong> (UPI). Credit receipts
                from the Credit page appear as RECEIVED.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              select
              label="This line is"
              size="small"
              sx={{ minWidth: 280, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              value={entryPaidOut ? 'paid' : 'received'}
              onChange={(e) => {
                const paid = e.target.value === 'paid';
                setEntryPaidOut(paid);
                setEntryCategory((c) => {
                  if (paid && c === 'SALES') return 'EXPENSES';
                  if (!paid && c === 'EXPENSES') return 'SALES';
                  return c;
                });
              }}
            >
              <MenuItem value="paid">Money paid out (PAID column)</MenuItem>
              <MenuItem value="received">Money received (RECEIVED column)</MenuItem>
            </TextField>
          </Stack>
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ maxWidth: '100%', overflowX: 'auto', borderRadius: 1.5 }}
          >
            <Table size="small" sx={{ minWidth: 980, borderCollapse: 'collapse' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...headerCellSx, minWidth: 120 }}>Date</TableCell>
                  <TableCell sx={{ ...headerCellSx, minWidth: 140 }}>Names</TableCell>
                  <TableCell sx={{ ...headerCellSx, minWidth: 140 }}>Particular</TableCell>
                  <TableCell sx={{ ...headerCellSx, minWidth: 120 }}>Category</TableCell>
                  <TableCell sx={{ ...headerCellSx, minWidth: 128 }}>Txn type</TableCell>
                  <TableCell sx={{ ...headerCellSx, minWidth: 100 }} align="right">
                    Paid ₹
                  </TableCell>
                  <TableCell sx={{ ...headerCellSx, minWidth: 100 }} align="right">
                    Received ₹
                  </TableCell>
                  <TableCell sx={{ ...headerCellSx, minWidth: 88 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell sx={sheetCellSx}>
                    <TextField
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(clampEntryDateForRole(profile?.role, e.target.value))}
                      slotProps={{
                        inputLabel: { shrink: true },
                        htmlInput: { min: dateBounds.min, max: dateBounds.max },
                      }}
                      size="small"
                      fullWidth
                      helperText={canBackdateEntries(profile?.role) ? 'Admin: past dates OK' : undefined}
                      sx={{ minWidth: 120, '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
                    />
                  </TableCell>
                  <TableCell sx={sheetCellSx}>
                    <TextField
                      placeholder="Person or bank"
                      value={entryNames}
                      onChange={(e) => setEntryNames(e.target.value)}
                      size="small"
                      fullWidth
                      helperText={
                        entryPaidOut
                          ? 'Use category TRANSFER (or OTHER) — name appears on Daily sheet'
                          : undefined
                      }
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
                    />
                  </TableCell>
                  <TableCell sx={sheetCellSx}>
                    <TextField
                      placeholder="e.g. HSD, WATER"
                      value={entryParticular}
                      onChange={(e) => setEntryParticular(e.target.value)}
                      size="small"
                      fullWidth
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
                    />
                  </TableCell>
                  <TableCell sx={sheetCellSx}>
                    <TextField
                      select
                      value={entryCategory}
                      onChange={(e) => setEntryCategory(e.target.value)}
                      size="small"
                      fullWidth
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
                    >
                      {LEDGER_SHEET_CATEGORIES.map((c) => (
                        <MenuItem key={c} value={c}>
                          {c}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell sx={sheetCellSx}>
                    <TextField
                      select
                      value={entryChannel}
                      onChange={(e) => setEntryChannel(e.target.value as LedgerPaymentChannel)}
                      size="small"
                      fullWidth
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
                    >
                      <MenuItem value="cash">CASH</MenuItem>
                      <MenuItem value="bank">BANK</MenuItem>
                      <MenuItem value="upi">PHONE PE</MenuItem>
                    </TextField>
                  </TableCell>
                  <TableCell sx={sheetCellSx} align="right">
                    <TextField
                      placeholder="—"
                      value={entryPaidOut ? entryAmount : ''}
                      disabled={!entryPaidOut}
                      onChange={(e) => {
                        setEntryPaidOut(true);
                        setEntryAmount(e.target.value);
                      }}
                      type="number"
                      size="small"
                      fullWidth
                      slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
                    />
                  </TableCell>
                  <TableCell sx={sheetCellSx} align="right">
                    <TextField
                      placeholder="—"
                      value={entryPaidOut ? '' : entryAmount}
                      disabled={entryPaidOut}
                      onChange={(e) => {
                        setEntryPaidOut(false);
                        setEntryAmount(e.target.value);
                      }}
                      type="number"
                      size="small"
                      fullWidth
                      slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
                    />
                  </TableCell>
                  <TableCell sx={sheetCellSx}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => void submitEntry()}
                      disabled={saving}
                      sx={{ borderRadius: 1.25 }}
                    >
                      {saving ? '…' : 'Post'}
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
          {formErr && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {formErr}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} flexWrap="wrap" useFlexGap>
          <TextField
            type="date"
            label="From"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
          />
          <TextField
            type="date"
            label="To"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
          />
          <TextField
            select
            label="Show"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | LedgerType)}
            size="small"
            sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
          >
            <MenuItem value="all">All movements</MenuItem>
            <MenuItem value="income">Income only</MenuItem>
            <MenuItem value="expense">Expense only</MenuItem>
          </TextField>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              startIcon={<RefreshOutlinedIcon />}
              onClick={() => void load()}
              disabled={loading}
              sx={{ borderRadius: 1.5 }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<FileDownloadOutlinedIcon />}
              onClick={() =>
                downloadCsv(
                  'ledger.csv',
                  [
                    'DATE',
                    'NAMES',
                    'PARTICULAR',
                    'CATEGORY',
                    'TRANSACTION TYPE',
                    'PAID Rs',
                    'RECEIVED Rs',
                    'Running Rs',
                  ],
                  running.map((r) => [
                    fmtDateSheet(r.date.toDate()),
                    r.paidToOrReceivedFrom,
                    r.particulars,
                    r.category,
                    txnTypeSheetLabel(r),
                    fmtPaidCell(r),
                    fmtReceivedCell(r),
                    r.run,
                  ]),
                )
              }
              sx={{ borderRadius: 1.5 }}
            >
              Export CSV
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {loading ? (
        <Paper variant="outlined" sx={{ borderRadius: 2, py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={44} thickness={4} />
          <Typography color="text.secondary">Loading ledger…</Typography>
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
              <ReceiptLongOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Ledger entries
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={typeFilter === 'all' ? 'All types' : typeFilter === 'income' ? 'Income' : 'Expense'}
                sx={{ fontWeight: 600 }}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              Running balance is cumulative across the filtered list (oldest → newest within range).
            </Typography>
          </Stack>
          <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto' }}>
            <Table
              size="small"
              stickyHeader
              sx={{
                minWidth: 1020,
                borderCollapse: 'collapse',
                '& thead th': { zIndex: 1 },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={headerCellSx}>Date</TableCell>
                  <TableCell sx={headerCellSx}>Names</TableCell>
                  <TableCell sx={headerCellSx}>Particular</TableCell>
                  <TableCell sx={headerCellSx}>Category</TableCell>
                  <TableCell sx={headerCellSx}>Txn type</TableCell>
                  <TableCell sx={headerCellSx} align="right">
                    Paid ₹
                  </TableCell>
                  <TableCell sx={headerCellSx} align="right">
                    Received ₹
                  </TableCell>
                  <TableCell sx={headerCellSx} align="right">
                    Running
                  </TableCell>
                  <TableCell sx={{ ...headerCellSx, minWidth: 108 }} align="center">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {running.map((r, idx) => (
                  <TableRow
                    key={r.id}
                    sx={{
                      bgcolor:
                        idx % 2 === 1 ? (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.08 : 0.04) : 'transparent',
                    }}
                  >
                    <TableCell sx={{ ...sheetCellSx, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtDateSheet(r.date.toDate())}
                    </TableCell>
                    <TableCell sx={{ ...sheetCellSx, fontWeight: 600 }}>{r.paidToOrReceivedFrom}</TableCell>
                    <TableCell sx={sheetCellSx}>{r.particulars}</TableCell>
                    <TableCell sx={sheetCellSx}>{r.category}</TableCell>
                    <TableCell sx={sheetCellSx}>
                      <Chip label={txnTypeSheetLabel(r)} size="small" variant="outlined" sx={{ fontWeight: 600, height: 24 }} />
                    </TableCell>
                    <TableCell sx={{ ...sheetCellSx, fontVariantNumeric: 'tabular-nums' }} align="right">
                      {fmtPaidCell(r)}
                    </TableCell>
                    <TableCell sx={{ ...sheetCellSx, fontVariantNumeric: 'tabular-nums' }} align="right">
                      {fmtReceivedCell(r)}
                    </TableCell>
                    <TableCell
                      sx={{ ...sheetCellSx, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}
                      align="right"
                    >
                      {r.run.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell sx={sheetCellSx} align="center">
                      <Stack direction="row" spacing={0} sx={{ justifyContent: 'center' }}>
                        <IconButton size="small" color="primary" aria-label="Edit ledger line" onClick={() => openEditDialog(r)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          aria-label="Delete ledger line"
                          onClick={() => void handleDeleteEntry(r)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {running.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                        No rows in this range — widen dates or remove the type filter.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Dialog
        open={dlgOpen}
        onClose={() => {
          if (!dlgSaving) closeEditDialog();
        }}
        fullWidth
        maxWidth="sm"
        slotProps={{
          paper: { elevation: 0, sx: { borderRadius: 2, border: '1px solid', borderColor: 'divider' } },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <EditOutlinedIcon color="primary" fontSize="small" />
            <span>Edit ledger line</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            {dlgErr && <Alert severity="error">{dlgErr}</Alert>}
            {dlgRow?.relatedCreditPaymentId ? (
              <Alert severity="warning">
                Linked to a credit payment — editing only changes this ledger row (not customer balance).
              </Alert>
            ) : null}
            {dlgRow?.relatedLoanId || dlgRow?.relatedLoanRepaymentId ? (
              <Alert severity="warning">
                Legacy loan link — editing only changes this ledger row.
              </Alert>
            ) : null}
            <TextField
              type="date"
              label="Date"
              value={dlgDate}
              onChange={(e) => setDlgDate(clampEntryDateForRole(profile?.role, e.target.value))}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { min: dateBounds.min, max: dateBounds.max },
              }}
              size="small"
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
            <TextField
              label="Names"
              value={dlgNames}
              onChange={(e) => setDlgNames(e.target.value)}
              size="small"
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
            <TextField
              label="Particular"
              value={dlgParticular}
              onChange={(e) => setDlgParticular(e.target.value)}
              size="small"
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
            <TextField
              select
              label="Category"
              value={dlgCategory}
              onChange={(e) => setDlgCategory(e.target.value)}
              size="small"
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            >
              {LEDGER_SHEET_CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="This line is"
              value={dlgPaidOut ? 'paid' : 'received'}
              onChange={(e) => {
                const paid = e.target.value === 'paid';
                setDlgPaidOut(paid);
                setDlgCategory((c) => {
                  if (paid && c === 'SALES') return 'EXPENSES';
                  if (!paid && c === 'EXPENSES') return 'SALES';
                  return c;
                });
              }}
              size="small"
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            >
              <MenuItem value="paid">Money paid out (PAID)</MenuItem>
              <MenuItem value="received">Money received (RECEIVED)</MenuItem>
            </TextField>
            <TextField
              select
              label="Transaction type"
              value={dlgChannel}
              onChange={(e) => setDlgChannel(e.target.value as LedgerPaymentChannel)}
              size="small"
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            >
              <MenuItem value="cash">CASH</MenuItem>
              <MenuItem value="bank">BANK</MenuItem>
              <MenuItem value="upi">PHONE PE</MenuItem>
            </TextField>
            <TextField
              label={dlgPaidOut ? 'Amount paid (₹)' : 'Amount received (₹)'}
              value={dlgAmount}
              onChange={(e) => setDlgAmount(e.target.value)}
              type="number"
              size="small"
              fullWidth
              slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeEditDialog} disabled={dlgSaving} sx={{ borderRadius: 1.5 }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void submitEditDialog()} disabled={dlgSaving} sx={{ borderRadius: 1.5 }}>
            {dlgSaving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
