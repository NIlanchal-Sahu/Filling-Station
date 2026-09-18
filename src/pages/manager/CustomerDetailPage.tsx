import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
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
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReadOnlyBanner } from '@/components/ui/ReadOnlyBanner';
import { format } from 'date-fns';
import { getCustomer, updateCustomer } from '@/services/creditCustomersService';
import { listSalesForCustomer } from '@/services/creditSalesService';
import { listPaymentsForCustomer, recordPayment } from '@/services/creditPaymentsService';
import { listFuelTypes } from '@/services/fuelTypesService';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { requireMin, requireNonEmpty } from '@/utils/validation';
import {
  CREDIT_PAYMENT_MODE_ORDER,
  creditPaymentModeLabel,
  type CreditSale,
  type CreditCustomer,
  type CreditPaymentMode,
} from '@/types/entities';
import { ManualCreditSaleFormCard } from '@/pages/manager/ManualCreditSaleFormCard';
import { trimNumberDisplay } from '@/pages/manager/creditRegisterFormatters';
import { aggregateFuelCreditTotals, describeFuelCreditTotals } from '@/pages/manager/creditFuelTotals';
import {
  assertEntryDateAllowed,
  clampEntryDateForRole,
  dateInputBoundsForRole,
  todayIso,
} from '@/utils/dateEntryPolicy';
import {
  buildPartyCreditLedger,
  particularsForLedgerCreditSale,
} from '@/pages/manager/partyCreditLedger';
import {
  PARTY_LEDGER_CSV_HEADERS,
  creditLedgerCsvDataRows,
  openPartyLedgerPrintDialog,
  safeLedgerFilenameBasename,
  type PartyLedgerFuelFormatters,
} from '@/pages/manager/partyLedgerExport';
import { downloadCsv } from '@/utils/csvExport';
import {
  creditSheetBodyCellSx,
  creditSheetHeaderCellSx,
  creditSheetTableSx,
  creditSheetWrapSx,
} from '@/pages/manager/manualCreditSaleFormStyles';

