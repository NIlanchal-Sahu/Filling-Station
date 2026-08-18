import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  alpha,
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import { format } from 'date-fns';
import { useShiftAccess } from '@/hooks/useShiftAccess';
import { listReadingsForShift, getMachineLabelForShift } from '@/services/shiftReadingsService';
import { getReconciliationForShift, createReconciliationWithClose, updatePendingReconciliation } from '@/services/reconciliationService';
import { getUser } from '@/services/usersService';
import { createCustomer, listCreditCustomers } from '@/services/creditCustomersService';
import { listFuelTypes } from '@/services/fuelTypesService';
import { listLedgerInRange } from '@/services/ledgerService';
import { requireMin, requireNonEmpty } from '@/utils/validation';
import {
  buildCashBookSummary,
  fmtInrDash,
  type CashBookSummaryRow,
} from '@/utils/cashBookSummary';
import {
  summarizeMeterSalesFromReadings,
  totalCashFromMeterAndChannels,
} from '@/utils/meterSalesByFuel';
import type { ReconciliationCreditLine, FuelType, LedgerEntry } from '@/types/entities';
import { creditSheetBodyCellSx, creditSheetHeaderCellSx } from '@/pages/manager/manualCreditSaleFormStyles';

const EPS = 0.01;

type CreditAllocationLine = {
  partyName: string;
  fuelTypeId: string;
  liters: string;
  ratePerL: string;
};

function amountFromLitersAndRate(litersStr: string, rateStr: string): number {
  const L = Number.parseFloat(litersStr);
  const r = Number.parseFloat(rateStr);
  const Ln = Number.isFinite(L) ? L : 0;
  const rn = Number.isFinite(r) ? r : 0;
  return Math.round((Ln * rn + Number.EPSILON) * 100) / 100;
}

