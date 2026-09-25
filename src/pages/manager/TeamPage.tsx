import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import { PageHeader } from '@/components/ui/PageHeader';
import { ResponsiveTableContainer } from '@/components/ui/ResponsiveTableContainer';
import { StaffAvatar } from '@/components/ui/StaffAvatar';
import { LOCAL_DEMO } from '@/config/appMode';
import { useAuth } from '@/context/AuthContext';
import { listUsersForManager, persistStaffPhoto, upsertUser } from '@/services/usersService';
import type { User, UserRole } from '@/types/entities';
import { compressStaffPhoto } from '@/utils/staffPhoto';
import { optionalEmail, requireNonEmpty } from '@/utils/validation';
import { roleLabel } from '@/utils/roles';

type TeamForm = {
  uid: string;
  name: string;
  role: UserRole;
  phone: string;
  email: string;
  address: string;
  photoUrl: string;
  photoDirty: boolean;
  isActive: boolean;
};

function emptyForm(role: UserRole = 'operator'): TeamForm {
  return {
    uid: '',
    name: '',
    role,
    phone: '',
    email: '',
    address: '',
    photoUrl: '',
    photoDirty: false,
    isActive: true,
  };
}

function shortText(value: string | undefined, max = 28): string {
  if (!value?.trim()) {
    return '—';
  }
  const t = value.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function TeamPage() {
  const { profile, refreshProfile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isManager = profile?.role === 'manager';
  const canManageTeam = isAdmin || isManager;
  const canAssignRoles = isAdmin;
  const canAssignAdmin = isAdmin;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [form, setForm] = useState<TeamForm>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canEditUser = useCallback(
    (u: User) => {
      if (isAdmin) {
        return true;
      }
      return isManager && u.role === 'operator';
    },
    [isAdmin, isManager],
  );

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
    setForm(emptyForm('operator'));
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
      email: u.email ?? '',
      address: u.address ?? '',
      photoUrl: u.photoUrl ?? '',
      photoDirty: false,
      isActive: u.isActive,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handlePhotoSelected(file: File | undefined) {
    if (!file) {
      return;
    }
    setFormError(null);
    try {
      const dataUrl = await compressStaffPhoto(file);
      setForm((f) => ({ ...f, photoUrl: dataUrl, photoDirty: true }));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not process photo');
    }
  }

  async function handleSave() {
    setFormError(null);
    const nameErr = requireNonEmpty(form.name, 'Name');
    if (nameErr) {
      setFormError(nameErr);
      return;
    }
    const emailErr = optionalEmail(form.email);
    if (emailErr) {
      setFormError(emailErr);
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

    const role: UserRole = canAssignRoles ? form.role : 'operator';
    if (role === 'admin' && !canAssignAdmin) {
      setFormError('Only an owner (admin) can assign the Admin role.');
      return;
    }
    if (!canAssignRoles && role !== 'operator') {
      setFormError('Managers can only add or edit Workers.');
      return;
    }

    setSaving(true);
    try {
      let photoUrl = form.photoUrl.trim() || undefined;
      if (form.photoDirty && photoUrl) {
        photoUrl = await persistStaffPhoto(uid, photoUrl);
      }
      if (form.photoDirty && !form.photoUrl.trim()) {
        photoUrl = undefined;
      }
      await upsertUser(uid, {
        name: form.name.trim(),
        role,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        photoUrl,
        address: form.address.trim() || undefined,
        isActive: form.isActive,
      });
      setDialogOpen(false);
      await load();
      if (profile?.id === uid) {
        await refreshProfile();
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      <PageHeader
        title="Team"
        action={
          canManageTeam ? (
            <Button variant="contained" onClick={openAdd} disabled={loading}>
              {LOCAL_DEMO ? 'Add user' : 'Link profile'}
            </Button>
          ) : undefined
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : (
        <ResponsiveTableContainer
          sx={{ maxWidth: 1100, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Address</TableCell>
                <TableCell>Active</TableCell>
                <TableCell>UID</TableCell>
                <TableCell align="right"> </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <StaffAvatar name={u.name} photoUrl={u.photoUrl} size={32} />
                      <Typography variant="body2">{u.name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{roleLabel(u.role)}</TableCell>
                  <TableCell>{u.phone ?? '—'}</TableCell>
                  <TableCell>{u.email ?? '—'}</TableCell>
                  <TableCell title={u.address}>{shortText(u.address)}</TableCell>
                  <TableCell>{u.isActive ? 'Yes' : 'No'}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, maxWidth: 200 }} title={u.id}>
                    {u.id.length > 24 ? `${u.id.slice(0, 12)}…${u.id.slice(-6)}` : u.id}
                  </TableCell>
                  <TableCell align="right">
                    {canEditUser(u) ? (
                      <Button size="small" onClick={() => openEdit(u)}>
                        Edit
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
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
                value={canAssignRoles ? form.role : 'operator'}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                disabled={!canAssignRoles || (form.role === 'admin' && !canAssignAdmin)}
              >
                <MenuItem value="operator">Worker</MenuItem>
                <MenuItem value="manager">Manager</MenuItem>
                <MenuItem value="owner">Owner</MenuItem>
                {(canAssignAdmin || form.role === 'admin') ? (
                  <MenuItem value="admin">Admin</MenuItem>
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
            <TextField
              label="Email (optional)"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="Address (optional)"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              fullWidth
              size="small"
              multiline
              minRows={2}
            />
            <Stack direction="row" spacing={1.5} alignItems="center">
              <StaffAvatar name={form.name || 'Staff'} photoUrl={form.photoUrl || undefined} size={48} />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  void handlePhotoSelected(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <Button size="small" variant="outlined" onClick={() => fileInputRef.current?.click()}>
                Upload photo
              </Button>
              {form.photoUrl ? (
                <Button
                  size="small"
                  onClick={() => setForm((f) => ({ ...f, photoUrl: '', photoDirty: true }))}
                >
                  Remove
                </Button>
              ) : null}
            </Stack>
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
    </Stack>
  );
}
