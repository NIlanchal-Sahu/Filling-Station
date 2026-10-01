import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Grid2 as Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { saveStationAbout } from '@/services/stationAboutService';
import { useStationAbout } from '@/context/StationAboutContext';
import type { StationAboutProfile } from '@/utils/stationAboutDefaults';
import { formatStationAddress } from '@/utils/stationAboutDefaults';

type Props = {
  initial: StationAboutProfile;
  updatedBy: string;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

export function StationAboutEditor({ initial, updatedBy }: Props) {
  const { refresh } = useStationAbout();
  const [draft, setDraft] = useState<StationAboutProfile>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  function patch(fields: Partial<StationAboutProfile>) {
    setDraft((d) => ({ ...d, ...fields }));
  }

  async function handleSave() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await saveStationAbout(draft, updatedBy);
      await refresh();
      setMsg('Station profile saved. Sidebar and app branding will use these details.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  const addressPreview = formatStationAddress(draft);

  return (
    <Stack spacing={2.5}>
      {msg ? (
        <Alert severity="success" onClose={() => setMsg(null)}>
          {msg}
        </Alert>
      ) : null}
      {err ? (
        <Alert severity="error" onClose={() => setErr(null)}>
          {err}
        </Alert>
      ) : null}

      <Section title="Branding (shown in sidebar)">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Station / business name"
              value={draft.displayName}
              onChange={(e) => patch({ displayName: e.target.value })}
              fullWidth
              required
              helperText="Appears at the top of the navigation sidebar."
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Tagline"
              value={draft.tagline}
              onChange={(e) => patch({ tagline: e.target.value })}
              fullWidth
              helperText='Short line under the name, e.g. "Filling station ops".'
            />
          </Grid>
        </Grid>
      </Section>

      <Section title="Address">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Address line 1"
              value={draft.addressLine1}
              onChange={(e) => patch({ addressLine1: e.target.value })}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Address line 2"
              value={draft.addressLine2}
              onChange={(e) => patch({ addressLine2: e.target.value })}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="City" value={draft.city} onChange={(e) => patch({ city: e.target.value })} fullWidth />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="State" value={draft.state} onChange={(e) => patch({ state: e.target.value })} fullWidth />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="PIN / postal code"
              value={draft.pincode}
              onChange={(e) => patch({ pincode: e.target.value })}
              fullWidth
            />
          </Grid>
        </Grid>
      </Section>

      <Section title="Contact">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Primary phone"
              value={draft.phone}
              onChange={(e) => patch({ phone: e.target.value })}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Alternate phone"
              value={draft.alternatePhone}
              onChange={(e) => patch({ alternatePhone: e.target.value })}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Email"
              type="email"
              value={draft.email}
              onChange={(e) => patch({ email: e.target.value })}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="WhatsApp"
              value={draft.whatsapp}
              onChange={(e) => patch({ whatsapp: e.target.value })}
              fullWidth
              helperText="Include country code if needed."
            />
          </Grid>
        </Grid>
      </Section>

      <Section title="Hours & registration">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Operating hours"
              value={draft.operatingHours}
              onChange={(e) => patch({ operatingHours: e.target.value })}
              fullWidth
              multiline
              minRows={2}
              placeholder="e.g. Open 24 hours · Mon–Sun"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="GSTIN"
              value={draft.gstin}
              onChange={(e) => patch({ gstin: e.target.value })}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="License / UCC number"
              value={draft.licenseNumber}
              onChange={(e) => patch({ licenseNumber: e.target.value })}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Website"
              value={draft.website}
              onChange={(e) => patch({ website: e.target.value })}
              fullWidth
              placeholder="https://"
            />
          </Grid>
        </Grid>
      </Section>

      <Section title="Additional notes">
        <TextField
          label="Notes"
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          fullWidth
          multiline
          minRows={3}
          placeholder="Any other information for staff or printed materials."
        />
      </Section>

      <Paper
        elevation={0}
        sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover' }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Preview — sidebar header
        </Typography>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
          {draft.displayName.trim() || 'PumpStock'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {draft.tagline.trim() || 'Filling station ops'}
        </Typography>
        {addressPreview || draft.phone || draft.operatingHours ? (
          <Box sx={{ mt: 1.5, typography: 'body2', color: 'text.secondary', whiteSpace: 'pre-line' }}>
            {[addressPreview, draft.phone && `Phone: ${draft.phone}`, draft.operatingHours].filter(Boolean).join('\n')}
          </Box>
        ) : null}
      </Paper>

      <Box>
        <Button
          variant="contained"
          startIcon={<SaveOutlinedIcon />}
          onClick={() => void handleSave()}
          disabled={saving || !draft.displayName.trim()}
        >
          {saving ? 'Saving…' : 'Save station profile'}
        </Button>
      </Box>
    </Stack>
  );
}
