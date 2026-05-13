import { useEffect, useState } from 'react';
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
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
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';
import { listFuelTypes, updateFuelRate, createFuelType } from '@/services/fuelTypesService';
import { format } from 'date-fns';
import type { FuelType } from '@/types/entities';
import { requireMin, requireNonEmpty } from '@/utils/validation';

const headSx = {
  fontWeight: 700,
  fontSize: '0.72rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  bgcolor: 'action.hover',
  color: 'text.secondary',
  borderBottom: '1px solid',
  borderColor: 'divider',
};

export function FuelPricesPage() {
  const [rows, setRows] = useState<FuelType[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newRate, setNewRate] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);

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
            Manager setup
          </Typography>
        </Stack>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Fuel prices
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.75, maxWidth: 560 }}>
          Rates here drive meter ₹ amounts, reconciliation, and manual credit litre lines. Update before each price change at
          the pump.
        </Typography>
      </Box>

      {err && <Alert severity="error">{err}</Alert>}

      {loading ? (
        <Paper variant="outlined" sx={{ borderRadius: 2, py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={44} thickness={4} />
          <Typography color="text.secondary">Loading fuel types…</Typography>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Box
            sx={{
              px: 2,
              py: 1.5,
              bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.12 : 0.06),
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Current rates (₹/L)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Save per row. “Updated” reflects the server timestamp when the rate changed.
            </Typography>
          </Box>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ maxWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={headSx}>Fuel</TableCell>
                  <TableCell sx={headSx} align="right">
                    ₹/L
                  </TableCell>
                  <TableCell sx={headSx}>Updated</TableCell>
                  <TableCell sx={{ ...headSx, width: 100 }} align="center">
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((f, idx) => (
                  <FuelRow
                    key={f.id}
                    stripe={idx % 2 === 1}
                    f={f}
                    busy={saving === f.id}
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
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

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
                Use for new grades (e.g. XP) — appears on Start shift nozzle assignment and reconciliation.
              </Typography>
            </Box>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-start' }}>
            <TextField
              size="small"
              label="Fuel name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
            <TextField
              size="small"
              label="₹ per litre"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              type="number"
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
              disabled={saving === 'new'}
              sx={{ borderRadius: 1.5, px: 3 }}
            >
              Add fuel
            </Button>
          </Stack>
          {formErr ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {formErr}
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </Stack>
  );
}

function FuelRow({
  f,
  stripe,
  onSave,
  busy,
}: {
  f: FuelType;
  stripe: boolean;
  onSave: (r: string) => void;
  busy: boolean;
}) {
  const [r, setR] = useState(String(f.currentRate));
  return (
    <TableRow sx={{ bgcolor: stripe ? (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.08 : 0.04) : 'transparent' }}>
      <TableCell sx={{ fontWeight: 700, py: 1.5 }}>{f.name}</TableCell>
      <TableCell align="right">
        <TextField
          type="number"
          size="small"
          value={r}
          onChange={(e) => setR(e.target.value)}
          sx={{ width: 120, '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
        />
      </TableCell>
      <TableCell sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
        {f.lastUpdatedAt ? format(f.lastUpdatedAt.toDate(), 'dd MMM yy HH:mm') : '—'}
      </TableCell>
      <TableCell align="center">
        <Button size="small" variant="contained" disabled={busy} onClick={() => onSave(r)} sx={{ borderRadius: 1.25 }}>
          {busy ? '…' : 'Save'}
        </Button>
      </TableCell>
    </TableRow>
  );
}
