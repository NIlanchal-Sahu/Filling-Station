import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReadOnlyBanner } from '@/components/ui/ReadOnlyBanner';
import { KpiStatSkeleton } from '@/components/ui/KpiStatSkeleton';
import { DashboardSection } from '@/components/ui/DashboardSection';
import { usePermissions } from '@/hooks/usePermissions';
import { listFuelTypes, updateFuelRate, createFuelType } from '@/services/fuelTypesService';
import { format } from 'date-fns';
import type { FuelType } from '@/types/entities';
import { requireMin, requireNonEmpty } from '@/utils/validation';
import { FUEL_STOCK_SORT_ORDER, fuelStockDisplayMeta } from '@/utils/fuelStockDisplay';
import { FUEL_CHART_COLORS } from '@/utils/fuelSalesChartDisplay';

function fmtRate(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fuelAccent(name: string): string {
  const code = fuelStockDisplayMeta(name).shortCode;
  if (code === 'MS') return FUEL_CHART_COLORS.MS;
  if (code === 'HSD') return FUEL_CHART_COLORS.HSD;
  if (code === 'XP') return FUEL_CHART_COLORS.XP;
  return '#0d47a1';
}

function sortFuelTypes(rows: FuelType[]): FuelType[] {
  return [...rows].sort((a, b) => {
    const aCode = fuelStockDisplayMeta(a.name).shortCode;
    const bCode = fuelStockDisplayMeta(b.name).shortCode;
    const ai = FUEL_STOCK_SORT_ORDER.indexOf(aCode as (typeof FUEL_STOCK_SORT_ORDER)[number]);
    const bi = FUEL_STOCK_SORT_ORDER.indexOf(bCode as (typeof FUEL_STOCK_SORT_ORDER)[number]);
    const aRank = ai === -1 ? 999 : ai;
    const bRank = bi === -1 ? 999 : bi;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name);
  });
}

function updatedLabel(f: FuelType): string {
  if (!f.lastUpdatedAt) return 'Not updated yet';
  try {
    return format(f.lastUpdatedAt.toDate(), 'dd MMM yyyy, hh:mm a');
  } catch {
    return '—';
  }
}

export function FuelPricesPage() {
  const { can, readOnlyOps } = usePermissions();
  const canEditFuel = can('edit:fuel');
  const canAddFuel = canEditFuel;
  const [rows, setRows] = useState<FuelType[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newRate, setNewRate] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);

  const ordered = useMemo(() => sortFuelTypes(rows), [rows]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      setRows(await listFuelTypes());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      {!canEditFuel ? <ReadOnlyBanner /> : null}
      <PageHeader
        title="Fuel prices"
        subtitle={
          canEditFuel
            ? 'Current selling rate per litre. Save a change before that day’s End meters.'
            : 'Current selling rate per litre. Rates are set by the manager.'
        }
      />

      {err && <Alert severity="error">{err}</Alert>}

      <DashboardSection
        title="Current rates"
        subtitle="₹ per litre at the pump."
      >
        {loading ? (
          <Grid container spacing={2}>
            {[0, 1, 2].map((i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                <KpiStatSkeleton />
              </Grid>
            ))}
          </Grid>
        ) : ordered.length === 0 ? (
          <Paper variant="outlined" sx={{ borderRadius: 2, py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">No fuel types yet.</Typography>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {ordered.map((f) => (
              <Grid key={f.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <FuelRateCard
                  f={f}
                  busy={saving === f.id}
                  readOnly={!canEditFuel}
                  onSave={async (rate: string) => {
                    setFormErr(null);
                    const m = requireMin(rate, 0, 'Rate');
                    if (m) {
                      setFormErr(m);
                      return;
                    }
                    setSaving(f.id);
                    try {
                      await updateFuelRate(f.id, Number(rate));
                      await load();
                    } catch (e) {
                      setFormErr(e instanceof Error ? e.message : 'Update failed');
                    } finally {
                      setSaving(null);
                    }
                  }}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </DashboardSection>

      {formErr ? (
        <Alert severity="error">{formErr}</Alert>
      ) : null}

      {canAddFuel ? (
        <Card
          elevation={0}
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            '&:hover': { boxShadow: (t) => `0 8px 24px ${alpha(t.palette.common.black, 0.06)}` },
          }}
        >
          <Box sx={{ height: 3, bgcolor: 'success.main' }} />
          <CardContent sx={{ pt: 2.5 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <PlaylistAddOutlinedIcon color="success" sx={{ mt: 0.25 }} />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Add fuel type
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  New product with a starting ₹/L.
                </Typography>
              </Box>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-start' }}>
              <TextField
                size="small"
                label="Fuel name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={readOnlyOps}
                sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              />
              <TextField
                size="small"
                label="₹ per litre"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                type="number"
                disabled={readOnlyOps}
                sx={{ width: { xs: '100%', sm: 140 }, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              />
              <Button
                variant="contained"
                onClick={async () => {
                  setFormErr(null);
                  const a = requireNonEmpty(newName, 'Name');
                  const b = requireMin(newRate, 0, 'Rate');
                  if (a || b) {
                    setFormErr(a || b || null);
                    return;
                  }
                  setSaving('new');
                  try {
                    await createFuelType(newName.trim(), Number(newRate));
                    setNewName('');
                    setNewRate('');
                    await load();
                  } catch (e) {
                    setFormErr(e instanceof Error ? e.message : 'Create failed');
                  } finally {
                    setSaving(null);
                  }
                }}
                disabled={readOnlyOps || saving === 'new'}
                sx={{ borderRadius: 1.5, px: 3, minHeight: 40 }}
              >
                Add fuel
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}

function FuelRateCard({
  f,
  onSave,
  busy,
  readOnly,
}: {
  f: FuelType;
  onSave: (r: string) => void;
  busy: boolean;
  readOnly?: boolean;
}) {
  const [r, setR] = useState(String(f.currentRate));
  const accent = fuelAccent(f.name);
  const meta = fuelStockDisplayMeta(f.name);

  useEffect(() => {
    setR(String(f.currentRate));
  }, [f.currentRate]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.25,
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        position: 'relative',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          bgcolor: accent,
        }}
      />
      <Stack spacing={1.5} sx={{ pt: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              {f.name}
            </Typography>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                mt: 0.5,
                letterSpacing: '-0.03em',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.15,
              }}
            >
              ₹{fmtRate(readOnly ? f.currentRate : Number(r) || f.currentRate)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
              per litre
            </Typography>
          </Box>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(accent, 0.14),
              color: accent,
              flexShrink: 0,
            }}
          >
            <LocalGasStationOutlinedIcon />
          </Box>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={meta.shortCode}
            sx={{
              fontWeight: 700,
              bgcolor: alpha(accent, 0.12),
              color: accent,
              borderRadius: 1,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Updated {updatedLabel(f)}
          </Typography>
        </Stack>

        {readOnly ? null : (
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              type="number"
              size="small"
              label="₹/L"
              value={r}
              onChange={(e) => setR(e.target.value)}
              sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 1.25 } }}
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
            />
            <Button
              size="medium"
              variant="contained"
              disabled={busy}
              onClick={() => onSave(r)}
              sx={{ borderRadius: 1.25, minHeight: 40, px: 2 }}
            >
              {busy ? '…' : 'Save'}
            </Button>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