export function ReconciliationFormPage() {
  const { shiftId = '' } = useParams();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const isManagerEdit = searchParams.get('edit') === '1';
  const { shift, allowed, error: accessError, profile } = useShiftAccess(shiftId);
  const [operatorName, setOperatorName] = useState('');
  const [machineLabel, setMachineLabel] = useState('—');
  const [totalSales, setTotalSales] = useState(0);
  const [existing, setExisting] = useState<Awaited<ReturnType<typeof getReconciliationForShift>>>(null);
  const [fuels, setFuels] = useState<FuelType[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [ledgerForDay, setLedgerForDay] = useState<LedgerEntry[]>([]);

  const [paytm, setPaytm] = useState('0');
  const [icici, setIcici] = useState('0');
  const [fleet, setFleet] = useState('0');
  const [credit, setCredit] = useState('0');
  const [short, setShort] = useState('0');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [lines, setLines] = useState<CreditAllocationLine[]>([
    { partyName: '', fuelTypeId: '', liters: '0', ratePerL: '0' },
  ]);

  useEffect(() => {
    if (!shiftId || !shift || !allowed) {
      return;
    }
    let ok = true;
    (async () => {
      setLoadErr(null);
      try {
        if (!shift.readingsCompleteAt) {
          if (ok) {
            setLoadErr('Complete meter readings first.');
            setLedgerForDay([]);
          }
          return;
        }
        const calendarIso =
          shift.calendarDate?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(shift.calendarDate.trim())
            ? shift.calendarDate.trim()
            : format(shift.startTime.toDate(), 'yyyy-MM-dd');
        const windowStart = new Date(`${calendarIso}T00:00:00`);
        const windowEnd = new Date(`${calendarIso}T23:59:59.999`);

        const needLedger = profile?.role === 'manager';

        const [readings, u, r, fuelList, ledgerRows, machines] = await Promise.all([
          listReadingsForShift(shiftId),
          getUser(shift.operatorId),
          getReconciliationForShift(shiftId),
          listFuelTypes(),
          needLedger ? listLedgerInRange(windowStart, windowEnd) : Promise.resolve<LedgerEntry[]>([]),
          getMachineLabelForShift(shiftId),
        ]);
        if (!ok) {
          return;
        }
        const meter = await summarizeMeterSalesFromReadings(readings);
        if (!ok) {
          return;
        }
        setLedgerForDay(ledgerRows);
        setOperatorName(u?.name ?? shift.operatorId);
        setMachineLabel(machines);
        setTotalSales(meter.total);
        setExisting(r);
        const sortedFuels = [...fuelList].sort((a, b) => a.name.localeCompare(b.name));
        setFuels(sortedFuels);
        if (r && profile?.role === 'manager' && isManagerEdit && r.status === 'pending') {
          setPaytm(String(r.paytmOnline));
          setIcici(String(r.iciciCard));
          setFleet(String(r.fleetCard));
          setCredit(String(r.creditAmount));
          setShort(String(r.shortAmount ?? 0));
          if (r.creditLineItems.length > 0) {
            const customers = await listCreditCustomers(true);
            if (!ok) return;
            const nameById = new Map(customers.map((c) => [c.id, c.name]));
            setLines(
              r.creditLineItems.map((line) => ({
                partyName: nameById.get(line.customerId) ?? '',
                fuelTypeId: line.fuelTypeId ?? sortedFuels[0]?.id ?? '',
                liters: String(line.liters ?? 0),
                ratePerL: String(line.rateAtSale ?? sortedFuels.find((f) => f.id === line.fuelTypeId)?.currentRate ?? 0),
              })),
            );
          }
        }
        if (sortedFuels.length > 0) {
          setLines((prev) =>
            prev.map((line) =>
              sortedFuels.some((f) => f.id === line.fuelTypeId)
                ? line
                : {
                    ...line,
                    fuelTypeId: sortedFuels[0]!.id,
                    ratePerL: String(sortedFuels[0]!.currentRate),
                  },
            ),
          );
        }
      } catch (e) {
        if (ok) {
          setLoadErr(e instanceof Error ? e.message : 'Load failed');
          setLedgerForDay([]);
        }
      }
    })();
    return () => {
      ok = false;
    };
  }, [shiftId, shift, allowed, profile?.role, isManagerEdit]);

  const sumOtherChannels = useMemo(() => {
    const n = (v: string) => (Number.parseFloat(v) || 0);
    return n(paytm) + n(icici) + n(fleet) + n(credit);
  }, [paytm, icici, fleet, credit]);

  const cashAmountComputed = useMemo(() => {
    return totalCashFromMeterAndChannels(
      totalSales,
      Number.parseFloat(paytm) || 0,
      Number.parseFloat(icici) || 0,
      Number.parseFloat(fleet) || 0,
      Number.parseFloat(credit) || 0,
      Number.parseFloat(short) || 0,
    );
  }, [totalSales, paytm, icici, fleet, credit, short]);

  const totalReceived = useMemo(() => {
    return sumOtherChannels + cashAmountComputed;
  }, [sumOtherChannels, cashAmountComputed]);

  const difference = totalReceived - totalSales;

  const ledgerDayLabel = useMemo(() => {
    if (!shift?.readingsCompleteAt) {
      return '';
    }
    const iso =
      shift.calendarDate?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(shift.calendarDate.trim())
        ? shift.calendarDate.trim()
        : format(shift.startTime.toDate(), 'yyyy-MM-dd');
    return format(new Date(`${iso}T12:00:00`), 'dd MMM yyyy');
  }, [shift]);

  const cashBookRows: CashBookSummaryRow[] = useMemo(() => {
    if (profile?.role !== 'manager') {
      return [];
    }
    const paytmN = Number.parseFloat(paytm) || 0;
    const iciciN = Number.parseFloat(icici) || 0;
    const fleetN = Number.parseFloat(fleet) || 0;
    const creditN = Number.parseFloat(credit) || 0;
    const shortN = Number.parseFloat(short) || 0;
    return buildCashBookSummary({
      totalSales,
      paytm: paytmN,
      icici: iciciN,
      fleet: fleetN,
      credit: creditN,
      ledgerSameDay: ledgerForDay,
      sheetStyleOutflows: true,
      explicitShortSum: shortN,
      differenceSumForShort: 0,
    });
  }, [profile?.role, totalSales, paytm, icici, fleet, credit, short, ledgerForDay]);

  function cashBookCellAmt(r: CashBookSummaryRow): string {
    const t = fmtInrDash(r.amount, r.alwaysShowAmount ?? false);
    return t === '—' ? '—' : `₹ ${t}`;
  }

  const fuelById = useMemo(() => new Map(fuels.map((f) => [f.id, f])), [fuels]);

  const creditLinesSum = useMemo(() => {
    return lines.reduce((acc, l) => acc + amountFromLitersAndRate(l.liters, l.ratePerL), 0);
  }, [lines]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!shift) {
      return;
    }
    if (existing?.status === 'pending' && !(profile?.role === 'manager' && isManagerEdit)) {
      setFormError('Reconciliation is already submitted and awaiting review.');
      return;
    }
    if (existing?.status === 'approved' && existing.locked) {
      setFormError('Reconciliation is approved and locked.');
      return;
    }
    for (const label of [
      [paytm, 'Paytm'],
      [icici, 'ICICI card'],
      [fleet, 'Fleet card'],
      [credit, 'Credit amount'],
      [short, 'Short'],
    ] as const) {
      const m = requireMin(label[0], 0, label[1]);
      if (m) {
        setFormError(m);
        return;
      }
    }
    if (cashAmountComputed < -EPS) {
      setFormError(
        'Paytm, ICICI, Fleet, and credit together cannot exceed the meter sales total. Reduce them or correct meter readings.',
      );
      return;
    }
    const creditN = Number(credit) || 0;
    if (creditN > EPS) {
      if (lines.length === 0) {
        setFormError('Add at least one credit line when credit amount is positive.');
        return;
      }
      if (fuels.length === 0) {
        setFormError('Add fuel types under Manager before recording credit sales.');
        return;
      }
      for (const l of lines) {
        const partyErr = requireNonEmpty(l.partyName, 'Party name');
        if (partyErr) {
          setFormError(partyErr);
          return;
        }
        if (!l.fuelTypeId) {
          setFormError('Select a fuel type for each credit line.');
          return;
        }
        const litresN = Number.parseFloat(l.liters);
        const rateN = Number.parseFloat(l.ratePerL);
        if (!Number.isFinite(litresN) || litresN <= 0) {
          setFormError('Each credit line needs litres greater than zero.');
          return;
        }
        if (!Number.isFinite(rateN) || rateN < 0) {
          setFormError('Each credit line needs a valid price per litre (₹/L).');
          return;
        }
        const lineAmt = amountFromLitersAndRate(l.liters, l.ratePerL);
        if (lineAmt <= EPS) {
          setFormError('Each credit line must have a positive total (litres × price).');
          return;
        }
      }
      if (Math.abs(creditLinesSum - creditN) > EPS) {
        setFormError('Sum of line totals (litres × price) must match credit amount.');
        return;
      }
    } else {
      for (const l of lines) {
        const t = amountFromLitersAndRate(l.liters, l.ratePerL);
        if (t > EPS || l.partyName.trim().length > 0) {
          setFormError('Remove credit allocation lines or set credit amount to match.');
          return;
        }
      }
    }
    setSaving(true);
    try {
      const creditLineItems: ReconciliationCreditLine[] = [];
      if (creditN > EPS) {
        const allCustomers = await listCreditCustomers(true);
        const idsByNormalizedName = new Map<string, string>();

        async function resolveCustomerId(displayNameRaw: string): Promise<string> {
          const displayName = displayNameRaw.trim();
          const norm = displayName.toLowerCase();
          const cached = idsByNormalizedName.get(norm);
          if (cached) {
            return cached;
          }
          const hit = allCustomers.find((c) => c.name.trim().toLowerCase() === norm);
          if (hit) {
            idsByNormalizedName.set(norm, hit.id);
            return hit.id;
          }
          const newId = await createCustomer({
            name: displayName,
            isActive: true,
          });
          idsByNormalizedName.set(norm, newId);
          return newId;
        }

        for (const l of lines) {
          const amount = amountFromLitersAndRate(l.liters, l.ratePerL);
          if (amount <= EPS) {
            continue;
          }
          const litersN = Number.parseFloat(l.liters);
          const rateN = Number.parseFloat(l.ratePerL);
          const customerId = await resolveCustomerId(l.partyName);
          creditLineItems.push({
            customerId,
            amount,
            fuelTypeId: l.fuelTypeId || undefined,
            liters: Number.isFinite(litersN) ? litersN : undefined,
            rateAtSale: Number.isFinite(rateN) ? rateN : undefined,
          });
        }
      }

      if (existing && profile?.role === 'manager' && isManagerEdit && existing.status === 'pending') {
        await updatePendingReconciliation(existing.id, {
          shiftId: shift.id,
          totalSalesAmount: totalSales,
          paytmOnline: Number(paytm),
          iciciCard: Number(icici),
          fleetCard: Number(fleet),
          creditAmount: creditN,
          shortAmount: Number.parseFloat(short) || 0,
          cashAmount: cashAmountComputed,
          totalReceived,
          difference: totalReceived - totalSales,
          creditLineItems,
        });
        nav('/manager/reconciliations', { replace: true });
        return;
      }

      await createReconciliationWithClose({
        shiftId: shift.id,
        operatorId: shift.operatorId,
        totalSalesAmount: totalSales,
        paytmOnline: Number(paytm),
        iciciCard: Number(icici),
        fleetCard: Number(fleet),
        creditAmount: creditN,
        shortAmount: Number.parseFloat(short) || 0,
        cashAmount: cashAmountComputed,
        totalReceived,
        difference: totalReceived - totalSales,
        creditLineItems,
      });
      if (profile?.role === 'manager') {
        nav('/manager', { replace: true });
      } else {
        nav('/operator', { replace: true });
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (accessError) {
    return <Alert severity="error">{accessError}</Alert>;
  }
  if (shift === undefined) {
    return <Typography>Loading…</Typography>;
  }
  if (shift === null) {
    return <Alert severity="warning">Shift not found.</Alert>;
  }
  if (!allowed) {
    return null;
  }
  if (loadErr) {
    return <Alert severity="error">{loadErr}</Alert>;
  }
  if (existing && !(profile?.role === 'manager' && isManagerEdit && existing.status === 'pending')) {
    if (existing.status === 'pending' || (existing.status === 'approved' && existing.locked)) {
      return (
        <Alert severity="info">
          <Typography>
            Reconciliation status: {existing.status}.{' '}
            {existing.status === 'pending' && 'You cannot change it while it is under review.'}
          </Typography>
          <Button size="small" onClick={() => nav(profile?.role === 'manager' ? '/manager' : '/operator')}>
            Back
          </Button>
        </Alert>
      );
    }
  }

  if (existing && isManagerEdit && profile?.role === 'manager' && existing.status !== 'pending') {
    return (
      <Alert severity="warning">
        <Typography>Only pending reconciliations can be edited.</Typography>
        <Button size="small" onClick={() => nav('/manager/reconciliations')} sx={{ mt: 1 }}>
          Back to queue
        </Button>
      </Alert>
    );
  }

  return (
    <Stack spacing={3} sx={{ pb: 3, maxWidth: 960 }}>
      <Box
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          background: (t) =>
            `linear-gradient(120deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 52%, ${t.palette.primary.light} 115%)`,
          color: 'primary.contrastText',
          p: { xs: 2.25, sm: 2.75 },
          boxShadow: (t) => `0 12px 40px ${alpha(t.palette.primary.main, 0.28)}`,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <FactCheckOutlinedIcon sx={{ opacity: 0.95 }} />
          <Typography variant="overline" sx={{ opacity: 0.92, letterSpacing: '0.12em', fontWeight: 600 }}>
            Payment split
          </Typography>
        </Stack>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          End-of-shift reconciliation
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.75 }}>
          Enter Paytm, cards, credit, and short so <strong>Cash</strong> matches your meter total. Manager sees the daily
          cash summary when logged in.
        </Typography>
      </Box>

      {isManagerEdit && existing?.status === 'pending' ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Editing a pending reconciliation — save to update the queue entry, then approve or reject from Reconciliations.
        </Alert>
      ) : null}

      <Paper
        component="form"
        onSubmit={handleSubmit}
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          boxShadow: (t) => `0 8px 28px ${alpha(t.palette.common.black, t.palette.mode === 'dark' ? 0.2 : 0.06)}`,
        }}
      >
        <Box sx={{ height: 3, bgcolor: 'primary.main', borderRadius: '2px 2px 0 0', mb: 2 }} />
      <Typography variant="body1" gutterBottom>
        Total sales amount: <strong>₹ {totalSales.toFixed(2)}</strong> for <strong>{operatorName}</strong>
      </Typography>
      {shift?.pumpAttendants?.trim() ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Pump attendants: <strong>{shift.pumpAttendants.trim()}</strong>
        </Typography>
      ) : null}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Machine: <strong>{machineLabel}</strong>
      </Typography>
      <TextField
        fullWidth
        label="Paytm / online (₹)"
        value={paytm}
        onChange={(e) => setPaytm(e.target.value)}
        type="number"
        margin="normal"
        slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
      />
      <TextField
        fullWidth
        label="ICICI card (₹)"
        value={icici}
        onChange={(e) => setIcici(e.target.value)}
        type="number"
        margin="normal"
      />
      <TextField
        fullWidth
        label="Fleet card (₹)"
        value={fleet}
        onChange={(e) => setFleet(e.target.value)}
        type="number"
        margin="normal"
      />
      <TextField
        fullWidth
        label="Credit amount (₹)"
        value={credit}
        onChange={(e) => setCredit(e.target.value)}
        type="number"
        margin="normal"
        helperText="If &gt; 0, allocate to customers below."
      />
      <TextField
        fullWidth
        label="Short (₹)"
        value={short}
        onChange={(e) => setShort(e.target.value)}
        type="number"
        margin="normal"
        slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
        helperText="Cash shortage to deduct after online / cards / credit."
      />
      <TextField
        fullWidth
        label="Cash (₹)"
        value={cashAmountComputed.toFixed(2)}
        type="number"
        margin="normal"
        error={cashAmountComputed < -EPS}
        helperText={
          cashAmountComputed < -EPS
            ? 'Non-cash allocations exceed meter sales — reduce Paytm, cards, or credit.'
            : 'Meter total − Paytm − ICICI − Fleet − Credit − Short'
        }
        slotProps={{
          input: { readOnly: true },
          htmlInput: {
            sx: cashAmountComputed < -EPS ? { bgcolor: 'error.light' } : undefined,
          },
        }}
      />
      <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, my: 1 }}>
        <Typography variant="body2">Total received: ₹ {totalReceived.toFixed(2)}</Typography>
        <Typography variant="body2" color={Math.abs(difference) < 0.01 ? 'text.secondary' : 'warning.main'}>
          Difference (short/over): ₹ {difference.toFixed(2)}
        </Typography>
      </Box>

      {profile?.role === 'manager' ? (
      <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'background.default' }}>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700 }}>
          Daily cash summary
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1.5 }}>
          Same structure as your cashier sheet. The top section is this shift&apos;s split of meter sales. Opening
          balance, cash received, and paid-out lines come from <strong>Manager → Ledger</strong> dated{' '}
          <strong>{ledgerDayLabel}</strong>. Post opening as a <strong>CASH</strong> receipt with &quot;opening&quot; in NAMES
          or PARTICULAR.
        </Typography>
        <TableContainer>
          <Table
            size="small"
            sx={{
              maxWidth: 520,
              '& td': { py: 0.75, borderBottom: '1px solid', borderColor: 'divider' },
            }}
          >
            <TableBody>
              {cashBookRows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell sx={{ fontWeight: r.bold ? 700 : 400, borderBottom: 'inherit' }}>{r.label}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: r.bold ? 700 : 400,
                      borderBottom: 'inherit',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cashBookCellAmt(r)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      ) : null}

      {Number(credit) > EPS && (
        <Stack spacing={1}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2">Credit allocation</Typography>
            <Button
              size="small"
              onClick={() => {
                const firstFuel = fuels[0];
                setLines((prev) => [
                  ...prev,
                  {
                    partyName: '',
                    fuelTypeId: firstFuel?.id ?? '',
                    liters: '0',
                    ratePerL: firstFuel != null ? String(firstFuel.currentRate) : '0',
                  },
                ]);
              }}
              disabled={fuels.length === 0}
            >
              Add line
            </Button>
          </Stack>
          {fuels.length === 0 ? (
            <Alert severity="warning">
              Add fuel types under Manager → Fuel prices before you can split credit by fuel and litres.
            </Alert>
          ) : null}
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5, overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 720, borderCollapse: 'collapse' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...creditSheetHeaderCellSx, minWidth: 160 }}>Party name</TableCell>
                  <TableCell sx={{ ...creditSheetHeaderCellSx, minWidth: 160 }}>Fuel</TableCell>
                  <TableCell sx={{ ...creditSheetHeaderCellSx, minWidth: 88 }} align="right">
                    Litres
                  </TableCell>
                  <TableCell sx={{ ...creditSheetHeaderCellSx, minWidth: 100 }} align="right">
                    ₹ / L
                  </TableCell>
                  <TableCell sx={{ ...creditSheetHeaderCellSx, minWidth: 96 }} align="right">
                    Total
                  </TableCell>
                  <TableCell sx={{ ...creditSheetHeaderCellSx, minWidth: 52 }} />
                </TableRow>
              </TableHead>
              <TableBody>
          {lines.map((l, i) => {
            const lineTotal = amountFromLitersAndRate(l.liters, l.ratePerL);
            return (
              <TableRow key={i}>
                <TableCell sx={creditSheetBodyCellSx}>
                  <TextField
                    label="Party name"
                    value={l.partyName}
                    onChange={(e) =>
                      setLines((p) => p.map((x, j) => (j === i ? { ...x, partyName: e.target.value } : x)))
                    }
                    size="small"
                    fullWidth
                    placeholder="e.g. SSVM, ST.XAVIER"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </TableCell>
                <TableCell sx={creditSheetBodyCellSx}>
                  <FormControl fullWidth size="small">
                    <InputLabel id={`fuel-${i}`} shrink={!!l.fuelTypeId}>
                      Fuel
                    </InputLabel>
                    <Select
                      labelId={`fuel-${i}`}
                      label="Fuel"
                      value={l.fuelTypeId}
                      onChange={(e) => {
                        const v = e.target.value as string;
                        const f = fuelById.get(v);
                        setLines((p) =>
                          p.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  fuelTypeId: v,
                                  ratePerL: f != null ? String(f.currentRate) : x.ratePerL,
                                }
                              : x,
                          ),
                        );
                      }}
                    >
                      {fuels.map((f) => (
                        <MenuItem key={f.id} value={f.id}>
                          {f.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell sx={creditSheetBodyCellSx}>
                  <TextField
                    label="Litres"
                    value={l.liters}
                    onChange={(e) =>
                      setLines((p) => p.map((x, j) => (j === i ? { ...x, liters: e.target.value } : x)))
                    }
                    type="number"
                    size="small"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: 0, step: 0.01 } }}
                  />
                </TableCell>
                <TableCell sx={creditSheetBodyCellSx}>
                  <TextField
                    label="Price (₹/L)"
                    value={l.ratePerL}
                    onChange={(e) =>
                      setLines((p) => p.map((x, j) => (j === i ? { ...x, ratePerL: e.target.value } : x)))
                    }
                    type="number"
                    size="small"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: 0, step: 0.01 } }}
                  />
                </TableCell>
                <TableCell sx={{ ...creditSheetBodyCellSx, pt: 1.75 }} align="right">
                  <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    ₹{lineTotal.toFixed(2)}
                  </Typography>
                </TableCell>
                <TableCell sx={creditSheetBodyCellSx} align="center">
                  {lines.length > 1 ? (
                    <IconButton
                      type="button"
                      aria-label={`Remove allocation line ${i + 1}`}
                      color="inherit"
                      size="small"
                      onClick={() =>
                        setLines((p) => (p.length <= 1 ? p : p.filter((_, j) => j !== i)))
                      }
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            Type any party name — matches an existing credit customer or creates a new one.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Sum of line totals: ₹ {creditLinesSum.toFixed(2)} (must match credit amount)
          </Typography>
        </Stack>
      )}
      {formError && <Alert severity="error">{formError}</Alert>}
      <Stack direction="row" spacing={2} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button type="submit" variant="contained" size="large" disabled={saving} sx={{ borderRadius: 1.5 }}>
          {saving
            ? 'Saving…'
            : isManagerEdit && existing?.status === 'pending'
              ? 'Save changes'
              : 'Submit & close shift'}
        </Button>
        <Button type="button" variant="outlined" onClick={() => nav(-1)} sx={{ borderRadius: 1.5 }}>
          Back
        </Button>
      </Stack>
    </Paper>
    </Stack>
  );
}
