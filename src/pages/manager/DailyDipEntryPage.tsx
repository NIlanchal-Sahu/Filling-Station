import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns';

import {
  alpha,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import { FUEL_CHART_COLORS } from '@/utils/fuelSalesChartDisplay';

import { PageHeader } from '@/components/ui/PageHeader';
import { ResponsiveTableContainer } from '@/components/ui/ResponsiveTableContainer';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import {
  aggregateFuelReceiptLitersByPumpDay,
  listFuelReceiptsInRange,
  sumFuelReceiptLitersByFuelForDay,
} from '@/services/fuelReceiptsService';
import {
  computeClosingBook,
  getPriorDayClosingBookLiters,
  listDipValueLedgerForDay,
  listDipValueLedgerInRange,
  upsertDipValueLedgerEntry,
} from '@/services/dipValueLedgerService';
import {
  getMeterSalesLitersByFuelTypeId,
  getMeterSalesLitersByPumpDayInRange,
} from '@/services/fuelStockReconciliationService';
import { listFuelTypes } from '@/services/fuelTypesService';
import type { FuelType } from '@/types/entities';
import {
  fuelStockDisplayMeta,
  FUEL_STOCK_SORT_ORDER,
  FUEL_STOCK_UPDATED_EVENT,
} from '@/utils/fuelStockDisplay';
import {
  computeOpeningVariationLiters,
  groupRegisterByFuel,
  priorCalendarDayClosingLiters,
  type DipValueRegisterRow,
} from '@/utils/dipValueRegister';
import { DipValueRegisterTable } from '@/components/fuel/DipValueRegisterTable';
import {
  assertEntryDateAllowed,
  clampEntryDateForRole,
  dateInputBoundsForRole,
  recalledAdminPumpDay,
  todayIso,
} from '@/utils/dateEntryPolicy';
import { FuelStockSubNav } from '@/pages/manager/FuelStockSubNav';
import {
  downloadDailyDipEntryPdf,
  downloadDipRegisterCsv,
  downloadDipRegisterExcel,
  downloadDipRegisterPdf,
} from '@/utils/dailyDipEntryExport';

type FuelFormRow = {
  fuelTypeId: string;
  fuelName: string;
  openingLiters: string;
  receiptLiters: string;
};

const headSx = {
  fontWeight: 700,
  fontSize: '0.68rem',
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  bgcolor: 'background.paper',
  color: 'text.primary',
  border: '1px solid',
  borderColor: 'divider',
  whiteSpace: 'nowrap' as const,
};

const cellSx = {
  border: '1px solid',
  borderColor: 'divider',
  fontVariantNumeric: 'tabular-nums' as const,
};

function fmtLedger(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

const REGISTER_FUEL_LABELS: Record<(typeof FUEL_STOCK_SORT_ORDER)[number], string> = {
  MS: 'Motor Spirit (MS)',
  HSD: 'High Speed Diesel (HSD)',
  XP: 'Extra Premium (XP)',
};

type RegisterFuelSlot = {
  shortCode: (typeof FUEL_STOCK_SORT_ORDER)[number];
  fuelTypeId: string | null;
};

function monthRangeForPumpDay(pumpDayIso: string): { start: string; end: string; label: string } {
  const d = parseISO(`${pumpDayIso}T12:00:00`);
  return {
    start: format(startOfMonth(d), 'yyyy-MM-dd'),
    end: format(endOfMonth(d), 'yyyy-MM-dd'),
    label: format(d, 'MMMM yyyy'),
  };
}

function resolveRegisterFuelSlots(fuels: FuelType[]): RegisterFuelSlot[] {
  const tankFuels = fuels.filter((f) => f.tankCapacityLiters != null && f.tankCapacityLiters > 0);
  return FUEL_STOCK_SORT_ORDER.map((shortCode) => {
    const match = tankFuels.find((f) => fuelStockDisplayMeta(f.name).shortCode === shortCode);
    return { shortCode, fuelTypeId: match?.id ?? null };
  });
}

function formatPurchaseReceiptLiters(liters: number): string {
  if (!Number.isFinite(liters) || liters <= 0) return '';
  return String(Math.round(liters * 10) / 10);
}

function buildFormRows(
  fuels: FuelType[],
  ledgers: Awaited<ReturnType<typeof listDipValueLedgerForDay>>,
  purchaseReceiptByFuel: Record<string, number>,
): FuelFormRow[] {
  const tankFuels = fuels.filter((f) => f.tankCapacityLiters != null && f.tankCapacityLiters > 0);
  const ledgerMap = new Map(ledgers.map((l) => [l.fuelTypeId, l]));

  return tankFuels.map((f) => {
    const ledger = ledgerMap.get(f.id);
    const openingLiters = ledger ? String(ledger.openingStockLiters) : '';
    const fromPurchase = purchaseReceiptByFuel[f.id] ?? 0;
    const receiptLiters = formatPurchaseReceiptLiters(fromPurchase);
    return {
      fuelTypeId: f.id,
      fuelName: f.name,
      openingLiters,
      receiptLiters,
    };
  });
}

export function DailyDipEntryPage() {
  const { profile } = useAuth();
  const { readOnlyOps } = usePermissions();
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
  const [salesByFuel, setSalesByFuel] = useState<Record<string, number>>({});
  const [priorClosingByFuel, setPriorClosingByFuel] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [registerByFuelId, setRegisterByFuelId] = useState<Map<string, DipValueRegisterRow[]>>(new Map());
  const [registerFuelSlots, setRegisterFuelSlots] = useState<RegisterFuelSlot[]>(() =>
    FUEL_STOCK_SORT_ORDER.map((shortCode) => ({ shortCode, fuelTypeId: null })),
  );
  const [registerTab, setRegisterTab] = useState<(typeof FUEL_STOCK_SORT_ORDER)[number]>('MS');
  const [registerExportAnchor, setRegisterExportAnchor] = useState<null | HTMLElement>(null);

  const monthRange = useMemo(() => monthRangeForPumpDay(pumpDayIso), [pumpDayIso]);

  const activeRegisterSlot = useMemo(
    () => registerFuelSlots.find((s) => s.shortCode === registerTab),
    [registerFuelSlots, registerTab],
  );

  const activeRegisterRows = useMemo(
    () =>
      activeRegisterSlot?.fuelTypeId
        ? (registerByFuelId.get(activeRegisterSlot.fuelTypeId) ?? [])
        : [],
    [activeRegisterSlot, registerByFuelId],
  );

  const registerFuelLabel = REGISTER_FUEL_LABELS[registerTab];

  useEffect(() => {
    const fromUrl = searchParams.get('day');
    if (fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl)) {
      setPumpDayIso(clampEntryDateForRole(profile?.role, fromUrl));
      return;
    }
    const recalled = profile?.role === 'admin' ? recalledAdminPumpDay() : null;
    if (recalled) {
      setPumpDayIso(clampEntryDateForRole(profile?.role, recalled));
    }
  }, [searchParams, profile?.role]);

  const registerSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const fuel = searchParams.get('fuel')?.trim().toUpperCase();
    if (fuel === 'MS' || fuel === 'HSD' || fuel === 'XP') {
      setRegisterTab(fuel);
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('view') !== 'register') {
      return;
    }
    const el = registerSectionRef.current;
    if (!el) {
      return;
    }
    const id = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, loading ? 400 : 80);
    return () => window.clearTimeout(id);
  }, [searchParams, loading, registerTab]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const fuels = await listFuelTypes();
      const { start, end } = monthRangeForPumpDay(pumpDayIso);
      const [dayLedgers, sales, ledgerEntries, meterSalesByDay, purchaseReceiptByFuel, fuelReceiptsInMonth] =
        await Promise.all([
          listDipValueLedgerForDay(pumpDayIso),
          getMeterSalesLitersByFuelTypeId(pumpDayIso),
          listDipValueLedgerInRange(start, end),
          getMeterSalesLitersByPumpDayInRange(start, end),
          sumFuelReceiptLitersByFuelForDay(pumpDayIso),
          listFuelReceiptsInRange(start, end),
        ]);
      const purchaseReceiptByDay = aggregateFuelReceiptLitersByPumpDay(fuelReceiptsInMonth);
      const rows = buildFormRows(fuels, dayLedgers, purchaseReceiptByFuel);
      setFormRows(rows);
      setSalesByFuel(sales);
      setRegisterFuelSlots(resolveRegisterFuelSlots(fuels));
      setRegisterByFuelId(
        groupRegisterByFuel(ledgerEntries, meterSalesByDay, purchaseReceiptByDay),
      );

      const priorClosing: Record<string, number | null> = {};
      await Promise.all(
        rows.map(async (r) => {
          const fuelEntries = ledgerEntries.filter((e) => e.fuelTypeId === r.fuelTypeId);
          let closing = priorCalendarDayClosingLiters(
            fuelEntries,
            pumpDayIso,
            meterSalesByDay,
            purchaseReceiptByDay,
          );
          if (closing == null) {
            closing = await getPriorDayClosingBookLiters(r.fuelTypeId, pumpDayIso);
          }
          priorClosing[r.fuelTypeId] = closing;
        }),
      );
      setPriorClosingByFuel(priorClosing);
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

  function updateRow(fuelTypeId: string, patch: Partial<FuelFormRow>) {
    setFormRows((prev) => prev.map((r) => (r.fuelTypeId === fuelTypeId ? { ...r, ...patch } : r)));
  }

  const rowCalcs = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number | null;
        sales: number;
        closing: number | null;
        variation: number | null;
      }
    >();
    for (const row of formRows) {
      const opening = row.openingLiters.trim() !== '' ? Number(row.openingLiters) : NaN;
      const receipt = row.receiptLiters.trim() === '' ? 0 : Number(row.receiptLiters);
      const sales = salesByFuel[row.fuelTypeId] ?? 0;
      const total = Number.isFinite(opening) ? opening + receipt : null;
      const closing = total != null ? computeClosingBook(opening, receipt, sales) : null;
      const variation = Number.isFinite(opening)
        ? computeOpeningVariationLiters(opening, priorClosingByFuel[row.fuelTypeId])
        : null;
      map.set(row.fuelTypeId, {
        total,
        sales,
        closing,
        variation,
      });
    }
    return map;
  }, [formRows, salesByFuel, priorClosingByFuel]);

  const pumpDayLabel = useMemo(
    () => format(parseISO(`${pumpDayIso}T12:00:00`), 'dd MMM yyyy'),
    [pumpDayIso],
  );

  function handleDownloadPdf() {
    const exportRows = formRows.map((row) => {
      const meta = fuelStockDisplayMeta(row.fuelName);
      const calc = rowCalcs.get(row.fuelTypeId);
      const opening = row.openingLiters.trim();
      const receipt = row.receiptLiters.trim() === '' ? '0' : row.receiptLiters.trim();
      const fmtNum = (n: number | null | undefined) =>
        n == null ? '—' : n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
      const fmtVar = (n: number | null | undefined) => {
        if (n == null) return '—';
        const sign = n > 0 ? '+' : '';
        return `${sign}${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`;
      };
      return {
        fuelCode: meta.shortCode,
        openingLiters: opening === '' ? '—' : fmtNum(Number(opening)),
        receiptLiters: fmtNum(Number(receipt)),
        totalLiters: fmtNum(calc?.total ?? null),
        salesLiters: fmtNum(calc?.sales ?? 0),
        closingLiters: fmtNum(calc?.closing ?? null),
        variationLiters: fmtVar(calc?.variation ?? null),
      };
    });
    downloadDailyDipEntryPdf(pumpDayIso, pumpDayLabel, exportRows);
  }

  function closeRegisterExportMenu() {
    setRegisterExportAnchor(null);
  }

  function exportRegisterCsv() {
    downloadDipRegisterCsv(registerFuelLabel, registerTab, monthRange.label, activeRegisterRows);
    closeRegisterExportMenu();
  }

  function exportRegisterExcel() {
    downloadDipRegisterExcel(registerFuelLabel, registerTab, monthRange.label, activeRegisterRows);
    closeRegisterExportMenu();
  }

  function exportRegisterPdf() {
    downloadDipRegisterPdf(registerFuelLabel, registerTab, monthRange.label, activeRegisterRows);
    closeRegisterExportMenu();
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
      const sales = await getMeterSalesLitersByFuelTypeId(day);

      for (const row of formRows) {
        const openingStr = row.openingLiters.trim();
        if (openingStr === '') {
          throw new Error(`Enter opening stock (L) for ${row.fuelName}`);
        }
        const opening = Number(openingStr);
        if (!Number.isFinite(opening) || opening < 0) {
          throw new Error(`Invalid opening stock for ${row.fuelName}`);
        }
        const rcpt = row.receiptLiters.trim();
        const receiptLiters = rcpt === '' ? 0 : Number(rcpt);
        if (rcpt !== '' && (!Number.isFinite(receiptLiters) || receiptLiters < 0)) {
          throw new Error(`Invalid receipt liters for ${row.fuelName}`);
        }
        const salesLiters = sales[row.fuelTypeId] ?? 0;

        await upsertDipValueLedgerEntry({
          fuelTypeId: row.fuelTypeId,
          pumpDayIso: day,
          openingStockLiters: opening,
          receiptLiters,
          salesLiters,
          updatedBy: profile?.name,
        });
      }
      setOk('Dip value entries saved.');
      await load();
      window.dispatchEvent(new Event(FUEL_STOCK_UPDATED_EVENT));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      <FuelStockSubNav />

      <PageHeader title="Daily dip entry" />

      {err ? <Alert severity="error">{err}</Alert> : null}
      {ok ? <Alert severity="success">{ok}</Alert> : null}

      <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
            <CalendarTodayOutlinedIcon fontSize="small" color="action" />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Pump day
            </Typography>
          </Stack>
          <TextField
            type="date"
            label="Date"
            value={pumpDayIso}
            onChange={(e) => setPumpDayIso(clampEntryDateForRole(profile?.role, e.target.value))}
            size="small"
            sx={{ minWidth: { sm: 200 } }}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { min: dateBounds.min, max: dateBounds.max },
            }}
          />
        </Stack>
      </Paper>

      {loading ? (
        <Paper variant="outlined" sx={{ borderRadius: 2, py: 10, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Box
            sx={{
              px: 2,
              py: 1.5,
              bgcolor: 'action.hover',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 1.5, sm: 2 }}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="space-between"
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Today&apos;s entry
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'auto' } }}
              >
                <Button
                  variant="outlined"
                  startIcon={<PictureAsPdfOutlinedIcon />}
                  disabled={loading || formRows.length === 0}
                  onClick={handleDownloadPdf}
                  sx={{ minHeight: 48 }}
                >
                  Download PDF
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SaveOutlinedIcon />}
                  disabled={readOnlyOps || saving || loading}
                  onClick={() => void handleSave()}
                  sx={{ minHeight: 48 }}
                >
                  {saving ? 'Saving…' : 'Save all fuels'}
                </Button>
              </Stack>
            </Stack>
          </Box>
          <ResponsiveTableContainer>
            <Table
              size="small"
              sx={{
                minWidth: 720,
                borderCollapse: 'collapse',
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={headSx}>Fuel</TableCell>
                  <TableCell sx={headSx} align="right">
                    Opening stock (L)
                  </TableCell>
                  <TableCell sx={headSx} align="right">
                    Receipt (L)
                  </TableCell>
                  <TableCell sx={headSx} align="right">
                    Total stock (L)
                  </TableCell>
                  <TableCell sx={headSx} align="right">
                    Sales (L)
                  </TableCell>
                  <TableCell sx={headSx} align="right">
                    Closing stock (L)
                  </TableCell>
                  <TableCell sx={headSx} align="right">
                    Variation
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {formRows.map((row) => {
                  const meta = fuelStockDisplayMeta(row.fuelName);
                  const calc = rowCalcs.get(row.fuelTypeId);
                  return (
                    <TableRow key={row.fuelTypeId} hover>
                      <TableCell sx={cellSx}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor:
                                FUEL_CHART_COLORS[meta.shortCode as keyof typeof FUEL_CHART_COLORS] ??
                                'text.secondary',
                              flexShrink: 0,
                            }}
                          />
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {meta.shortCode}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={cellSx}>
                        <TextField
                          size="small"
                          type="number"
                          value={row.openingLiters}
                          onChange={(e) => updateRow(row.fuelTypeId, { openingLiters: e.target.value })}
                          disabled={readOnlyOps}
                          sx={{ width: 108 }}
                          slotProps={{ htmlInput: { step: '0.1', min: 0 } }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={cellSx}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontVariantNumeric: 'tabular-nums',
                            color: row.receiptLiters ? 'text.primary' : 'text.disabled',
                            minWidth: 72,
                            textAlign: 'right',
                            pr: 0.5,
                          }}
                        >
                          {row.receiptLiters !== '' ? fmtLedger(Number(row.receiptLiters)) : '0'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={cellSx}>
                        {calc?.total != null ? fmtLedger(calc.total) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={cellSx}>
                        {fmtLedger(calc?.sales ?? 0)}
                      </TableCell>
                      <TableCell align="right" sx={{ ...cellSx, fontWeight: 600 }}>
                        {calc?.closing != null ? fmtLedger(calc.closing) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={cellSx}>
                        {calc?.variation != null
                          ? `${calc.variation > 0 ? '+' : ''}${fmtLedger(calc.variation)}`
                          : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </Paper>
      )}

      <Divider sx={{ my: 1 }} />

      <Paper
        ref={registerSectionRef}
        component="section"
        id="daily-dip-register"
        variant="outlined"
        sx={{ borderRadius: 2, p: { xs: 2, sm: 2.5 } }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="flex-start"
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ minWidth: 0, flex: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                color: 'primary.main',
                flexShrink: 0,
              }}
            >
              <HistoryOutlinedIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
                <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                  Register history
                </Typography>
                <Chip size="small" label={monthRange.label} variant="outlined" sx={{ fontWeight: 600 }} />
                {!loading ? (
                  <Chip
                    size="small"
                    label={`${activeRegisterRows.length} ${activeRegisterRows.length === 1 ? 'day' : 'days'}`}
                    color="primary"
                    variant="outlined"
                  />
                ) : null}
              </Stack>
            </Box>
          </Stack>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadOutlinedIcon />}
            disabled={loading || activeRegisterRows.length === 0}
            onClick={(e) => setRegisterExportAnchor(e.currentTarget)}
            sx={{
              flexShrink: 0,
              minHeight: 40,
              fontWeight: 700,
              textTransform: 'none',
              alignSelf: { xs: 'stretch', sm: 'flex-start' },
            }}
          >
            Download
          </Button>
          <Menu
            anchorEl={registerExportAnchor}
            open={Boolean(registerExportAnchor)}
            onClose={closeRegisterExportMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={exportRegisterPdf} sx={{ minHeight: 44 }}>
              <ListItemIcon>
                <PictureAsPdfOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="PDF" secondary="Print-ready register" />
            </MenuItem>
            <MenuItem onClick={exportRegisterExcel} sx={{ minHeight: 44 }}>
              <ListItemIcon>
                <GridOnOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Excel" secondary=".xls spreadsheet" />
            </MenuItem>
            <MenuItem onClick={exportRegisterCsv} sx={{ minHeight: 44 }}>
              <ListItemIcon>
                <TableChartOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="CSV" secondary="Comma-separated values" />
            </MenuItem>
          </Menu>
        </Stack>

        <ToggleButtonGroup
          value={registerTab}
          exclusive
          onChange={(_, value: (typeof FUEL_STOCK_SORT_ORDER)[number] | null) => {
            if (value) setRegisterTab(value);
          }}
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            mb: 2,
            '& .MuiToggleButtonGroup-grouped': {
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '999px !important',
              mx: '0 !important',
            },
          }}
        >
          {FUEL_STOCK_SORT_ORDER.map((code) => {
            const color = FUEL_CHART_COLORS[code];
            const selected = registerTab === code;
            return (
              <ToggleButton
                key={code}
                value={code}
                sx={{
                  px: 2.5,
                  py: 1,
                  textTransform: 'none',
                  fontWeight: 700,
                  gap: 1,
                  ...(selected
                    ? {
                        bgcolor: `${alpha(color, 0.14)} !important`,
                        borderColor: `${color} !important`,
                        color: 'text.primary',
                      }
                    : {}),
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                {code}
              </ToggleButton>
            );
          })}
        </ToggleButtonGroup>

        {loading ? (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <DipValueRegisterTable
            key={registerTab}
            title={registerTab}
            showTitle={false}
            highlightDayIso={pumpDayIso}
            accentColor={FUEL_CHART_COLORS[registerTab]}
            rows={activeRegisterRows}
            emptyMessage={`No ${registerTab} entries saved for ${monthRange.label} yet.`}
          />
        )}
      </Paper>
    </Stack>
  );
}
