import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';

import { LOCAL_DEMO } from '@/config/appMode';
import { useAuth } from '@/context/AuthContext';
import { listUsersForManager, upsertUser } from '@/services/usersService';
import type { User, UserRole } from '@/types/entities';
import { requireNonEmpty } from '@/utils/validation';
import { roleLabel } from '@/utils/roles';

function emptyForm(): { uid: string; name: string; role: UserRole; phone: string; isActive: boolean } {
  return { uid: '', name: '', role: 'operator', phone: '', isActive: true };
}

export function TeamPage() {
  const { profile } = useAuth();
  const canAssignAdmin = profile?.role === 'admin';
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listUsersForManager();
      setRows(list.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openAdd() {
    setDialogMode('add');
    setForm(emptyForm());
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(u: User) {
    setDialogMode('edit');
    setForm({
      uid: u.id,
      name: u.name,
      role: u.role,
      phone: u.phone ?? '',
      isActive: u.isActive,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    const nameErr = requireNonEmpty(form.name, 'Name');
    if (nameErr) {
      setFormError(nameErr);
      return;
    }

    let uid = form.uid.trim();
    if (dialogMode === 'add') {
      if (LOCAL_DEMO) {
        uid = `demo-staff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      } else {
        const uidErr = requireNonEmpty(uid, 'User ID (Firebase Auth UID)');
        if (uidErr) {
          setFormError(uidErr);
          return;
        }
      }
    }

    if (form.role === 'admin' && !canAssignAdmin) {
      setFormError('Only an owner (admin) can assign the Admin role.');
      return;
    }

    setSaving(true);
    try {
      await upsertUser(uid, {
        name: form.name.trim(),
        role: form.role,
        phone: form.phone.trim() || undefined,
        isActive: form.isActive,
      });
      setDialogOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <PeopleOutlineIcon color="primary" fontSize="large" />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Team
        </Typography>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
        {LOCAL_DEMO
          ? 'Demo mode: add or edit staff stored in this browser. In production, each row matches a Firebase Auth user id.'
          : 'Firestore profiles must use the same document id as Firebase Authentication (UID). Create the user in Firebase Console → Authentication, then link their profile here.'}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
        <Button variant="contained" onClick={openAdd} disabled={loading}>
          {LOCAL_DEMO ? 'Add user' : 'Link profile'}
        </Button>
      </Stack>

      {loading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : (
        <Table size="small" sx={{ maxWidth: 960, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>UID</TableCell>
              <TableCell align="right"> </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>{u.name}</TableCell>
                <TableCell>{roleLabel(u.role)}</TableCell>
                <TableCell>{u.phone ?? '—'}</TableCell>
                <TableCell>{u.isActive ? 'Yes' : 'No'}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, maxWidth: 200 }} title={u.id}>
                  {u.id.length > 24 ? `${u.id.slice(0, 12)}…${u.id.slice(-6)}` : u.id}
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => openEdit(u)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{dialogMode === 'add' ? (LOCAL_DEMO ? 'Add user' : 'Link Firestore profile') : 'Edit team member'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {dialogMode === 'edit' && (
              <TextField label="User ID" value={form.uid} disabled fullWidth size="small" />
            )}
            {dialogMode === 'add' && !LOCAL_DEMO && (
              <TextField
                label="Firebase Auth UID"
                value={form.uid}
                onChange={(e) => setForm((f) => ({ ...f, uid: e.target.value }))}
                helperText="Copy from Firebase Console → Authentication → Users"
                fullWidth
                required
                size="small"
              />
            )}
            <TextField
              label="Display name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
              required
              size="small"
            />
            <FormControl fullWidth size="small">
              <InputLabel id="team-role-label">Role</InputLabel>
              <Select
                labelId="team-role-label"
                label="Role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                disabled={form.role === 'admin' && !canAssignAdmin}
              >
                <MenuItem value="operator">Operator</MenuItem>
                <MenuItem value="manager">Manager</MenuItem>
                {(canAssignAdmin || form.role === 'admin') ? (
                  <MenuItem value="admin">Admin (owner)</MenuItem>
                ) : null}
              </Select>
            </FormControl>
            <TextField
              label="Phone (optional)"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              fullWidth
              size="small"
            />
            <FormControlLabel
              control={
                <Switch checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              }
              label="Active"
            />
            {formError && <Alert severity="error">{formError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
