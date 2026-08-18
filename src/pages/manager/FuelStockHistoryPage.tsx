import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';

import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  LinearProgress,
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
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { format } from 'date-fns';

import { useAuth } from '@/context/AuthContext';
import { getFuelType } from '@/services/fuelTypesService';
import {
  formatFuelLiters,
  formatFuelPercent,
  getFuelStockOverview,
  listFuelTankDips,
  previewStockFromDipCm,
  recordFuelTankDip,
} from '@/services/fuelStockService';
import { formatDipCm } from '@/utils/fuelTankCalibration';
import type { FuelStockItem, FuelTankDipReading } from '@/types/entities';
import {
  fuelStockDisplayMeta,
  fuelStockHealthColor,
  fuelStockHealthEmoji,
  fuelStockHealthLabel,
} from '@/utils/fuelStockDisplay';
import { requirePositiveNumber } from '@/utils/validation';

const headSx = {
  fontWeight: 700,
  fontSize: '0.72rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  bgcolor: 'action.hover',
  color: 'text.secondary',
};

export function FuelStockHistoryPage() {
  const { fuelTypeId = '' } = useParams();
  const theme = useTheme();
  const { profile } = useAuth();

  const [item, setItem] = useState<FuelStockItem | null>(null);
  const [dips, setDips] = useState<FuelTankDipReading[]>([]);
  const [fuelName, setFuelName] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [dipInput, setDipInput] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!fuelTypeId) return;
    setLoading(true);
    setErr(null);
    try {
      const [fuel, overview, history] = await Promise.all([
        getFuelType(fuelTypeId),
        getFuelStockOverview(),
        listFuelTankDips(fuelTypeId),
      ]);
      if (!fuel) {
        setErr('Fuel type not found.');
        return;
      }
      setFuelName(fuel.name);
      setItem(overview.items.find((i) => i.fuelTypeId === fuelTypeId) ?? null);
      setDips(history);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load stock history');
    } finally {
      setLoading(false);
    }
  }, [fuelTypeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayMeta = useMemo(() => fuelStockDisplayMeta(fuelName || 'Fuel'), [fuelName]);

  const previewLiters = useMemo(() => {
    const n = Number(dipInput);
    if (dipInput === '' || Number.isNaN(n) || n <= 0) return null;
    return previewStockFromDipCm(n, fuelName || 'Fuel');
  }, [dipInput, fuelName]);

  async function handleSaveDip() {
    setFormErr(null);
    const validationErr = requirePositiveNumber(dipInput, 'Dip reading');
    if (validationErr) {
      setFormErr(validationErr);
      return;
    }
    const dipCm = Number(dipInput);
    const liters = previewStockFromDipCm(dipCm, fuelName || 'Fuel');
    const cap = item?.tankCapacityLiters;
    if (cap != null && liters > cap) {
      setFormErr(`Calculated stock (${formatFuelLiters(liters)}) exceeds tank capacity (${formatFuelLiters(cap)}).`);
      return;
    }
    setSaving(true);
    try {
      await recordFuelTankDip({
        fuelTypeId,
        dipCm,
        recordedBy: profile?.name,
        notes: notes.trim() || undefined,
      });
      setDipInput('');
      setNotes('');
      await load();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Failed to save dip');
    } finally {
      setSaving(false);
    }
  }

  const accent = item ? fuelStockHealthColor(item.health, theme) : theme.palette.primary.main;

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
        <Button
          component={RouterLink}
          to="/manager"
          startIcon={<ArrowBackOutlinedIcon />}
          sx={{ mb: 2, color: 'inherit', alignSelf: 'flex-start' }}
        >
          Back to dashboard
        </Button>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <HistoryOutlinedIcon sx={{ opacity: 0.95 }} />
          <Typography variant="overline" sx={{ opacity: 0.92, letterSpacing: '0.12em', fontWeight: 600 }}>
            Fuel stock
          </Typography>
        </Stack>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          {displayMeta.displayName}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.75, maxWidth: 560 }}>
          Dip reading history and tank utilization for this fuel type.
        </Typography>
      </Box>

      {err ? <Alert severity="error">{err}</Alert> : null}

      {loading ? (
        <Paper variant="outlined" sx={{ borderRadius: 2, py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={44} thickness={4} />
          <Typography color="text.secondary">Loading stock history…</Typography>
        </Paper>
      ) : item ? (
        <>
          <Card elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
            <Box sx={{ height: 3, bgcolor: accent }} />
            <CardContent sx={{ pt: 2.5, pb: 2.5 }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Dip reading
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {item.currentDipCm != null ? formatDipCm(item.currentDipCm) : '—'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Current stock
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {formatFuelLiters(item.currentStockLiters)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Tank capacity
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {formatFuelLiters(item.tankCapacityLiters)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {fuelStockHealthEmoji(item.health)} {fuelStockHealthLabel(item.health)}
                    </Typography>
                  </Box>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={item.availablePercent}
                  sx={{
                    height: 12,
                    borderRadius: 999,
                    bgcolor: (t) => alpha(t.palette.divider, 0.35),
                    '& .MuiLinearProgress-bar': { borderRadius: 999, bgcolor: accent, transition: 'transform 0.6s ease' },
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  Available: {formatFuelPercent(item.availablePercent)} · Reserve: {formatFuelLiters(item.reserveLiters)}
                  {item.lastDipAt ? ` · Last dip: ${format(item.lastDipAt.toDate(), 'dd MMM yyyy, h:mm a')}` : ''}
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
              Record dip reading
            </Typography>
            {formErr ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formErr}
              </Alert>
            ) : null}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720, lineHeight: 1.7 }}>
              Enter the physical dip-stick reading in centimetres (e.g. 96.6). Stock in liters is calculated
              automatically from your tank calibration chart.
            </Typography>
            {previewLiters != null ? (
              <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                Dip {formatDipCm(Number(dipInput))} → calculated stock{' '}
                <strong>{formatFuelLiters(previewLiters)}</strong>
              </Alert>
            ) : null}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-start' }}>
              <TextField
                label="Dip reading (cm)"
                type="number"
                value={dipInput}
                onChange={(e) => setDipInput(e.target.value)}
                size="small"
                sx={{ minWidth: 160 }}
                slotProps={{ htmlInput: { step: '0.1', min: 0 } }}
              />
              <TextField
                label="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                size="small"
                sx={{ flex: 1, minWidth: 200 }}
              />
              <Button
                variant="contained"
                startIcon={<SaveOutlinedIcon />}
                disabled={saving}
                onClick={() => void handleSaveDip()}
                sx={{ borderRadius: 2, flexShrink: 0 }}
              >
                {saving ? 'Saving…' : 'Save dip'}
              </Button>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ px: 2.5, py: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Dip history
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={headSx}>Date & time</TableCell>
                    <TableCell sx={headSx} align="right">Dip (cm)</TableCell>
                    <TableCell sx={headSx} align="right">Stock (L)</TableCell>
                    <TableCell sx={headSx}>Recorded by</TableCell>
                    <TableCell sx={headSx}>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          No dip readings recorded yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    dips.map((d) => (
                      <TableRow key={d.id} hover>
                        <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {format(d.recordedAt.toDate(), 'dd MMM yyyy, h:mm a')}
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                          {formatDipCm(d.dipCm)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                          {d.dipLiters.toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell>{d.recordedBy ?? '—'}</TableCell>
                        <TableCell>{d.notes ?? '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      ) : (
        <Alert severity="info">No tank configuration found for this fuel type.</Alert>
      )}
    </Stack>
  );
}
