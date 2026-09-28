import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { PageHeader } from '@/components/ui/PageHeader';
import { listFuelTypes } from '@/services/fuelTypesService';
import {
  activeNozzleSlotTaken,
  createNozzle,
  deactivateNozzlesForMachine,
  listNozzles,
  setNozzleActive,
  updateNozzle,
} from '@/services/nozzlesService';
import type { FuelType, Nozzle } from '@/types/entities';
import { compareNozzleOrder } from '@/utils/nozzleSort';
import { fuelStockDisplayMeta } from '@/utils/fuelStockDisplay';

function fuelLabel(fuels: FuelType[], fuelTypeId: string): string {
  const f = fuels.find((x) => x.id === fuelTypeId);
  if (!f) return '—';
  const meta = fuelStockDisplayMeta(f.name);
  return meta.shortCode !== '—' ? `${f.name} (${meta.shortCode})` : f.name;
}

export function AdminPumpSetupPage() {
  const [nozzles, setNozzles] = useState<Nozzle[]>([]);
  const [fuels, setFuels] = useState<FuelType[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pickerMachine, setPickerMachine] = useState<string | null>(null);
  const [draftFuelByNozzle, setDraftFuelByNozzle] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const [addMachineOpen, setAddMachineOpen] = useState(false);
  const [newMachineNumber, setNewMachineNumber] = useState('');
  const [newNozzleCount, setNewNozzleCount] = useState('4');
  const [newDefaultFuelId, setNewDefaultFuelId] = useState('');

  const [addNozzleOpen, setAddNozzleOpen] = useState(false);
  const [newNozzleNumber, setNewNozzleNumber] = useState('');
  const [newNozzleFuelId, setNewNozzleFuelId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [nz, ft] = await Promise.all([listNozzles(true), listFuelTypes()]);
      setNozzles(nz);
      setFuels(ft);
      setDraftFuelByNozzle((prev) => {
        const next = { ...prev };
        for (const n of nz) {
          if (next[n.id] === undefined) {
            next[n.id] = n.fuelTypeId;
          }
        }
        return next;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load pump setup');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (fuels.length === 0) return;
    setNewDefaultFuelId((prev) => prev || fuels[0].id);
    setNewNozzleFuelId((prev) => prev || fuels[0].id);
  }, [fuels]);

  const machineNumbers = useMemo(() => {
    const nums = [...new Set(nozzles.map((n) => n.machineNumber.trim()).filter(Boolean))];
    nums.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return nums;
  }, [nozzles]);

  const nozzlesForMachine = useMemo(() => {
    if (!pickerMachine) return [];
    return nozzles
      .filter((n) => n.machineNumber.trim() === pickerMachine)
      .sort(compareNozzleOrder);
  }, [nozzles, pickerMachine]);

  async function saveNozzleFuel(n: Nozzle) {
    const fuelTypeId = draftFuelByNozzle[n.id];
    if (!fuelTypeId || fuelTypeId === n.fuelTypeId) return;
    setSavingId(n.id);
    setErr(null);
    try {
      await updateNozzle(n.id, { fuelTypeId });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not update nozzle');
    } finally {
      setSavingId(null);
    }
  }

  async function removeNozzle(n: Nozzle) {
    if (!window.confirm(`Remove nozzle M${n.machineNumber} N${n.nozzleNumber} from active setup?`)) {
      return;
    }
    setErr(null);
    try {
      await setNozzleActive(n.id, false);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not remove nozzle');
    }
  }

  async function removeMachine() {
    if (!pickerMachine) return;
    if (
      !window.confirm(
        `Remove Machine ${pickerMachine} and all its nozzles from active setup? Past shift readings are kept.`,
      )
    ) {
      return;
    }
    setErr(null);
    try {
      await deactivateNozzlesForMachine(pickerMachine);
      setPickerMachine(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not remove machine');
    }
  }

  async function handleAddMachine() {
    const machineNumber = newMachineNumber.trim();
    const count = Math.min(12, Math.max(1, parseInt(newNozzleCount, 10) || 1));
    const fuelTypeId = newDefaultFuelId || fuels[0]?.id;
    if (!machineNumber || !fuelTypeId) {
      setErr('Enter a machine number and select a fuel product.');
      return;
    }
    if (machineNumbers.includes(machineNumber)) {
      setErr('That machine number already exists.');
      return;
    }
    setErr(null);
    try {
      for (let i = 1; i <= count; i += 1) {
        const nozzleNumber = String(i);
        if (await activeNozzleSlotTaken(machineNumber, nozzleNumber)) {
          continue;
        }
        await createNozzle({ machineNumber, nozzleNumber, fuelTypeId });
      }
      setAddMachineOpen(false);
      setNewMachineNumber('');
      setPickerMachine(machineNumber);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add machine');
    }
  }

  async function handleAddNozzle() {
    if (!pickerMachine) return;
    const nozzleNumber = newNozzleNumber.trim();
    const fuelTypeId = newNozzleFuelId || fuels[0]?.id;
    if (!nozzleNumber || !fuelTypeId) {
      setErr('Enter a nozzle number and fuel product.');
      return;
    }
    if (await activeNozzleSlotTaken(pickerMachine, nozzleNumber)) {
      setErr('That nozzle slot is already in use on this machine.');
      return;
    }
    setErr(null);
    try {
      await createNozzle({
        machineNumber: pickerMachine,
        nozzleNumber,
        fuelTypeId,
      });
      setAddNozzleOpen(false);
      setNewNozzleNumber('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add nozzle');
    }
  }

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ borderRadius: 2, py: 8, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Paper>
    );
  }

  return (
    <Stack spacing={3} sx={{ pb: 4, maxWidth: 640 }}>
      <PageHeader title="Pump setup" subtitle="Machines, nozzles, and fuel assignment" />

      <Alert severity="info" icon={<LocalGasStationOutlinedIcon fontSize="inherit" />}>
        To add or rename fuel products and change rates, use{' '}
        <Button
          component={RouterLink}
          to="/manager/fuel"
          size="small"
          endIcon={<OpenInNewOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{ textTransform: 'none', fontWeight: 600, verticalAlign: 'baseline', p: 0, minWidth: 0 }}
        >
          Fuel prices
        </Button>
        .
      </Alert>

      {err ? <Alert severity="error">{err}</Alert> : null}

      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Dispenser machines
          </Typography>
          <Button
            size="small"
            startIcon={<AddOutlinedIcon />}
            onClick={() => setAddMachineOpen(true)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Add machine
          </Button>
        </Stack>

        {pickerMachine == null ? (
          <Stack spacing={1}>
            {machineNumbers.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No machines yet. Add a machine to create nozzles.
              </Typography>
            ) : (
              machineNumbers.map((m) => (
                <Button
                  key={m}
                  variant="outlined"
                  fullWidth
                  onClick={() => setPickerMachine(m)}
                  sx={{
                    justifyContent: 'space-between',
                    textTransform: 'none',
                    fontWeight: 600,
                    py: 1.25,
                    borderRadius: 1.5,
                  }}
                >
                  Machine {m}
                  <Chip
                    size="small"
                    label={`${nozzles.filter((n) => n.machineNumber.trim() === m).length} nozzles`}
                  />
                </Button>
              ))
            )}
          </Stack>
        ) : (
          <Box>
            <Button
              size="small"
              onClick={() => setPickerMachine(null)}
              sx={{ mb: 1, textTransform: 'none', fontWeight: 600, px: 0 }}
            >
              ← All machines
            </Button>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                Machine {pickerMachine}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  startIcon={<AddOutlinedIcon />}
                  onClick={() => setAddNozzleOpen(true)}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Add nozzle
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteOutlineOutlinedIcon />}
                  onClick={() => void removeMachine()}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Remove machine
                </Button>
              </Stack>
            </Stack>

            <Stack spacing={2}>
              {nozzlesForMachine.map((n) => (
                <Paper key={n.id} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                    M{n.machineNumber} N{n.nozzleNumber}
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-end' }}>
                    <FormControl fullWidth size="small">
                      <InputLabel id={`fuel-${n.id}`}>Fuel product</InputLabel>
                      <Select
                        labelId={`fuel-${n.id}`}
                        label="Fuel product"
                        value={draftFuelByNozzle[n.id] ?? n.fuelTypeId}
                        onChange={(e) =>
                          setDraftFuelByNozzle((prev) => ({ ...prev, [n.id]: e.target.value }))
                        }
                      >
                        {fuels.map((f) => (
                          <MenuItem key={f.id} value={f.id}>
                            {fuelLabel(fuels, f.id)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={savingId === n.id || draftFuelByNozzle[n.id] === n.fuelTypeId}
                      onClick={() => void saveNozzleFuel(n)}
                      sx={{ textTransform: 'none', fontWeight: 600, minHeight: 40, flexShrink: 0 }}
                    >
                      {savingId === n.id ? 'Saving…' : 'Save'}
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => void removeNozzle(n)}
                      sx={{ textTransform: 'none', fontWeight: 600, minHeight: 40, flexShrink: 0 }}
                    >
                      Remove
                    </Button>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Box>
        )}
      </Paper>

      <Dialog open={addMachineOpen} onClose={() => setAddMachineOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add machine</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Machine number"
              placeholder="e.g. 4"
              value={newMachineNumber}
              onChange={(e) => setNewMachineNumber(e.target.value)}
              fullWidth
              helperText="Shown as Machine 4 on Start shift."
            />
            <TextField
              label="Nozzles to create"
              type="number"
              inputProps={{ min: 1, max: 12 }}
              value={newNozzleCount}
              onChange={(e) => setNewNozzleCount(e.target.value)}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="new-machine-fuel">Default fuel per nozzle</InputLabel>
              <Select
                labelId="new-machine-fuel"
                label="Default fuel per nozzle"
                value={newDefaultFuelId}
                onChange={(e) => setNewDefaultFuelId(e.target.value)}
              >
                {fuels.map((f) => (
                  <MenuItem key={f.id} value={f.id}>
                    {fuelLabel(fuels, f.id)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddMachineOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleAddMachine()}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addNozzleOpen} onClose={() => setAddNozzleOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add nozzle</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Nozzle number"
              placeholder="e.g. 5"
              value={newNozzleNumber}
              onChange={(e) => setNewNozzleNumber(e.target.value)}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="new-nozzle-fuel">Fuel product</InputLabel>
              <Select
                labelId="new-nozzle-fuel"
                label="Fuel product"
                value={newNozzleFuelId}
                onChange={(e) => setNewNozzleFuelId(e.target.value)}
              >
                {fuels.map((f) => (
                  <MenuItem key={f.id} value={f.id}>
                    {fuelLabel(fuels, f.id)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddNozzleOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleAddNozzle()}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
