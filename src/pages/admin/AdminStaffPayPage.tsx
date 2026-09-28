import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  alpha,
  Box,
  Button,
  Chip,
  FormControl,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ResponsiveTableContainer } from '@/components/ui/ResponsiveTableContainer';
import { StaffAvatar } from '@/components/ui/StaffAvatar';
import { listUsersForManager, upsertUser } from '@/services/usersService';
import type { StaffPayMode, User } from '@/types/entities';
import { isStaffPayRosterUser, roleLabel } from '@/utils/roles';
import {
  effectiveStaffPayMode,
  parseOperatorStaffPay,
} from '@/utils/staffPayValidation';

type RowDraft = {
  staffPayMode: StaffPayMode;
  shiftPayRateInr: string;
  monthlySalaryInr: string;
  saving: boolean;
  error: string | null;
  dirty: boolean;
};

const tableHeadRowSx = {
  bgcolor: (t: { palette: { primary: { main: string }; mode: string } }) =>
    alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.16 : 0.06),
  '& th': {
    fontWeight: 700,
    fontSize: '0.7rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'text.secondary',
    borderBottom: '1px solid',
    borderColor: 'divider',
    py: 1.25,
  },
};

function draftFromUser(u: User): RowDraft {
  const mode = effectiveStaffPayMode(u.staffPayMode);
  return {
    staffPayMode: mode,
    shiftPayRateInr:
      u.shiftPayRateInr != null && Number.isFinite(u.shiftPayRateInr) ? String(u.shiftPayRateInr) : '',
    monthlySalaryInr:
      u.monthlySalaryInr != null && Number.isFinite(u.monthlySalaryInr) ? String(u.monthlySalaryInr) : '',
    saving: false,
    error: null,
    dirty: false,
  };
}

function roleChipColor(role: User['role']): 'primary' | 'default' {
  return role === 'manager' ? 'primary' : 'default';
}

