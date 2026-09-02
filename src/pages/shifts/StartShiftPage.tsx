import { useEffect, useMemo, useState } from 'react';
import {
  alpha,
  Alert,
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
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { listNozzles } from '@/services/nozzlesService';
import { listActiveUsers, listUsersForManager } from '@/services/usersService';
import { getLastClosingForNozzle, createInitialReadings } from '@/services/shiftReadingsService';
import { createShift } from '@/services/shiftsService';
import { SHIFT_LABELS, type Nozzle, type User } from '@/types/entities';
import { compareNozzleOrder } from '@/utils/nozzleSort';
import { formatMachineLabelFromNozzleSelection } from '@/utils/machineDisplay';
import { requireNonEmpty } from '@/utils/validation';
import { isManagerLike, homePathForRole } from '@/utils/roles';
import {
  assertEntryDateAllowed,
  clampEntryDateForRole,
  dateInputBoundsForRole,
  todayIso,
} from '@/utils/dateEntryPolicy';

export function StartShiftPage() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const isManager = isManagerLike(profile?.role);
  const dateBounds = dateInputBoundsForRole(profile?.role);

  const [operators, setOperators] = useState<User[]>([]);
  const [nozzles, setNozzles] = useState<Nozzle[]>([]);
  const [operatorId, setOperatorId] = useState('');
  const [calendarDate, setCalendarDate] = useState(() => todayIso());
  const [shiftLabel, setShiftLabel] = useState<string>(SHIFT_LABELS[0]);
  /** Names of pump staff on duty — single field above the shift time selection. */
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
        const [oz, nz] = await Promise.all([
          isManager ? listUsersForManager() : listActiveUsers(),
          listNozzles(true),
        ]);
        if (!ok) {
          return;
        }
        const opOnly = (isManager ? oz : oz.filter((u) => u.role === 'operator')).filter(
          (u) => u.isActive,
        );
        setOperators(opOnly);
        setNozzles(nz);
        if (!isManager) {
          setOperatorId(profile.id);
        } else if (opOnly[0]) {
          setOperatorId(opOnly[0].id);
        }
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
  }, [profile, isManager]);

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
    const oErr = isManager ? requireNonEmpty(operatorId, 'Operator') : undefined;
    if (oErr) {
      setFormError(oErr);
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
      const oid = isManager ? operatorId : profile!.id;
      const pt = pumpAttendants.trim();
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
      nav(homePathForRole(profile?.role), { replace: true });
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
          <PlayCircleOutlineOutlinedIcon sx={{ opacity: 0.95 }} />
          <Typography variant="overline" sx={{ opacity: 0.92, letterSpacing: '0.12em', fontWeight: 600 }}>
            New shift
          </Typography>
        </Stack>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Start shift
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.75 }}>
          Pick calendar day, operator, nozzles on duty, and optional pump attendant names for the roster report.
        </Typography>
      </Box>

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

      {isManager && (
        <FormControl fullWidth margin="normal">
          <InputLabel id="op-label">Operator</InputLabel>
          <Select
            labelId="op-label"
            label="Operator"
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value as string)}
          >
            {operators.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.name} ({o.role})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

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
        helperText={
          isManager && profile?.role === 'admin'
            ? 'Owner can set a past business day to correct historical shifts.'
            : 'Business day this shift belongs to (today only for manager/operator).'
        }
      />

      <TextField
        fullWidth
        margin="normal"
        label="Pump attendants"
        placeholder="Names on pump duty (boys / girls) — optional"
        value={pumpAttendants}
        onChange={(e) => setPumpAttendants(e.target.value)}
        helperText="Names on dispenser duty. Separate several people with commas — dashboard splits that shift&apos;s sales equally for rewards."
      />

      <FormControl fullWidth margin="normal">
        <InputLabel id="sl-label">Shift</InputLabel>
        <Select
          labelId="sl-label"
          label="Shift"
          value={shiftLabel}
          onChange={(e) => setShiftLabel(e.target.value as (typeof SHIFT_LABELS)[number])}
        >
          {SHIFT_LABELS.map((l) => (
            <MenuItem key={l} value={l}>
              {l}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

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
        <Button type="submit" variant="contained" disabled={saving} size="large" sx={{ borderRadius: 1.5 }}>
          {saving ? 'Saving…' : 'Start shift'}
        </Button>
        <Button type="button" variant="outlined" onClick={() => nav(-1)} sx={{ borderRadius: 1.5 }}>
          Cancel
        </Button>
      </Stack>
    </Paper>
    </Stack>
  );
}
