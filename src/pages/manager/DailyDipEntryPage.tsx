import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Alert,
  alpha,
  Box,
  Button,
  CircularProgress,
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
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import OpacityOutlinedIcon from '@mui/icons-material/OpacityOutlined';

import { useAuth } from '@/context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { setFuelReceiptLitersForDay } from '@/services/fuelReceiptsService';
import { getTankStockDaySummary } from '@/services/fuelStockReconciliationService';
import {
  formatFuelLiters,
  previewStockFromDipCm,
  upsertFuelTankDipForDay,
} from '@/services/fuelStockService';
import { listFuelTypes } from '@/services/fuelTypesService';
import type { DailyFuelStockRow, FuelType } from '@/types/entities';
import { fuelStockDisplayMeta, FUEL_STOCK_UPDATED_EVENT } from '@/utils/fuelStockDisplay';
import {
  assertEntryDateAllowed,
  canBackdateEntries,
  clampEntryDateForRole,
  dateInputBoundsForRole,
  todayIso,
} from '@/utils/dateEntryPolicy';
import { canonicalDipCm, normalizeDipCm } from '@/utils/fuelTankCalibration';
import { FuelStockSubNav } from '@/pages/manager/FuelStockSubNav';

type FuelFormRow = {
  fuelTypeId: string;
  fuelName: string;
  openingDipCm: string;
  closingDipCm: string;
  receiptLiters: string;
};

const headSx = {
  fontWeight: 700,
  fontSize: '0.72rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  bgcolor: 'action.hover',
  color: 'text.secondary',
};

function rowsToForm(fuels: FuelType[], stockRows: DailyFuelStockRow[]): FuelFormRow[] {
  return fuels
    .filter((f) => f.tankCapacityLiters != null && f.tankCapacityLiters > 0)
    .map((f) => {
      const row = stockRows.find((r) => r.fuelTypeId === f.id);
      return {
        fuelTypeId: f.id,
        fuelName: f.name,
        openingDipCm: row?.openingDipCm != null ? String(canonicalDipCm(row.openingDipCm)) : '',
        closingDipCm: row?.closingDipCm != null ? String(canonicalDipCm(row.closingDipCm)) : '',
        receiptLiters: row?.receiptLiters != null ? String(row.receiptLiters) : '',
      };
    });
}

