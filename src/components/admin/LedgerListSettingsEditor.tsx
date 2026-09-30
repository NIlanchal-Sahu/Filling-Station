import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  countLedgerCategoryUsage,
  countLedgerTxnTypeUsage,
  saveLedgerListSettings,
} from '@/services/ledgerListSettingsService';
import {
  defaultLedgerListSettings,
  normalizeLedgerCategory,
  slugFromTxnTypeLabel,
  type LedgerListSettings,
} from '@/utils/ledgerListDefaults';

type Props = {
  initial: LedgerListSettings;
  updatedBy: string;
  onSaved?: (next: LedgerListSettings) => void;
  compact?: boolean;
};

export function LedgerListSettingsEditor({ initial, updatedBy, onSaved, compact }: Props) {
  const [draft, setDraft] = useState<LedgerListSettings>(initial);
  const [newCategory, setNewCategory] = useState('');
  const [newTxnLabel, setNewTxnLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  async function handleRemoveCategory(cat: string) {
    setErr(null);
    const n = await countLedgerCategoryUsage(cat);
    if (n > 0) {
      setErr(`Category "${cat}" is used on ${n} ledger entries. Remove or re-categorize those first.`);
      return;
    }
    setDraft((d) => ({ ...d, categories: d.categories.filter((c) => c !== cat) }));
  }

  async function handleRemoveTxn(id: string) {
    setErr(null);
    const n = await countLedgerTxnTypeUsage(id);
    if (n > 0) {
      setErr(`Txn type "${id}" is used on ${n} ledger entries. It will stay on old rows; cannot remove from list yet.`);
      return;
    }
    setDraft((d) => ({ ...d, txnTypes: d.txnTypes.filter((t) => t.id !== id) }));
  }

  function addCategory() {
    setErr(null);
    const c = normalizeLedgerCategory(newCategory);
    if (!c) {
      setErr('Enter a category name.');
      return;
    }
    if (draft.categories.includes(c)) {
      setErr('Category already exists.');
      return;
    }
    setDraft((d) => ({ ...d, categories: [...d.categories, c] }));
    setNewCategory('');
  }

  function addTxnType() {
    setErr(null);
    const label = newTxnLabel.trim().toUpperCase();
    if (!label) {
      setErr('Enter a txn type label.');
      return;
    }
    const id = slugFromTxnTypeLabel(label);
    if (draft.txnTypes.some((t) => t.id === id)) {
      setErr('Txn type already exists.');
      return;
    }
    setDraft((d) => ({ ...d, txnTypes: [...d.txnTypes, { id, label }] }));
    setNewTxnLabel('');
  }

  async function handleSave() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await saveLedgerListSettings(draft, updatedBy);
      setMsg('Lists saved.');
      onSaved?.(draft);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (!window.confirm('Reset categories and txn types to factory defaults?')) return;
    setDraft(defaultLedgerListSettings());
    setErr(null);
    setMsg(null);
  }

  return (
    <Stack spacing={2}>
      {err ? <Alert severity="error">{err}</Alert> : null}
      {msg ? <Alert severity="success">{msg}</Alert> : null}

      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Categories
        </Typography>
        <List dense disablePadding sx={{ mb: 1 }}>
          {draft.categories.map((c) => (
            <ListItem
              key={c}
              disableGutters
              secondaryAction={
                <IconButton edge="end" aria-label={`Remove ${c}`} onClick={() => void handleRemoveCategory(c)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemText primary={c} primaryTypographyProps={{ fontWeight: 600, variant: 'body2' }} />
            </ListItem>
          ))}
        </List>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            label="New category"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            fullWidth
          />
          <Button variant="outlined" onClick={addCategory} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
            Add
          </Button>
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Txn types
        </Typography>
        <List dense disablePadding sx={{ mb: 1 }}>
          {draft.txnTypes.map((t) => (
            <ListItem
              key={t.id}
              disableGutters
              secondaryAction={
                <IconButton edge="end" aria-label={`Remove ${t.label}`} onClick={() => void handleRemoveTxn(t.id)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemText
                primary={t.label}
                secondary={compact ? undefined : t.id}
                primaryTypographyProps={{ fontWeight: 600, variant: 'body2' }}
              />
            </ListItem>
          ))}
        </List>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            label="New txn type label"
            value={newTxnLabel}
            onChange={(e) => setNewTxnLabel(e.target.value)}
            fullWidth
          />
          <Button variant="outlined" onClick={addTxnType} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
            Add
          </Button>
        </Stack>
      </Box>

      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save lists'}
        </Button>
        <Button variant="text" color="inherit" onClick={handleReset} disabled={saving}>
          Reset to defaults
        </Button>
      </Stack>
    </Stack>
  );
}