function fmtRs(n: number): string {
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CustomerDetailPage() {
  const theme = useTheme();
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { profile } = useAuth();
  const { readOnlyOps } = usePermissions();
  const dateBounds = dateInputBoundsForRole(profile?.role);
  const [c, setC] = useState<CreditCustomer | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [ledgerRev, setLedgerRev] = useState(0);

  const [amt, setAmt] = useState('');
  const [payDate, setPayDate] = useState(() => todayIso());
  const [mode, setMode] = useState<CreditPaymentMode>('cash');
  const [notes, setNotes] = useState('');

  async function reloadCustomer(): Promise<void> {
    const cu = await getCustomer(id);
    setC(cu);
    if (cu) {
      setName(cu.name);
    }
  }

  useEffect(() => {
    if (!id) {
      return;
    }
    let ok = true;
    (async () => {
      setErr(null);
      try {
        const cu = await getCustomer(id);
        if (ok) {
          setC(cu);
          if (cu) {
            setName(cu.name);
          }
        }
      } catch (e) {
        if (ok) {
          setErr(e instanceof Error ? e.message : 'Failed to load');
        }
      }
    })();
    return () => {
      ok = false;
    };
  }, [id]);

  if (c === undefined) {
    return (
      <Paper variant="outlined" sx={{ borderRadius: 2, py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <CircularProgress size={44} thickness={4} />
        <Typography color="text.secondary">Loading party…</Typography>
      </Paper>
    );
  }
  if (!c) {
    return <Alert severity="error">Customer not found.</Alert>;
  }

  const balanceAccent =
    c.currentBalance <= 0
      ? theme.palette.success.main
      : theme.palette.warning.main;

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      {readOnlyOps ? (
        <ReadOnlyBanner message="You can review this party's ledger. Staff record payments and credit sales." />
      ) : null}
      <PageHeader
        title={c.name}
        action={
          <Button
            variant="contained"
            color="secondary"
            startIcon={<ArrowBackOutlinedIcon />}
            onClick={() => nav('/manager/credit')}
            sx={{ borderRadius: 1.5, fontWeight: 600, minHeight: 44 }}
          >
            Back to credit
          </Button>
        }
      />

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} divider={<Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', md: 'block' } }} />}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
              Outstanding balance
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, fontVariantNumeric: 'tabular-nums', color: balanceAccent }}>
              {fmtRs(c.currentBalance)}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em', mb: 0.75, display: 'block' }}>
              Party label
            </Typography>
            {readOnlyOps ? (
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {c.name}
              </Typography>
            ) : (
              <>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
                  <TextField
                    size="small"
                    label="Displayed name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    sx={{ flex: 1, minWidth: 0, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                  />
                  <Button
                    size="medium"
                    variant="contained"
                    onClick={async () => {
                      setFormError(null);
                      const m = requireNonEmpty(name, 'Name');
                      if (m) {
                        setFormError(m);
                        return;
                      }
                      setSaving(true);
                      try {
                        await updateCustomer(c.id, { name: name.trim() });
                        setC((prev) => (prev ? { ...prev, name: name.trim() } : prev));
                      } catch (e) {
                        setFormError(e instanceof Error ? e.message : 'Update failed');
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving || name.trim() === c.name}
                    sx={{ borderRadius: 1.5, minHeight: 44 }}
                  >
                    Save
                  </Button>
                </Stack>
                {formError ? (
                  <Alert severity="error" sx={{ mt: 1.5 }}>
                    {formError}
                  </Alert>
                ) : null}
              </>
            )}
          </Box>
        </Stack>
      </Paper>

      {err && <Alert severity="error">{err}</Alert>}

      <CustomerCreditSection
        customerId={c.id}
        partyName={c.name}
        currentBalanceOwed={c.currentBalance}
        reloadSignal={ledgerRev}
        readOnly={readOnlyOps}
        onRecorded={async () => {
          await reloadCustomer();
          setLedgerRev((k) => k + 1);
        }}
      />

      {!readOnlyOps ? (
      <Card elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Box sx={{ height: 3, bgcolor: 'success.main' }} />
        <CardContent sx={{ pt: 2.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <PaymentsOutlinedIcon color="success" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Receive payment
            </Typography>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            <Stack spacing={2} sx={{ flex: 1, maxWidth: { md: 420 } }}>
              <TextField
                label="Amount received"
                type="number"
                value={amt}
                onChange={(e) => setAmt(e.target.value)}
                slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              />
              <TextField
                type="date"
                label="Payment date"
                value={payDate}
                onChange={(e) => setPayDate(clampEntryDateForRole(profile?.role, e.target.value))}
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { min: dateBounds.min, max: dateBounds.max },
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              />
              <TextField
                select
                label="Payment mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as CreditPaymentMode)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              >
                {CREDIT_PAYMENT_MODE_ORDER.map((m) => (
                  <MenuItem key={m} value={m}>
                    {creditPaymentModeLabel(m)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                multiline
                minRows={2}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              />
              {payError ? (
                <Alert severity="error" onClose={() => setPayError(null)}>
                  {payError}
                </Alert>
              ) : null}
              <Button
                type="button"
                variant="contained"
                size="large"
                sx={{
                  borderRadius: 1.5,
                  width: { xs: '100%', md: 'auto' },
                  alignSelf: { md: 'flex-start' },
                  px: { md: 4 },
                }}
                onClick={async () => {
                  setPayError(null);
                  const m = requireMin(amt, 0, 'Amount');
                  if (m) {
                    setPayError(m);
                    return;
                  }
                  const n = Number(amt);
                  if (Number.isNaN(n) || n <= 0) {
                    setPayError('Enter a positive amount.');
                    return;
                  }
                  if (!profile) {
                    return;
                  }
                  setSaving(true);
                  try {
                    const day = clampEntryDateForRole(profile?.role, payDate);
                    assertEntryDateAllowed(profile?.role, day);
                    await recordPayment({
                      customerId: c.id,
                      amountReceived: n,
                      date: new Date(`${day}T12:00:00`),
                      mode,
                      notes: notes || undefined,
                      customerName: c.name,
                      createdBy: profile.id,
                    });
                    setAmt('');
                    setNotes('');
                    setPayDate(todayIso());
                    await reloadCustomer();
                    setLedgerRev((k) => k + 1);
                  } catch (e) {
                    setPayError(e instanceof Error ? e.message : 'Payment failed');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
              >
                Record payment
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
      ) : null}
    </Stack>
  );
}

function CustomerCreditSection({
  customerId,
  partyName,
  currentBalanceOwed,
  reloadSignal,
  readOnly,
  onRecorded,
}: {
  customerId: string;
  partyName: string;
  currentBalanceOwed: number;
  reloadSignal: number;
  readOnly: boolean;
  onRecorded: () => Promise<void>;
}) {
  const theme = useTheme();
  const [fuels, setFuels] = useState<Array<{ id: string; name: string; currentRate: number }>>([]);
  const [sales, setSales] = useState<CreditSale[]>([]);
  const [pays, setPays] = useState<
    {
      id: string;
      dateMs: number;
      dateLabel: string;
      amount: number;
      mode: CreditPaymentMode;
    }[]
  >([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const fuelMap = useMemo(() => new Map(fuels.map((f) => [f.id, f])), [fuels]);
  const fuelUpperNameById = useMemo(
    () => new Map(fuels.map((f) => [f.id, f.name.trim().toUpperCase()])),
    [fuels],
  );
  const lifetimeFuelCredit = useMemo(
    () => aggregateFuelCreditTotals(sales, fuelUpperNameById),
    [sales, fuelUpperNameById],
  );
  const fuelCreditSummary = describeFuelCreditTotals(lifetimeFuelCredit);

  const ledgerRows = useMemo(
    () =>
      buildPartyCreditLedger({
        currentBalanceOwed,
        sales,
        payments: pays,
      }),
    [currentBalanceOwed, sales, pays],
  );

  const ledgerFuelFmt = useMemo<PartyLedgerFuelFormatters>(() => {
    const map = fuelMap;
    return {
      fuelUpper: (s: CreditSale) => {
        const id = s.fuelTypeId;
        if (!id) {
          return '—';
        }
        const n = map.get(id)?.name;
        return n ? n.trim().toUpperCase() : '—';
      },
      litresDisplay: (s: CreditSale) =>
        s.liters != null && Number.isFinite(s.liters) ? trimNumberDisplay(Number(s.liters)) : '—',
      rateDisplay: (s: CreditSale) => {
        if (s.rateAtSale != null && Number.isFinite(s.rateAtSale)) {
          return trimNumberDisplay(s.rateAtSale);
        }
        if (s.liters != null && s.liters > 0 && Number.isFinite(s.amount)) {
          return trimNumberDisplay(s.amount / s.liters);
        }
        return '—';
      },
    };
  }, [fuelMap]);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const list = await listFuelTypes();
        if (!ok) {
          return;
        }
        list.sort((a, b) => a.name.localeCompare(b.name));
        setFuels(list.map((u) => ({ id: u.id, name: u.name, currentRate: u.currentRate })));
      } catch {
        /* Fuel names for history only — form card loads its own fuels */
      }
    })();
    return () => {
      ok = false;
    };
  }, []);

  useEffect(() => {
    let ok = true;
    (async () => {
      setLoadErr(null);
      try {
        const [saleRows, payRows] = await Promise.all([
          listSalesForCustomer(customerId),
          listPaymentsForCustomer(customerId),
        ]);
        if (!ok) {
          return;
        }
        setSales(saleRows);
        setPays(
          payRows.map((p) => ({
            id: p.id,
            dateMs: p.date.toMillis(),
            dateLabel: format(p.date.toDate(), 'dd-MM-yyyy'),
            amount: p.amountReceived,
            mode: p.mode,
          })),
        );
      } catch (e) {
        if (ok) {
          setLoadErr(e instanceof Error ? e.message : 'Load failed');
        }
      }
    })();
    return () => {
      ok = false;
    };
  }, [customerId, reloadSignal]);

  if (loadErr) {
    return <Alert severity="error">{loadErr}</Alert>;
  }

  return (
    <Stack spacing={2.5}>
      {!readOnly ? (
        <ManualCreditSaleFormCard
          mode="fixed"
          customerId={customerId}
          partyDisplayName={partyName}
          onSuccess={onRecorded}
        />
      ) : null}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Stack
          direction="row"
          sx={{
            px: 2,
            py: 1.5,
            bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.12 : 0.06),
            borderBottom: '1px solid',
            borderColor: 'divider',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <ReceiptLongOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Credit ledger
            </Typography>
            <Chip label="Oldest first" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
            <DescriptionOutlinedIcon sx={{ color: 'text.secondary', fontSize: 20, ml: 0.5, display: { xs: 'none', sm: 'inline' } }} />
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              size="small"
              variant="outlined"
              disabled={ledgerRows.length === 0}
              onClick={() =>
                downloadCsv(
                  `${safeLedgerFilenameBasename(partyName)}_credit_ledger.csv`,
                  [...PARTY_LEDGER_CSV_HEADERS],
                  creditLedgerCsvDataRows(partyName, ledgerRows, ledgerFuelFmt),
                )
              }
            >
              Export CSV
            </Button>
            <Button
              size="small"
              variant="contained"
              color="secondary"
              disabled={ledgerRows.length === 0}
              onClick={() =>
                openPartyLedgerPrintDialog({
                  partyName,
                  currentBalanceOwed,
                  rows: ledgerRows,
                  fm: ledgerFuelFmt,
                })
              }
            >
              Print / PDF
            </Button>
          </Stack>
        </Stack>
        <Box sx={{ px: 2, pt: 1.5, pb: 2 }}>
          {fuelCreditSummary ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Fuel taken on credit (lifetime): <strong>{fuelCreditSummary}</strong>
            </Typography>
          ) : null}
          <TableContainer component={Paper} variant="outlined" sx={creditSheetWrapSx}>
            <Table size="small" aria-label={`Credit ledger for ${partyName}`} sx={creditSheetTableSx}>
              <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <TableHead>
                <TableRow>
                  <TableCell sx={creditSheetHeaderCellSx}>Date</TableCell>
                  <TableCell sx={creditSheetHeaderCellSx}>Particulars</TableCell>
                  <TableCell sx={creditSheetHeaderCellSx}>Fuel</TableCell>
                  <TableCell sx={creditSheetHeaderCellSx} align="right">
                    Litres
                  </TableCell>
                  <TableCell sx={creditSheetHeaderCellSx} align="right">
                    ₹ / L
                  </TableCell>
                  <TableCell sx={creditSheetHeaderCellSx} align="right">
                    Debit ₹
                  </TableCell>
                  <TableCell sx={creditSheetHeaderCellSx} align="right">
                    Credit ₹
                  </TableCell>
                  <TableCell sx={{ ...creditSheetHeaderCellSx, fontWeight: 700 }} align="right">
                    Balance ₹
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ledgerRows.map((row, idx) => {
                  const stripe =
                    idx % 2 === 1
                      ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.035)
                      : 'transparent';
                  if (row.kind === 'broughtForward') {
                    return (
                      <TableRow key="bf" sx={{ bgcolor: stripe }}>
                        <TableCell sx={creditSheetBodyCellSx}>—</TableCell>
                        <TableCell sx={creditSheetBodyCellSx} colSpan={4}>
                          Brought forward (before entries below)
                        </TableCell>
                        <TableCell sx={creditSheetBodyCellSx} align="right">
                          —
                        </TableCell>
                        <TableCell sx={creditSheetBodyCellSx} align="right">
                          —
                        </TableCell>
                        <TableCell sx={{ ...creditSheetBodyCellSx, fontWeight: 700 }} align="right">
                          {row.balanceAfter.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  }
                  if (row.kind === 'payment') {
                    return (
                      <TableRow key={`pay-${row.id}`} sx={{ bgcolor: stripe }}>
                        <TableCell sx={{ ...creditSheetBodyCellSx, whiteSpace: 'nowrap' }}>{row.dateLabel}</TableCell>
                        <TableCell sx={{ ...creditSheetBodyCellSx, overflowWrap: 'anywhere' }}>
                          Payment · {creditPaymentModeLabel(row.mode)}
                        </TableCell>
                        <TableCell sx={creditSheetBodyCellSx}>—</TableCell>
                        <TableCell sx={creditSheetBodyCellSx} align="right">
                          —
                        </TableCell>
                        <TableCell sx={creditSheetBodyCellSx} align="right">
                          —
                        </TableCell>
                        <TableCell sx={creditSheetBodyCellSx} align="right">
                          —
                        </TableCell>
                        <TableCell
                          sx={{ ...creditSheetBodyCellSx, fontVariantNumeric: 'tabular-nums' }}
                          align="right"
                        >
                          {row.creditRupees.toFixed(2)}
                        </TableCell>
                        <TableCell
                          sx={{ ...creditSheetBodyCellSx, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                          align="right"
                        >
                          {row.balanceAfter.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  }
                  const s = row.sale;
                  return (
                    <TableRow key={`sale-${row.id}`} sx={{ bgcolor: stripe }}>
                      <TableCell sx={{ ...creditSheetBodyCellSx, whiteSpace: 'nowrap' }}>{row.dateLabel}</TableCell>
                      <TableCell sx={{ ...creditSheetBodyCellSx, overflowWrap: 'anywhere' }}>
                        {particularsForLedgerCreditSale(s)}
                      </TableCell>
                      <TableCell sx={{ ...creditSheetBodyCellSx, whiteSpace: 'nowrap' }}>
                        {ledgerFuelFmt.fuelUpper(s)}
                      </TableCell>
                      <TableCell
                        sx={{ ...creditSheetBodyCellSx, fontVariantNumeric: 'tabular-nums' }}
                        align="right"
                      >
                        {ledgerFuelFmt.litresDisplay(s)}
                      </TableCell>
                      <TableCell
                        sx={{ ...creditSheetBodyCellSx, fontVariantNumeric: 'tabular-nums' }}
                        align="right"
                      >
                        {ledgerFuelFmt.rateDisplay(s)}
                      </TableCell>
                      <TableCell
                        sx={{ ...creditSheetBodyCellSx, fontVariantNumeric: 'tabular-nums' }}
                        align="right"
                      >
                        {row.debitRupees.toFixed(2)}
                      </TableCell>
                      <TableCell sx={creditSheetBodyCellSx} align="right">
                        —
                      </TableCell>
                      <TableCell
                        sx={{ ...creditSheetBodyCellSx, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                        align="right"
                      >
                        {row.balanceAfter.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {ledgerRows.length === 0 && (
                  <TableRow>
                    <TableCell sx={creditSheetBodyCellSx} colSpan={8}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                        No ledger movements yet — add a fuel credit sale above to start this account.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Paper>
    </Stack>
  );
}
