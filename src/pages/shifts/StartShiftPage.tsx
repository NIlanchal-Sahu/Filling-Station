import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  alpha,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Chip,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { PageHeader } from '@/components/ui/PageHeader';
import { StaffAvatar } from '@/components/ui/StaffAvatar';
import { MotionButton } from '@/components/motion/MotionButton';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { listNozzles } from '@/services/nozzlesService';
import { getLastClosingForNozzle, createInitialReadings } from '@/services/shiftReadingsService';
import { createShift } from '@/services/shiftsService';
import { listActiveUsers } from '@/services/usersService';
import { SHIFT_LABELS, type Nozzle, type User } from '@/types/entities';
import { compareNozzleOrder } from '@/utils/nozzleSort';
import { formatMachineLabelFromNozzleSelection } from '@/utils/machineDisplay';
import {
  assertEntryDateAllowed,
  clampEntryDateForRole,
  dateInputBoundsForRole,
  parsePumpDayParam,
  recalledAdminPumpDay,
  todayIso,
} from '@/utils/dateEntryPolicy';
import { isPumpRosterUser } from '@/utils/roles';
import { pairAttendantsToMachines, uniqueMachineNumbersFromNozzles } from '@/utils/attendantPosts';
import { joinAttendantNames, shiftOptionLabel } from '@/utils/shiftStatusDisplay';

