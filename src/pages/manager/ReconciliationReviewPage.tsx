import { useEffect, useState } from 'react';
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
  Paper,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReadOnlyBanner } from '@/components/ui/ReadOnlyBanner';
import { usePermissions } from '@/hooks/usePermissions';
import { listPendingReconciliations, setReconciliationStatus } from '@/services/reconciliationService';
import { getUser } from '@/services/usersService';
import type { ShiftReconciliation } from '@/types/entities';
import { getShift } from '@/services/shiftsService';
import { getMachineLabelForShift } from '@/services/shiftReadingsService';

function fmtRs(n: number): string {
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parsePumpAttendantNames(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(/[,;|\n]+/)
    .map((x) => x.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

export function ReconciliationReviewPage() {
  const { readOnlyOps, can } = usePermissions();
  const canApprove = can('approve:reconciliation');
  const [list, setList] = useState<ShiftReconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [comment, setComment] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const rows = await listPendingReconciliations();
      setList(rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      {readOnlyOps ? <ReadOnlyBanner /> : null}
      <PageHeader
        title="Reconciliations"
        subtitle="Review operator submissions: totals, Paytm/cards/credit/cash split, and short/over. Each card lists all pump boys / girls recorded on that shift. Approve or reject with an optional note."
        action={
          <Button
            variant="outlined"
            startIcon={<RefreshOutlinedIcon />}
            onClick={() => void load()}
            disabled={loading}
            sx={{ minHeight: 48, alignSelf: { xs: 'stretch', sm: 'auto' } }}
          >
            Reload queue
          </Button>
        }
      />

      {err && <Alert severity="error">{err}</Alert>}

      {loading ? (
        <Paper variant="outlined" sx={{ borderRadius: 2, py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={44} thickness={4} />
          <Typography color="text.secondary">Loading pending reconciliations…</Typography>
        </Paper>
      ) : list.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No pending reconciliations — operators have nothing waiting for your review.
        </Alert>
      ) : (
        <Stack spacing={2}>
          {list.map((r) => (
            <Card
              key={r.id}
              elevation={0}
              sx={{
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                transition: 'box-shadow 0.2s',
                '&:hover': { boxShadow: (t) => `0 8px 24px ${alpha(t.palette.common.black, 0.07)}` },
              }}
            >
              <Box sx={{ height: 3, bgcolor: 'warning.main' }} />
              <CardContent sx={{ pt: 2.5 }}>
                <ReconciliationCardHeader r={r} />
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 1, my: 2 }}>
                  <Chip label={`Sales ${fmtRs(r.totalSalesAmount)}`} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                  <Chip label={`Received ${fmtRs(r.totalReceived)}`} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                  <Chip
                    label={`Diff ${fmtRs(r.difference)}`}
                    size="small"
                    color={Math.abs(r.difference) < 0.02 ? 'default' : 'warning'}
                    sx={{ fontWeight: 600 }}
                  />
                  {r.shortAmount > 0.005 ? (
                    <Chip label={`Short ${fmtRs(r.shortAmount)}`} size="small" color="error" variant="outlined" />
                  ) : null}
                </Stack>
                <Divider sx={{ my: 1.5 }} />
                <TextField
                  size="small"
                  fullWidth
                  label="Manager comment (optional)"
                  value={comment[r.id] ?? ''}
                  onChange={(e) => setComment((c) => ({ ...c, [r.id]: e.target.value }))}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
                <Stack direction="row" spacing={1.5} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
                  {!readOnlyOps ? (
                    <Button
                      component={RouterLink}
                      to={`/shifts/${r.shiftId}/reconcile?edit=1`}
                      size="medium"
                      variant="outlined"
                      startIcon={<EditOutlinedIcon />}
                      sx={{ borderRadius: 1.5 }}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {canApprove ? (
                    <>
                      <Button
                        size="medium"
                        color="success"
                        variant="contained"
                        disabled={actionId === r.id}
                        onClick={async () => {
                          setActionId(r.id);
                          try {
                            await setReconciliationStatus(r.id, 'approved', comment[r.id]);
                            await load();
                          } finally {
                            setActionId(null);
                          }
                        }}
                        sx={{ borderRadius: 1.5 }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="medium"
                        color="warning"
                        variant="outlined"
                        disabled={actionId === r.id}
                        onClick={async () => {
                          setActionId(r.id);
                          try {
                            await setReconciliationStatus(r.id, 'rejected', comment[r.id]);
                            await load();
                          } finally {
                            setActionId(null);
                          }
                        }}
                        sx={{ borderRadius: 1.5 }}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function ReconciliationCardHeader({ r }: { r: ShiftReconciliation }) {
  const [opName, setOpName] = useState('');
  const [label, setLabel] = useState('');
  const [pumpAttendants, setPumpAttendants] = useState<string[]>([]);
  const [machineLabel, setMachineLabel] = useState('—');

  useEffect(() => {
    let ok = true;
    (async () => {
      const u = await getUser(r.operatorId);
      const sh = await getShift(r.shiftId);
      const machines = await getMachineLabelForShift(r.shiftId);
      if (ok) {
        setOpName(u?.name ?? r.operatorId);
        const cal =
          sh?.calendarDate && /^\d{4}-\d{2}-\d{2}$/.test(sh.calendarDate)
            ? (() => {
                const [y, m, d] = sh.calendarDate.split('-');
                return `${d}-${m}-${y}`;
              })()
            : '';
        const base = sh?.shiftLabel ?? '';
        setLabel(cal ? `${base} · ${cal}` : base);
        setPumpAttendants(parsePumpAttendantNames(sh?.pumpAttendants));
        setMachineLabel(machines);
      }
    })();
    return () => {
      ok = false;
    };
  }, [r.id, r.operatorId, r.shiftId]);

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>
          Cashier / operator
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{opName}</Typography>
          <Chip size="small" label={label || 'Shift'} variant="outlined" sx={{ fontWeight: 600 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
            Shift id: {r.shiftId.length > 14 ? `${r.shiftId.slice(0, 10)}…` : r.shiftId}
          </Typography>
        </Stack>
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>
          Machine
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
          {machineLabel}
        </Typography>
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>
          Pump boys / girls on duty
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25, mb: 0.75, display: 'block' }}>
          From <strong>Start shift</strong> (comma-separated names)
        </Typography>
        {pumpAttendants.length > 0 ? (
          <Stack direction="row" flexWrap="wrap" useFlexGap sx={{ gap: 0.75 }}>
            {pumpAttendants.map((name, i) => (
              <Chip key={`${name}-${i}`} size="small" label={name} color="info" variant="outlined" sx={{ fontWeight: 600 }} />
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No names recorded — add pump attendants when starting the shift to show the full team here.
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
