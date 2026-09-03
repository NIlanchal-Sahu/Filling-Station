import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  Alert,
  alpha,
  Box,
  Button,
  CircularProgress,
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
} from '@mui/material';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';

import { useAuth } from '@/context/AuthContext';
import { listFuelReceiptsInRange, recordFuelReceipt } from '@/services/fuelReceiptsService';
import { listFuelTypes } from '@/services/fuelTypesService';
import type { FuelReceipt, FuelType } from '@/types/entities';
import { fuelStockDisplayMeta, FUEL_STOCK_UPDATED_EVENT } from '@/utils/fuelStockDisplay';
import {
  assertEntryDateAllowed,
  canBackdateEntries,
  clampEntryDateForRole,
  dateInputBoundsForRole,
  todayIso,
} from '@/utils/dateEntryPolicy';
import {
  formatPurchaseKl,
  formatPurchaseMoney,
  klFromLiters,
  litersFromKl,
  purchaseLineGrandTotal,
  purchaseLineTotal,
  purchaseLineVat,
  purchaseVatPercentLabel,
} from '@/utils/fuelPurchaseDisplay';
import { FuelStockSubNav } from '@/pages/manager/FuelStockSubNav';

const headSx = {
  fontWeight: 700,
  fontSize: '0.7rem',
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  bgcolor: 'background.paper',
  color: 'text.primary',
  border: '1px solid',
  borderColor: 'divider',
  whiteSpace: 'nowrap' as const,
  px: 1,
  py: 1,
};

const cellSx = {
  border: '1px solid',
  borderColor: 'divider',
  fontSize: '0.82rem',
  fontVariantNumeric: 'tabular-nums' as const,
  px: 1,
  py: 0.75,
};

function monthStartIso(): string {
  const d = new Date();
  return format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd');
}

function formatPumpDayLabel(iso: string): string {
  return format(parseISO(iso), 'dd-MM-yyyy');
}

type PurchaseRow = FuelReceipt & {
  kl: number;
  total: number;
  vat: number;
  grandTotal: number;
};

function buildPurchaseRow(receipt: FuelReceipt, fuelCode: string): PurchaseRow {
  const kl = klFromLiters(receipt.liters);
  const rate = receipt.ratePerKl ?? 0;
  const total = rate > 0 ? purchaseLineTotal(kl, rate) : 0;
  const vat = rate > 0 ? purchaseLineVat(total, fuelCode) : 0;
  return {
    ...receipt,
    kl,
    total,
    vat,
    grandTotal: purchaseLineGrandTotal(total, vat),
  };
}