export function StartShiftPage() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const dateBounds = dateInputBoundsForRole(profile?.role);

  const [nozzles, setNozzles] = useState<Nozzle[]>([]);
  const [calendarDate, setCalendarDate] = useState(() => todayIso());
  const [shiftLabel, setShiftLabel] = useState<string>(SHIFT_LABELS[0]);
  const [roster, setRoster] = useState<User[]>([]);
  const [selectedAttendants, setSelectedAttendants] = useState<User[]>([]);
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickerMachine, setPickerMachine] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const preselectedRef = useRef(false);

  useEffect(() => {
    if (!profile) {
      return;
    }
    let ok = true;
    (async () => {
      setLoading(true);
      try {
        const [nz, users] = await Promise.all([listNozzles(true), listActiveUsers()]);
        if (!ok) {
          return;
        }
        setNozzles(nz);
        setRoster(
          users
            .filter(isPumpRosterUser)
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      } catch (e) {
        if (ok) {
          setLoadErr(e instanceof Error ? e.message : 'Failed to load data');
        }
      } finally {
        if (ok) {
          setLoading(false);
        }
      }
    })();
    return () => {
      ok = false;
    };
  }, [profile]);

  useEffect(() => {
    if (preselectedRef.current || !profile || roster.length === 0) {
      return;
    }
    if (profile.role !== 'operator') {
      preselectedRef.current = true;
      return;
    }
    const me = roster.find((u) => u.id === profile.id);
    if (me) {
      setSelectedAttendants([me]);
    }
    preselectedRef.current = true;
  }, [profile, roster]);

  useEffect(() => {
    const fromUrl = parsePumpDayParam(searchParams.get('day'));
    const recalled = profile?.role === 'admin' ? recalledAdminPumpDay() : null;
    const raw = fromUrl ?? recalled;
    if (!raw) {
      return;
    }
    setCalendarDate(clampEntryDateForRole(profile?.role, raw));
  }, [searchParams, profile?.role]);

  function toggleNozzle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const selectedMachineLabel = useMemo(
    () => formatMachineLabelFromNozzleSelection(selected, nozzles),
    [selected, nozzles],
  );

  const machineNumbers = useMemo(() => {
    const nums = [...new Set(nozzles.map((n) => n.machineNumber.trim()).filter(Boolean))];
    nums.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return nums;
  }, [nozzles]);

  const nozzlesForPickerMachine = useMemo(() => {
    if (!pickerMachine) {
      return [];
    }
    return nozzles
      .filter((n) => n.machineNumber.trim() === pickerMachine)
      .sort(compareNozzleOrder);
  }, [nozzles, pickerMachine]);

  function selectedCountForMachine(machineNumber: string): number {
    return nozzles.filter((n) => n.machineNumber.trim() === machineNumber && selected.has(n.id)).length;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!profile) {
      return;
    }
    if (selected.size === 0) {
      setFormError('Select at least one nozzle.');
      return;
    }
    setSaving(true);
    try {
      const day = clampEntryDateForRole(profile?.role, calendarDate);
      assertEntryDateAllowed(profile?.role, day);
      const oid = profile.id;
      const pt = joinAttendantNames(selectedAttendants.map((u) => u.name));
      const attendantPosts = pairAttendantsToMachines(
        selectedAttendants.map((u) => u.name),
        uniqueMachineNumbersFromNozzles(selected, nozzles),
      );
      const shiftId = await createShift({
        operatorId: oid,
        shiftLabel,
        calendarDate: day,
        notes: notes || undefined,
        pumpAttendants: pt || undefined,
        attendantPosts: attendantPosts.length > 0 ? attendantPosts : undefined,
      });
      const nozzleIds = Array.from(selected).sort((aId, bId) => {
        const a = nozzles.find((n) => n.id === aId);
        const b = nozzles.find((n) => n.id === bId);
        if (!a || !b) return 0;
        return compareNozzleOrder(a, b);
      });
      const opening: Record<string, number> = {};
      for (const nId of nozzleIds) {
        opening[nId] = await getLastClosingForNozzle(nId);
      }
      await createInitialReadings(shiftId, nozzleIds, opening);
      nav(`/shifts/${shiftId}/meters`, { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not start shift');
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return null;
  }

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ borderRadius: 2, py: 10, maxWidth: 560, mx: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <CircularProgress size={44} thickness={4} />
        <Typography color="text.secondary">Loading form…</Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={3} sx={{ pb: 3, maxWidth: 600 }}>
      <PageHeader title="Start shift" />

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
          boxShadow: (t) => `0 8px 32px ${alpha(t.palette.common.black, t.palette.mode === 'dark' ? 0.25 : 0.06)}`,
        }}
      >
        <Box sx={{ height: 3, bgcolor: 'primary.main', borderRadius: '2px 2px 0 0', mb: 2 }} />
      {loadErr && <Alert severity="error" sx={{ mb: 1 }}>{loadErr}</Alert>}

      <TextField
        fullWidth
        margin="normal"
        type="date"
        label="Shift date"
        value={calendarDate}
        onChange={(e) => setCalendarDate(clampEntryDateForRole(profile?.role, e.target.value))}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: { min: dateBounds.min, max: dateBounds.max },
        }}
      />

      <FormControl fullWidth margin="normal">
        <InputLabel id="sl-label">Shift</InputLabel>
        <Select
          labelId="sl-label"
          label="Shift"
          value={shiftLabel}
          onChange={(e) => {
            setShiftLabel(e.target.value as (typeof SHIFT_LABELS)[number]);
          }}
        >
          {SHIFT_LABELS.map((l) => (
            <MenuItem key={l} value={l}>
              {shiftOptionLabel(l)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Autocomplete
        multiple
        options={roster}
        value={selectedAttendants}
        onChange={(_, next) => setSelectedAttendants(next)}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        getOptionLabel={(u) => u.name}
        renderOption={(props, u) => {
          const { key, ...liProps } = props;
          return (
            <Box component="li" key={key ?? u.id} {...liProps}>
              <Stack direction="row" spacing={1} alignItems="center">
                <StaffAvatar name={u.name} photoUrl={u.photoUrl} size={28} />
                <Typography variant="body2">{u.name}</Typography>
              </Stack>
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            margin="normal"
            label="Pump attendants"
            placeholder={roster.length === 0 ? 'No active workers' : 'Select staff'}
            helperText="Optional. Staff are paired to selected machines for the attendant sheet."
          />
        )}
      />

      <TextField
        fullWidth
        margin="normal"
        label="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        multiline
        minRows={2}
      />

      <Typography variant="subtitle2" sx={{ mt: 2 }}>
        Assigned nozzles
      </Typography>
      {selected.size > 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Selected: <strong>{selectedMachineLabel}</strong>
        </Typography>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Choose a machine, then select nozzles for this shift.
        </Typography>
      )}

      {pickerMachine == null ? (
        <Stack spacing={1} sx={{ mt: 0.5 }}>
          {machineNumbers.map((machineNumber) => {
            const picked = selectedCountForMachine(machineNumber);
            return (
              <Button
                key={machineNumber}
                type="button"
                variant="outlined"
                fullWidth
                onClick={() => setPickerMachine(machineNumber)}
                sx={{
                  justifyContent: 'space-between',
                  textTransform: 'none',
                  fontWeight: 600,
                  py: 1.25,
                  borderRadius: 1.5,
                }}
              >
                Machine {machineNumber}
                {picked > 0 ? (
                  <Chip size="small" label={`${picked} nozzle${picked === 1 ? '' : 's'}`} color="primary" />
                ) : null}
              </Button>
            );
          })}
        </Stack>
      ) : (
        <Box sx={{ mt: 0.5 }}>
          <Button
            type="button"
            size="small"
            onClick={() => setPickerMachine(null)}
            sx={{ mb: 1, textTransform: 'none', fontWeight: 600, px: 0 }}
          >
            ← All machines
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Machine: <strong>Machine {pickerMachine}</strong>
          </Typography>
          <FormGroup>
            {nozzlesForPickerMachine.map((n) => (
              <FormControlLabel
                key={n.id}
                control={<Checkbox checked={selected.has(n.id)} onChange={() => toggleNozzle(n.id)} />}
                label={`M${n.machineNumber} N${n.nozzleNumber}`}
              />
            ))}
          </FormGroup>
        </Box>
      )}
      {formError && <Alert severity="error">{formError}</Alert>}
      <Stack direction="row" spacing={2} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
        <MotionButton type="submit" variant="contained" disabled={saving} size="large" sx={{ borderRadius: 1.5, minHeight: 48, width: { xs: '100%', sm: 'auto' } }}>
          {saving ? 'Saving…' : 'Start shift'}
        </MotionButton>
        <Button type="button" variant="outlined" onClick={() => nav(-1)} sx={{ borderRadius: 1.5 }}>
          Cancel
        </Button>
      </Stack>
    </Paper>
    </Stack>
  );
}