export function DailyDipEntryPage() {
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
  const [pumpDayIso, setPumpDayIso] = useState(initialDay);
  const [formRows, setFormRows] = useState<FuelFormRow[]>([]);
  const [stockRows, setStockRows] = useState<DailyFuelStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = searchParams.get('day');
    if (fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl)) {
      setPumpDayIso(clampEntryDateForRole(profile?.role, fromUrl));
    }
  }, [searchParams, profile?.role]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [fuels, summary] = await Promise.all([
        listFuelTypes(),
        getTankStockDaySummary(pumpDayIso),
      ]);
      setStockRows(summary.rows);
      setFormRows(rowsToForm(fuels, summary.rows));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [pumpDayIso]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener(FUEL_STOCK_UPDATED_EVENT, onRefresh);
    return () => window.removeEventListener(FUEL_STOCK_UPDATED_EVENT, onRefresh);
  }, [load]);

  const computed = useMemo(() => {
    const map = new Map<string, DailyFuelStockRow>();
    for (const r of stockRows) map.set(r.fuelTypeId, r);
    return map;
  }, [stockRows]);

  function updateRow(fuelTypeId: string, patch: Partial<FuelFormRow>) {
    setFormRows((prev) => prev.map((r) => (r.fuelTypeId === fuelTypeId ? { ...r, ...patch } : r)));
  }

  async function handleSave() {
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      const day = clampEntryDateForRole(profile?.role, pumpDayIso);
      assertEntryDateAllowed(profile?.role, day);
      if (day !== pumpDayIso) {
        setPumpDayIso(day);
      }
      for (const row of formRows) {
        const opening = row.openingDipCm.trim();
        if (opening !== '') {
          const cm = canonicalDipCm(Number(opening));
          if (!Number.isFinite(cm) || cm <= 0) throw new Error(`Invalid opening dip for ${row.fuelName}`);
          await upsertFuelTankDipForDay({
            fuelTypeId: row.fuelTypeId,
            pumpDayIso: day,
            dipKind: 'opening',
            dipCm: cm,
            recordedBy: profile?.name,
          });
        }

        const closing = row.closingDipCm.trim();
        if (closing !== '') {
          const cm = canonicalDipCm(Number(closing));
          if (!Number.isFinite(cm) || cm <= 0) throw new Error(`Invalid closing dip for ${row.fuelName}`);
          await upsertFuelTankDipForDay({
            fuelTypeId: row.fuelTypeId,
            pumpDayIso: day,
            dipKind: 'closing',
            dipCm: cm,
            recordedBy: profile?.name,
          });
        }

        const rcpt = row.receiptLiters.trim();
        const liters = rcpt === '' ? 0 : Number(rcpt);
        if (rcpt !== '' && (!Number.isFinite(liters) || liters < 0)) {
          throw new Error(`Invalid receipt liters for ${row.fuelName}`);
        }
        await setFuelReceiptLitersForDay({
          fuelTypeId: row.fuelTypeId,
          pumpDayIso: day,
          liters,
          recordedBy: profile?.name,
        });
      }
      setOk('Daily dip entries saved.');
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
          <OpacityOutlinedIcon sx={{ opacity: 0.95 }} />
          <Typography variant="overline" sx={{ opacity: 0.92, letterSpacing: '0.12em', fontWeight: 600 }}>
            Tank stock
          </Typography>
        </Stack>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Daily dip entry
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.75, maxWidth: 640 }}>
          Enter dip readings in <strong>cm</strong> for MS, HSD, and XP. Stock in liters is calculated from the
          calibration chart. Expected stock = opening + receipts − meter sales.
        </Typography>
      </Box>

      {err ? <Alert severity="error">{err}</Alert> : null}
      {ok ? <Alert severity="success">{ok}</Alert> : null}

      <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <TextField
            type="date"
            label="Pump day"
            value={pumpDayIso}
            onChange={(e) => setPumpDayIso(clampEntryDateForRole(profile?.role, e.target.value))}
            size="small"
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { min: dateBounds.min, max: dateBounds.max },
            }}
            helperText={
              canBackdateEntries(profile?.role)
                ? 'Owner can enter or correct past pump days.'
                : 'Managers can enter today only.'
            }
          />
          <Button variant="contained" startIcon={<SaveOutlinedIcon />} disabled={saving || loading} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : 'Save all fuels'}
          </Button>
        </Stack>
      </Paper>

      {loading ? (
        <Paper variant="outlined" sx={{ borderRadius: 2, py: 10, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={headSx}>Fuel</TableCell>
                <TableCell sx={headSx} align="right">Opening dip (cm)</TableCell>
                <TableCell sx={headSx} align="right">Closing dip (cm)</TableCell>
                <TableCell sx={headSx} align="right">Receipts (L)</TableCell>
                <TableCell sx={headSx} align="right">Opening stock</TableCell>
                <TableCell sx={headSx} align="right">Sales</TableCell>
                <TableCell sx={headSx} align="right">Expected</TableCell>
                <TableCell sx={headSx} align="right">Actual</TableCell>
                <TableCell sx={headSx} align="right">Variation</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {formRows.map((row) => {
                const meta = fuelStockDisplayMeta(row.fuelName);
                const calc = computed.get(row.fuelTypeId);
                const closingPreview =
                  row.closingDipCm.trim() !== ''
                    ? previewStockFromDipCm(Number(row.closingDipCm), row.fuelName)
                    : null;
                return (
                  <TableRow key={row.fuelTypeId} hover>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {meta.shortCode}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {meta.displayName}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={row.openingDipCm}
                        onChange={(e) => updateRow(row.fuelTypeId, { openingDipCm: e.target.value })}
                        sx={{ width: 96 }}
                        slotProps={{ htmlInput: { step: '0.1', min: 0 } }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={row.closingDipCm}
                        onChange={(e) => updateRow(row.fuelTypeId, { closingDipCm: e.target.value })}
                        sx={{ width: 96 }}
                        slotProps={{ htmlInput: { step: '0.1', min: 0 } }}
                      />
                      {closingPreview != null ? (
                        <Typography variant="caption" display="block" color="text.secondary">
                          → {normalizeDipCm(Number(row.closingDipCm))} cm = {formatFuelLiters(closingPreview)}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={row.receiptLiters}
                        onChange={(e) => updateRow(row.fuelTypeId, { receiptLiters: e.target.value })}
                        sx={{ width: 96 }}
                        slotProps={{ htmlInput: { min: 0 } }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {calc ? formatFuelLiters(calc.openingStockLiters) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {calc ? formatFuelLiters(calc.salesLiters) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {calc ? formatFuelLiters(calc.expectedStockLiters) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {closingPreview != null
                        ? formatFuelLiters(closingPreview)
                        : calc?.actualStockLiters != null
                          ? formatFuelLiters(calc.actualStockLiters)
                          : '—'}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 700,
                        color: calc?.variationAlert ? 'error.main' : 'inherit',
                      }}
                    >
                      {calc?.variationLiters != null
                        ? `${calc.variationLiters > 0 ? '+' : ''}${calc.variationLiters.toLocaleString('en-IN')} L`
                        : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
