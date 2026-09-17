import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  alpha,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { PageHeader } from '@/components/ui/PageHeader';
import { MotionButton } from '@/components/motion/MotionButton';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { listNozzles } from '@/services/nozzlesService';
import { getLastClosingForNozzle, createInitialReadings } from '@/services/shiftReadingsService';
import { createShift } from '@/services/shiftsService';
import { SHIFT_LABELS, type Nozzle } from '@/types/entities';
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
import { attendantNameList, joinAttendantNames, shiftOptionLabel } from '@/utils/shiftStatusDisplay';

export function StartShiftPage() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const dateBounds = dateInputBoundsForRole(profile?.role);

  const [nozzles, setNozzles] = useState<Nozzle[]>([]);
  const [calendarDate, setCalendarDate] = useState(() => todayIso());
  const [shiftLabel, setShiftLabel] = useState<string>(SHIFT_LABELS[0]);
  const [pumpAttendants, setPumpAttendants] = useState('');
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }
    let ok = true;
    (async () => {
      setLoading(true);
      try {
        const nz = await listNozzles(true);
        if (!ok) {
          return;
        }
        setNozzles(nz);
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
      const pt = joinAttendantNames(attendantNameList(pumpAttendants));
      const shiftId = await createShift({
        operatorId: oid,
        shiftLabel,
        calendarDate: day,
        notes: notes || undefined,
        pumpAttendants: pt || undefined,
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

      <TextField
        fullWidth
        margin="normal"
        label="Pump attendants"
        value={pumpAttendants}
        onChange={(e) => setPumpAttendants(e.target.value)}
        placeholder="Priya, Ravi"
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
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Machine: <strong>{selectedMachineLabel}</strong>
      </Typography>
      <FormGroup>
        {nozzles.map((n) => (
          <FormControlLabel
            key={n.id}
            control={<Checkbox checked={selected.has(n.id)} onChange={() => toggleNozzle(n.id)} />}
            label={`M${n.machineNumber} N${n.nozzleNumber}`}
          />
        ))}
      </FormGroup>
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
