import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  alpha,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import { useShiftAccess } from '@/hooks/useShiftAccess';
import { listReadingsForShift, updateReadingsOnEnd, computeLiters, getLastClosingForNozzle, getMachineLabelForShift } from '@/services/shiftReadingsService';
import { getNozzle } from '@/services/nozzlesService';
import { getFuelType } from '@/services/fuelTypesService';
import { setShiftReadingsComplete } from '@/services/shiftsService';
import { requireMin } from '@/utils/validation';
import type { ShiftReading } from '@/types/entities';

type Row = ShiftReading & { fuelName: string; rate: number; nozzleLabel: string };

const meterHeadCellSx = {
  fontWeight: 700,
  fontSize: '0.72rem',
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  bgcolor: 'action.hover',
  color: 'text.secondary',
  borderBottom: '1px solid',
  borderColor: 'divider',
};

export function EndMetersPage() {
  const { shiftId = '' } = useParams();
  const nav = useNavigate();
  const { shift, allowed, error: accessError } = useShiftAccess(shiftId);
  const [rows, setRows] = useState<Row[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [closeInputs, setCloseInputs] = useState<Record<string, string>>({});
  const [openInputs, setOpenInputs] = useState<Record<string, string>>({});
  const [testInputs, setTestInputs] = useState<Record<string, string>>({});
  const [machineLabel, setMachineLabel] = useState('—');

  /**
   * Primitives-only dependency: shift object identity alone must not rerun the load effect
   * (would reset closing inputs mid-typing). Includes distinct keys for loading vs open shift
   * so we still run once when shift resolves from undefined.
   */
  const readingsCompleteKey =
    shift === undefined
      ? 'loading'
      : shift === null
        ? 'none'
        : shift.readingsCompleteAt?.toMillis?.() ?? 'open';

  useEffect(() => {
    if (!shiftId || !shift || !allowed) {
      return;
    }
    let ok = true;
    (async () => {
      setLoadErr(null);
      try {
        const readings = await listReadingsForShift(shiftId);
        const built: Row[] = [];
        for (const r of readings) {
          const n = await getNozzle(r.nozzleId);
          const ft = n ? await getFuelType(n.fuelTypeId) : null;
          built.push({
            ...r,
            fuelName: ft?.name ?? '—',
            rate: ft?.currentRate ?? 0,
            nozzleLabel: n ? `M${n.machineNumber} / N${n.nozzleNumber}` : '—',
          });
          if (!ok) {
            return;
          }
        }
        const readingsLocked = Boolean(shift.readingsCompleteAt);
        const carryOpens = readingsLocked
          ? null
          : await Promise.all(built.map((r) => getLastClosingForNozzle(r.nozzleId)));
        if (!ok) {
          return;
        }
        setRows(built);
        setMachineLabel(await getMachineLabelForShift(shiftId));

        if (readingsLocked) {
          const ci: Record<string, string> = {};
          const oi: Record<string, string> = {};
          const ti: Record<string, string> = {};
          for (let i = 0; i < built.length; i++) {
            const r = built[i];
            ci[r.id] = String(r.closingReading);
            oi[r.id] = String(r.openingReading);
            ti[r.id] = String(r.testLiters);
          }
          setCloseInputs(ci);
          setOpenInputs(oi);
          setTestInputs(ti);
        } else {
          setCloseInputs((prev) => {
            const next = { ...prev };
            for (let i = 0; i < built.length; i++) {
              const r = built[i];
              if (!(r.id in next)) {
                next[r.id] = '';
              }
            }
            return next;
          });
          setOpenInputs((prev) => {
            const next = { ...prev };
            for (let i = 0; i < built.length; i++) {
              const r = built[i];
              if (!(r.id in next)) {
                const carried = carryOpens?.[i] ?? 0;
                const openingValue = carried > 0 ? carried : r.openingReading;
                next[r.id] = String(openingValue);
              }
            }
            return next;
          });
          setTestInputs((prev) => {
            const next = { ...prev };
            for (const r of built) {
              if (!(r.id in next)) {
                next[r.id] = String(r.testLiters);
              }
            }
            return next;
          });
        }
      } catch (e) {
        if (ok) {
          setLoadErr(e instanceof Error ? e.message : 'Load failed');
        }
      }
    })();
    return () => {
      ok = false;
    };
  }, [shiftId, allowed, readingsCompleteKey]);

  if (accessError) {
    return <Alert severity="error">{accessError}</Alert>;
  }
  if (shift === undefined) {
    return (
      <Paper variant="outlined" sx={{ borderRadius: 2, py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <CircularProgress size={44} thickness={4} />
        <Typography color="text.secondary">Loading shift…</Typography>
      </Paper>
    );
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

  async function handleSave() {
    setFormError(null);
    const updates: {
      id: string;
      openingReading: number;
      closingReading: number;
      testLiters: number;
      totalLiters: number;
      finalSalesLiters: number;
      rateAtSale: number;
      totalAmount: number;
    }[] = [];
    for (const r of rows) {
      const oStr = openInputs[r.id] ?? '0';
      const cStr = closeInputs[r.id] ?? '0';
      const tStr = testInputs[r.id] ?? '0';
      const eo = requireMin(oStr, 0, 'Opening reading');
      const e1 = requireMin(cStr, 0, 'Closing reading');
      const e2 = requireMin(tStr, 0, 'Test liters');
      if (eo || e1 || e2) {
        setFormError(eo || e1 || e2 || null);
        return;
      }
      const o = Number(oStr);
      const c = Number(cStr);
      const t = Number(tStr);
      if (c < o) {
        setFormError(`Closing must be ≥ opening (${r.nozzleLabel}).`);
        return;
      }
      const { totalLiters, finalSalesLiters } = computeLiters(o, c, t);
      const rate = r.rate;
      const totalAmount = finalSalesLiters * rate;
      updates.push({
        id: r.id,
        openingReading: o,
        closingReading: c,
        testLiters: t,
        totalLiters,
        finalSalesLiters,
        rateAtSale: rate,
        totalAmount,
      });
    }
    setSaving(true);
    try {
      await updateReadingsOnEnd(updates);
      await setShiftReadingsComplete(shiftId);
      nav(`/shifts/${shiftId}/reconcile`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const totalSales = rows.reduce((acc, r) => {
    const o = Number(openInputs[r.id] ?? 0);
    const c = Number(closeInputs[r.id] ?? 0);
    const t = Number(testInputs[r.id] ?? 0);
    if (c < o) {
      return acc;
    }
    const { finalSalesLiters } = computeLiters(o, c, t);
    return acc + finalSalesLiters * r.rate;
  }, 0);

  return (
    <Stack spacing={3} sx={{ pb: 3 }}>
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
          <SpeedOutlinedIcon sx={{ opacity: 0.95 }} />
          <Typography variant="overline" sx={{ opacity: 0.92, letterSpacing: '0.12em', fontWeight: 600 }}>
            Meter close
          </Typography>
        </Stack>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          End-of-shift readings
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.75, maxWidth: 640 }}>
          Enter closing and test (TAST) per nozzle. Sales litres and ₹ update from your entries and current fuel prices.
        </Typography>
      </Box>

      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: (t) => `0 8px 28px ${alpha(t.palette.common.black, t.palette.mode === 'dark' ? 0.2 : 0.06)}`,
        }}
      >
      {shift?.pumpAttendants?.trim() ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Pump attendants: <strong>{shift.pumpAttendants.trim()}</strong>
        </Typography>
      ) : null}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Machine: <strong>{machineLabel}</strong>
      </Typography>
      {!shift.readingsCompleteAt && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          <strong>Opening</strong> carries from the latest saved closing. <strong>Closing</strong> is empty until you type
          it.
        </Typography>
      )}
      <TableContainer sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={meterHeadCellSx}>Machine / Nozzle</TableCell>
              <TableCell sx={meterHeadCellSx}>Fuel</TableCell>
              <TableCell sx={meterHeadCellSx} align="right">
                Opening
              </TableCell>
              <TableCell sx={meterHeadCellSx} align="right">
                Closing
              </TableCell>
              <TableCell sx={meterHeadCellSx} align="right">
                Test (TAST)
              </TableCell>
              <TableCell sx={meterHeadCellSx} align="right">
                Sales L
              </TableCell>
              <TableCell sx={meterHeadCellSx} align="right">
                ₹/L
              </TableCell>
              <TableCell sx={meterHeadCellSx} align="right">
                Row ₹
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, idx) => {
              const o = Number(openInputs[r.id] ?? 0);
              const c = Number(closeInputs[r.id] ?? 0);
              const t = Number(testInputs[r.id] ?? 0);
              const { finalSalesLiters } = computeLiters(o, c, t);
              const rowAmt = finalSalesLiters * r.rate;
              const stripe = idx % 2 === 1;
              return (
                <TableRow
                  key={r.id}
                  sx={{
                    bgcolor: stripe ? (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.08 : 0.04) : 'transparent',
                  }}
                >
                  <TableCell>{r.nozzleLabel}</TableCell>
                  <TableCell>{r.fuelName}</TableCell>
                  <TableCell align="right" sx={{ minWidth: 100 }}>
                    <TextField
                      type="number"
                      size="small"
                      value={openInputs[r.id] ?? ''}
                      onChange={(e) => setOpenInputs((p) => ({ ...p, [r.id]: e.target.value }))}
                      inputProps={{ min: 0, step: 'any' }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ minWidth: 100 }}>
                    <TextField
                      type="text"
                      inputMode="decimal"
                      size="small"
                      value={closeInputs[r.id] ?? ''}
                      onChange={(e) => setCloseInputs((p) => ({ ...p, [r.id]: e.target.value }))}
                      placeholder="Enter closing"
                      slotProps={{
                        htmlInput: {
                          'aria-label': `${r.nozzleLabel} closing reading`,
                          min: 0,
                          step: 'any',
                          autoComplete: 'off',
                        },
                      }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ minWidth: 100 }}>
                    <TextField
                      type="number"
                      size="small"
                      value={testInputs[r.id] ?? ''}
                      onChange={(e) => setTestInputs((p) => ({ ...p, [r.id]: e.target.value }))}
                      inputProps={{ min: 0, step: 'any' }}
                    />
                  </TableCell>
                  <TableCell align="right">{finalSalesLiters.toFixed(3)}</TableCell>
                  <TableCell align="right">{r.rate.toFixed(2)}</TableCell>
                  <TableCell align="right">₹ {rowAmt.toFixed(2)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Paper variant="outlined" sx={{ mt: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Preview meter sales total
          </Typography>
          <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums', mt: 0.5 }}>
            ₹ {totalSales.toFixed(2)}
          </Typography>
        </Box>
      </Paper>
      {formError && <Alert severity="error" sx={{ mt: 2 }}>{formError}</Alert>}
      <Stack direction="row" spacing={2} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button variant="contained" size="large" onClick={() => void handleSave()} disabled={saving || rows.length === 0} sx={{ borderRadius: 1.5 }}>
          {saving ? 'Saving…' : 'Save & go to reconciliation'}
        </Button>
        <Button variant="outlined" onClick={() => nav(-1)} sx={{ borderRadius: 1.5 }}>
          Back
        </Button>
      </Stack>
    </Paper>
    </Stack>
  );
}