export function AdminStaffPayPage() {
  const [staffRows, setStaffRows] = useState<User[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const staffCount = staffRows.length;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await listUsersForManager();
      const eligible = list.filter(isStaffPayRosterUser).sort((a, b) => {
        const roleOrder = (r: User['role']) => (r === 'manager' ? 0 : 1);
        const byRole = roleOrder(a.role) - roleOrder(b.role);
        return byRole !== 0 ? byRole : a.name.localeCompare(b.name);
      });
      setStaffRows(eligible);
      const next: Record<string, RowDraft> = {};
      for (const u of eligible) {
        next[u.id] = draftFromUser(u);
      }
      setDrafts(next);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirtyCount = useMemo(
    () => Object.values(drafts).filter((d) => d.dirty && !d.saving).length,
    [drafts],
  );

  function patchDraft(userId: string, patch: Partial<RowDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], ...patch, dirty: true, error: null },
    }));
  }

  async function handleSave(u: User) {
    const draft = drafts[u.id];
    if (!draft) return;

    const parsed = parseOperatorStaffPay(
      draft.staffPayMode,
      draft.shiftPayRateInr,
      draft.monthlySalaryInr,
    );
    if (!parsed.ok) {
      patchDraft(u.id, { error: parsed.error, dirty: true });
      return;
    }

    patchDraft(u.id, { saving: true, error: null });
    try {
      const pay = parsed.value;
      await upsertUser(u.id, {
        name: u.name,
        role: u.role,
        phone: u.phone,
        email: u.email,
        photoUrl: u.photoUrl,
        address: u.address,
        isActive: u.isActive,
        staffPayMode: pay.staffPayMode,
        shiftPayRateInr: pay.staffPayMode === 'per_shift' ? pay.shiftPayRateInr : undefined,
        monthlySalaryInr: pay.staffPayMode === 'monthly' ? pay.monthlySalaryInr : undefined,
      });
      const updated: User = {
        ...u,
        staffPayMode: pay.staffPayMode,
        shiftPayRateInr: pay.staffPayMode === 'per_shift' ? pay.shiftPayRateInr : undefined,
        monthlySalaryInr: pay.staffPayMode === 'monthly' ? pay.monthlySalaryInr : undefined,
      };
      setStaffRows((rows) => rows.map((row) => (row.id === u.id ? updated : row)));
      setDrafts((prev) => ({
        ...prev,
        [u.id]: { ...draftFromUser(updated), saving: false },
      }));
      setToast(`Saved · ${u.name}`);
    } catch (e) {
      patchDraft(u.id, {
        saving: false,
        error: e instanceof Error ? e.message : 'Save failed',
      });
    }
  }

  return (
    <Stack spacing={2.5} sx={{ pb: 4 }}>
      <PageHeader
        title="Staff pay rates"
        subtitle="Monthly pay is pro-rated by days in Pay summary."
        action={
          <Button
            component={RouterLink}
            to="/manager/attendant-sheet"
            variant="outlined"
            size="small"
            endIcon={<ArrowForwardOutlinedIcon />}
            sx={{ borderRadius: 1.5, fontWeight: 600, whiteSpace: 'nowrap' }}
          >
            Pay summary
          </Button>
        }
      />

      {loadError ? (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: 'error.light' }}>
          <Typography variant="body2" color="error">
            {loadError}
          </Typography>
        </Paper>
      ) : null}

      {loading ? (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Skeleton width={120} height={28} />
          </Box>
          <Stack spacing={0} sx={{ p: 2 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={56} sx={{ mb: 1, borderRadius: 1 }} />
            ))}
          </Stack>
        </Paper>
      ) : staffRows.length === 0 ? (
        <EmptyState
          icon={<PaymentsOutlinedIcon fontSize="large" />}
          title="No staff yet"
          description="Add managers and workers on Team, then set their pay here."
          action={
            <Button component={RouterLink} to="/admin/team" variant="contained" size="small">
              Go to Team
            </Button>
          }
        />
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', gap: 1 }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Rates
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              {dirtyCount > 0 ? (
                <Chip
                  size="small"
                  label={`${dirtyCount} unsaved`}
                  color="warning"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              ) : null}
              <Chip size="small" label={`${staffCount} staff`} variant="outlined" sx={{ fontWeight: 600 }} />
            </Stack>
          </Stack>

          <ResponsiveTableContainer>
            <Table size="small" sx={{ minWidth: 560 }}>
              <TableHead>
                <TableRow sx={tableHeadRowSx}>
                  <TableCell>Staff</TableCell>
                  <TableCell sx={{ minWidth: 148 }}>Pay mode</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>Amount</TableCell>
                  <TableCell align="right" sx={{ width: 88, pr: 2 }}>
                    &nbsp;
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {staffRows.map((u) => {
                  const draft = drafts[u.id] ?? draftFromUser(u);
                  const amountValue =
                    draft.staffPayMode === 'monthly' ? draft.monthlySalaryInr : draft.shiftPayRateInr;
                  return (
                    <TableRow
                      key={u.id}
                      sx={{
                        '&:nth-of-type(even)': {
                          bgcolor: (t) => alpha(t.palette.action.hover, 0.35),
                        },
                        ...(draft.dirty
                          ? {
                              bgcolor: (t) => alpha(t.palette.warning.main, t.palette.mode === 'dark' ? 0.12 : 0.06),
                            }
                          : {}),
                      }}
                    >
                      <TableCell sx={{ py: 1.5 }}>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <StaffAvatar name={u.name} photoUrl={u.photoUrl} size={40} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                              {u.name}
                            </Typography>
                            <Chip
                              label={roleLabel(u.role)}
                              size="small"
                              color={roleChipColor(u.role)}
                              variant="outlined"
                              sx={{ mt: 0.5, height: 22, fontSize: '0.65rem', fontWeight: 700 }}
                            />
                          </Box>
                        </Stack>
                        {draft.error ? (
                          <Typography variant="caption" color="error" display="block" sx={{ mt: 0.75, pl: 6.5 }}>
                            {draft.error}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'middle' }}>
                        <FormControl size="small" fullWidth variant="outlined">
                          <Select
                            value={draft.staffPayMode}
                            onChange={(e) =>
                              patchDraft(u.id, { staffPayMode: e.target.value as StaffPayMode })
                            }
                            inputProps={{ 'aria-label': `Pay mode for ${u.name}` }}
                            sx={{ borderRadius: 1.5, bgcolor: 'background.paper' }}
                          >
                            <MenuItem value="per_shift">Per shift</MenuItem>
                            <MenuItem value="monthly">Monthly</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'middle' }}>
                        <TextField
                          size="small"
                          fullWidth
                          type="number"
                          placeholder="0"
                          value={amountValue}
                          onChange={(e) =>
                            patchDraft(
                              u.id,
                              draft.staffPayMode === 'monthly'
                                ? { monthlySalaryInr: e.target.value }
                                : { shiftPayRateInr: e.target.value },
                            )
                          }
                          slotProps={{
                            htmlInput: { min: 0, step: '1', 'aria-label': `Pay amount for ${u.name}` },
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                    ₹
                                  </Typography>
                                </InputAdornment>
                              ),
                            },
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'background.paper' },
                          }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ verticalAlign: 'middle', pr: 2 }}>
                        <Button
                          variant={draft.dirty ? 'contained' : 'text'}
                          color={draft.dirty ? 'primary' : 'inherit'}
                          size="small"
                          disabled={draft.saving || !draft.dirty}
                          onClick={() => void handleSave(u)}
                          sx={{
                            minWidth: 64,
                            fontWeight: 700,
                            borderRadius: 1.5,
                            textTransform: 'none',
                          }}
                        >
                          {draft.saving ? '…' : draft.dirty ? 'Save' : '—'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </Paper>
      )}

      <Snackbar
        open={toast != null}
        autoHideDuration={2800}
        onClose={() => setToast(null)}
        message={toast ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Stack>
  );
}