export function FuelPurchasePage() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const dateBounds = dateInputBoundsForRole(profile?.role);

  const initialDay = (() => {
    const fromUrl = searchParams.get('day');
    if (fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl)) {
      return clampEntryDateForRole(profile?.role, fromUrl);
    }
    return todayIso();
  })();

  const [fromIso, setFromIso] = useState(monthStartIso());
  const [toIso, setToIso] = useState(todayIso());
  const [fuels, setFuels] = useState<FuelType[]>([]);
  const [fuelTypeId, setFuelTypeId] = useState('');
  const [receipts, setReceipts] = useState<FuelReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [pumpDayIso, setPumpDayIso] = useState(initialDay);
  const [quantityKl, setQuantityKl] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [materialCode, setMaterialCode] = useState('');
  const [ratePerKl, setRatePerKl] = useState('');

  const selectedFuel = useMemo(
    () => fuels.find((f) => f.id === fuelTypeId) ?? null,
    [fuels, fuelTypeId],
  );
  const fuelCode = selectedFuel ? fuelStockDisplayMeta(selectedFuel.name).shortCode : 'FUEL';
  const vatPercentLabel = purchaseVatPercentLabel(fuelCode);

  const rows = useMemo(
    () => receipts.map((r) => buildPurchaseRow(r, fuelCode)),
    [receipts, fuelCode],
  );

  const footerTotals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          kl: acc.kl + row.kl,
          total: acc.total + row.total,
          vat: acc.vat + row.vat,
          grandTotal: acc.grandTotal + row.grandTotal,
        }),
        { kl: 0, total: 0, vat: 0, grandTotal: 0 },
      ),
    [rows],
  );

  const previewKl = Number(quantityKl);
  const previewRate = Number(ratePerKl);
  const previewTotal =
    Number.isFinite(previewKl) && Number.isFinite(previewRate) && previewKl > 0 && previewRate > 0
      ? purchaseLineTotal(previewKl, previewRate)
      : null;
  const previewVat = previewTotal != null ? purchaseLineVat(previewTotal, fuelCode) : null;
  const previewGrand =
    previewTotal != null && previewVat != null ? purchaseLineGrandTotal(previewTotal, previewVat) : null;

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const fuelList = await listFuelTypes();
      const tankFuels = fuelList.filter((f) => f.tankCapacityLiters != null && f.tankCapacityLiters > 0);
      setFuels(tankFuels);

      const activeFuelId =
        fuelTypeId && tankFuels.some((f) => f.id === fuelTypeId)
          ? fuelTypeId
          : tankFuels.find((f) => fuelStockDisplayMeta(f.name).shortCode === 'HSD')?.id ??
            tankFuels[0]?.id ??
            '';

      if (activeFuelId && activeFuelId !== fuelTypeId) {
        setFuelTypeId(activeFuelId);
      }

      if (activeFuelId) {
        const list = await listFuelReceiptsInRange(fromIso, toIso, activeFuelId);
        setReceipts(list);
      } else {
        setReceipts([]);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [fromIso, toIso, fuelTypeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const fromUrl = searchParams.get('day');
    if (fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl)) {
      const day = clampEntryDateForRole(profile?.role, fromUrl);
      setPumpDayIso(day);
      setFromIso(day);
      setToIso(day);
    }
  }, [searchParams, profile?.role]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener(FUEL_STOCK_UPDATED_EVENT, onRefresh);
    return () => window.removeEventListener(FUEL_STOCK_UPDATED_EVENT, onRefresh);
  }, [load]);

  useEffect(() => {
    if (!selectedFuel) return;
    const lastRate = [...receipts].reverse().find((r) => r.ratePerKl != null)?.ratePerKl;
    setRatePerKl(lastRate != null ? String(lastRate) : '');
  }, [selectedFuel?.id, receipts, selectedFuel]);

  async function handleAdd() {
    setErr(null);
    setOk(null);

    const kl = Number(quantityKl);
    const rate = Number(ratePerKl);
    if (!fuelTypeId) {
      setErr('Select a fuel type.');
      return;
    }
    if (!Number.isFinite(kl) || kl <= 0) {
      setErr('Enter quantity in KL.');
      return;
    }
    if (!invoiceNo.trim()) {
      setErr('Enter invoice number.');
      return;
    }
    if (!materialCode.trim()) {
      setErr('Enter material code.');
      return;
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      setErr('Enter rate per KL.');
      return;
    }

    const day = clampEntryDateForRole(profile?.role, pumpDayIso);
    try {
      assertEntryDateAllowed(profile?.role, day);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Date not allowed');
      return;
    }

    setSaving(true);
    try {
      await recordFuelReceipt({
        fuelTypeId,
        pumpDayIso: day,
        liters: litersFromKl(kl),
        ratePerKl: rate,
        materialCode: materialCode.trim(),
        invoiceNo: invoiceNo.trim(),
        recordedBy: profile?.name,
      });
      setQuantityKl('');
      setInvoiceNo('');
      setOk('Purchase recorded.');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      <FuelStockSubNav />

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
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <LocalGasStationOutlinedIcon sx={{ opacity: 0.95 }} />
          <Typography variant="overline" sx={{ opacity: 0.92, letterSpacing: '0.12em', fontWeight: 600 }}>
            Tank stock
          </Typography>
        </Stack>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Fuel purchase register
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.75, maxWidth: 760 }}>
          Record inward deliveries in KL with invoice, material code, rate, and VAT (HSD 24%, MS/XP 28%).
          Stock uses liters (KL × 1,000).
        </Typography>
      </Box>

      {err ? <Alert severity="error">{err}</Alert> : null}
      {ok ? <Alert severity="success">{ok}</Alert> : null}

      <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField
            select
            label="Fuel"
            value={fuelTypeId}
            onChange={(e) => setFuelTypeId(e.target.value)}
            size="small"
            sx={{ minWidth: 120 }}
          >
            {fuels.map((f) => (
              <MenuItem key={f.id} value={f.id}>
                {fuelStockDisplayMeta(f.name).shortCode}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            label="From"
            value={fromIso}
            onChange={(e) => setFromIso(clampEntryDateForRole(profile?.role, e.target.value))}
            size="small"
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { min: dateBounds.min, max: dateBounds.max },
            }}
            sx={{ width: 160 }}
          />
          <TextField
            type="date"
            label="To"
            value={toIso}
            onChange={(e) => setToIso(clampEntryDateForRole(profile?.role, e.target.value))}
            size="small"
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { min: dateBounds.min, max: dateBounds.max },
            }}
            sx={{ width: 160 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
            {canBackdateEntries(profile?.role)
              ? 'Admin can view and enter past dates.'
              : 'Managers: today only for new entries.'}
          </Typography>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Add row
        </Typography>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
          <TextField
            type="date"
            label="Date"
            value={pumpDayIso}
            onChange={(e) => setPumpDayIso(clampEntryDateForRole(profile?.role, e.target.value))}
            size="small"
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { min: dateBounds.min, max: dateBounds.max },
            }}
            sx={{ width: 160 }}
          />
          <TextField
            label={`${fuelCode} (KL)`}
            type="number"
            value={quantityKl}
            onChange={(e) => setQuantityKl(e.target.value)}
            size="small"
            sx={{ width: 100 }}
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
          />
          <TextField
            label="Invoice no."
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            size="small"
            sx={{ width: 140 }}
          />
          <TextField
            label="Material code"
            value={materialCode}
            onChange={(e) => setMaterialCode(e.target.value)}
            size="small"
            sx={{ width: 120 }}
          />
          <TextField
            label={`${fuelCode} rate`}
            type="number"
            value={ratePerKl}
            onChange={(e) => setRatePerKl(e.target.value)}
            size="small"
            sx={{ width: 130 }}
            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          />
          <TextField
            label="Total"
            value={previewTotal != null ? formatPurchaseMoney(previewTotal) : ''}
            size="small"
            slotProps={{ input: { readOnly: true } }}
            sx={{ width: 130 }}
          />
          <TextField
            label={`VAT ${vatPercentLabel}%`}
            value={previewVat != null ? formatPurchaseMoney(previewVat, 4) : ''}
            size="small"
            slotProps={{ input: { readOnly: true } }}
            sx={{ width: 130 }}
          />
          <TextField
            label="Grand total"
            value={previewGrand != null ? formatPurchaseMoney(previewGrand, 4) : ''}
            size="small"
            slotProps={{ input: { readOnly: true } }}
            sx={{ width: 140 }}
          />
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <AddOutlinedIcon />}
            disabled={saving || loading}
            onClick={() => void handleAdd()}
            sx={{ alignSelf: { xs: 'stretch', lg: 'center' }, whiteSpace: 'nowrap' }}
          >
            Add
          </Button>
        </Stack>
      </Paper>

      {loading ? (
        <Paper variant="outlined" sx={{ borderRadius: 2, py: 8, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 960, borderCollapse: 'collapse' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={headSx}>Date</TableCell>
                <TableCell sx={headSx} align="right">
                  {fuelCode}
                </TableCell>
                <TableCell sx={headSx} align="center">
                  Quantity
                </TableCell>
                <TableCell sx={headSx}>Invoice no.</TableCell>
                <TableCell sx={headSx}>Material code</TableCell>
                <TableCell sx={headSx} align="right">
                  {fuelCode} rate
                </TableCell>
                <TableCell sx={headSx} align="right">
                  Total
                </TableCell>
                <TableCell sx={headSx} align="right">
                  VAT payable {vatPercentLabel}%
                </TableCell>
                <TableCell sx={headSx} align="right">
                  Grand total
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ ...cellSx, py: 4, color: 'text.secondary' }}>
                    No {fuelCode} purchases between {formatPumpDayLabel(fromIso)} and {formatPumpDayLabel(toIso)}.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={cellSx}>{formatPumpDayLabel(row.pumpDayIso)}</TableCell>
                    <TableCell sx={cellSx} align="right">
                      {formatPurchaseKl(row.kl)}
                    </TableCell>
                    <TableCell sx={cellSx} align="center">
                      KL
                    </TableCell>
                    <TableCell sx={cellSx}>{row.invoiceNo ?? '—'}</TableCell>
                    <TableCell sx={cellSx}>{row.materialCode ?? '—'}</TableCell>
                    <TableCell sx={cellSx} align="right">
                      {row.ratePerKl != null ? formatPurchaseMoney(row.ratePerKl) : '—'}
                    </TableCell>
                    <TableCell sx={cellSx} align="right">
                      {row.ratePerKl != null ? formatPurchaseMoney(row.total) : '—'}
                    </TableCell>
                    <TableCell sx={cellSx} align="right">
                      {row.ratePerKl != null ? formatPurchaseMoney(row.vat, 4) : '—'}
                    </TableCell>
                    <TableCell sx={cellSx} align="right">
                      {row.ratePerKl != null ? formatPurchaseMoney(row.grandTotal, 4) : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
              {rows.length > 0 ? (
                <TableRow>
                  <TableCell sx={{ ...cellSx, fontWeight: 700 }}>Total</TableCell>
                  <TableCell sx={{ ...cellSx, fontWeight: 700 }} align="right">
                    {formatPurchaseKl(footerTotals.kl)}
                  </TableCell>
                  <TableCell sx={cellSx} align="center">
                    KL
                  </TableCell>
                  <TableCell sx={cellSx} colSpan={2} />
                  <TableCell sx={cellSx} />
                  <TableCell sx={{ ...cellSx, fontWeight: 700 }} align="right">
                    {formatPurchaseMoney(footerTotals.total)}
                  </TableCell>
                  <TableCell sx={{ ...cellSx, fontWeight: 700 }} align="right">
                    {formatPurchaseMoney(footerTotals.vat, 4)}
                  </TableCell>
                  <TableCell sx={{ ...cellSx, fontWeight: 700 }} align="right">
                    {formatPurchaseMoney(footerTotals.grandTotal, 4)}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
