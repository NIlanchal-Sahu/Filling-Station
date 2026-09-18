import { useEffect, useState, useMemo } from 'react';
import {
  alpha,
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
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
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SearchIcon from '@mui/icons-material/Search';
import TrendingFlatOutlinedIcon from '@mui/icons-material/TrendingFlatOutlined';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { listCreditCustomers, createCustomer, updateCustomer } from '@/services/creditCustomersService';
import {
  deleteCreditSale,
  listAllCreditSales,
  MANAGER_CREDIT_SHIFT_ID,
  updateCreditSale,
} from '@/services/creditSalesService';
import { listFuelTypes } from '@/services/fuelTypesService';
import type { CreditCustomer, CreditSale } from '@/types/entities';
import type { CustomerFuelCreditTotals } from '@/pages/manager/creditFuelTotals';
import { fuelCreditTotalsByCustomerId, describeFuelCreditTotals } from '@/pages/manager/creditFuelTotals';
import { requireMin, requireNonEmpty } from '@/utils/validation';
import { downloadCsv } from '@/utils/csvExport';
import { ManualCreditSaleFormCard } from '@/pages/manager/ManualCreditSaleFormCard';
import { trimNumberDisplay } from '@/pages/manager/creditRegisterFormatters';
import { FilterToolbar } from '@/components/ui/FilterToolbar';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReadOnlyBanner } from '@/components/ui/ReadOnlyBanner';
import { ResponsiveTableContainer } from '@/components/ui/ResponsiveTableContainer';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  assertEntryDateAllowed,
  clampEntryDateForRole,
  dateInputBoundsForRole,
} from '@/utils/dateEntryPolicy';

function fmtRs(n: number): string {
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CreditCustomersPage() {
  const nav = useNavigate();
  const { profile } = useAuth();
  const { readOnlyOps, role } = usePermissions();
  const isAdmin = role === 'admin';
  const dateBounds = dateInputBoundsForRole(profile?.role);
  const [list, setList] = useState<CreditCustomer[]>([]);
  const [parties, setParties] = useState<CreditCustomer[]>([]);
  const [fuels, setFuels] = useState<Array<{ id: string; name: string }>>([]);
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [creditSaleCustomerId, setCreditSaleCustomerId] = useState('');
  const [editSale, setEditSale] = useState<CreditSale | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editFuelTypeId, setEditFuelTypeId] = useState('');
  const [editLiters, setEditLiters] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  type CreditRegisterRow = {
    id: string;
    dateLabel: string;
    party: string;
    partyLc: string;
    fuel: string;
    qty: string;
    rate: string;
    amount: string;
    sale: CreditSale;
  };
  const [registerRows, setRegisterRows] = useState<CreditRegisterRow[]>([]);
  const [fuelTotalsByCustomerId, setFuelTotalsByCustomerId] = useState<
    Record<string, CustomerFuelCreditTotals>
  >({});

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [rows, allCustomers, sales, fuelTypes] = await Promise.all([
        listCreditCustomers(showInactive),
        listCreditCustomers(true),
        listAllCreditSales(),
        listFuelTypes(),
      ]);
      setList(rows);
      setParties(allCustomers);
      setFuels(fuelTypes.map((f) => ({ id: f.id, name: f.name })));

      const nameById = new Map(allCustomers.map((c) => [c.id, c.name]));
      const fuelNameById = new Map(fuelTypes.map((f) => [f.id, f.name.trim().toUpperCase()]));
      const sorted = [...sales].sort((a, b) => b.date.toMillis() - a.date.toMillis());

      setFuelTotalsByCustomerId(fuelCreditTotalsByCustomerId(sales, fuelNameById));

      setRegisterRows(
        sorted.map((s) => {
          const party = nameById.get(s.customerId) ?? s.customerId;
          const fuel = s.fuelTypeId != null ? (fuelNameById.get(s.fuelTypeId) ?? '—') : '—';
          let rateVal = s.rateAtSale ?? null;
          if (rateVal == null && s.liters != null && s.liters > 0) {
            rateVal = s.amount / s.liters;
          }
          const qty =
            s.liters != null && Number.isFinite(s.liters)
              ? trimNumberDisplay(Number(s.liters))
              : '—';
          const rate =
            rateVal != null && Number.isFinite(rateVal) ? trimNumberDisplay(rateVal) : '—';
          const amount = trimNumberDisplay(s.amount);

          return {
            id: s.id,
            dateLabel: format(s.date.toDate(), 'dd-MM-yyyy'),
            party,
            partyLc: party.toLowerCase(),
            fuel,
            qty,
            rate,
            amount,
            sale: s,
          };
        }),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [showInactive]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) {
      return list;
    }
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(t) ||
        (c.phone && c.phone.includes(t)) ||
        (c.vehicleNumber && c.vehicleNumber.toLowerCase().includes(t)),
    );
  }, [list, q]);

  const outstandingFiltered = useMemo(
    () => filtered.reduce((s, c) => s + Number(c.currentBalance ?? 0), 0),
    [filtered],
  );

  const activePartiesCount = useMemo(() => list.filter((c) => c.isActive).length, [list]);

  const activeForCreditSale = useMemo(() => list.filter((c) => c.isActive), [list]);

  const registerFiltered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return registerRows;
    return registerRows.filter(
      (r) =>
        r.partyLc.includes(t) ||
        r.dateLabel.includes(t) ||
        r.fuel.toLowerCase().includes(t),
    );
  }, [registerRows, q]);

  useEffect(() => {
    const act = activeForCreditSale;
    if (!act.length) {
      setCreditSaleCustomerId('');
      return;
    }
    if (!creditSaleCustomerId || !act.some((c) => c.id === creditSaleCustomerId)) {
      setCreditSaleCustomerId(act[0]!.id);
    }
  }, [activeForCreditSale, creditSaleCustomerId]);

  async function addCustomer(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const m = requireNonEmpty(name, 'Name');
    if (m) {
      setFormError(m);
      return;
    }
    setSaving(true);
    try {
      const id = await createCustomer({ name, phone: phone || undefined, isActive: true });
      setName('');
      setPhone('');
      await load();
      nav(`/manager/credit/${id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  const editAmount = useMemo(() => {
    const lt = Number(editLiters);
    const rt = Number(editRate);
    if (!Number.isFinite(lt) || !Number.isFinite(rt)) {
      return 0;
    }
    return Math.round((lt * rt + Number.EPSILON) * 100) / 100;
  }, [editLiters, editRate]);

  const editShiftLocked = Boolean(
    editSale?.shiftId && editSale.shiftId !== MANAGER_CREDIT_SHIFT_ID,
  );

  function openEdit(sale: CreditSale) {
    setEditSale(sale);
    setEditDate(clampEntryDateForRole(profile?.role, format(sale.date.toDate(), 'yyyy-MM-dd')));
    setEditCustomerId(sale.customerId);
    setEditFuelTypeId(sale.fuelTypeId ?? fuels[0]?.id ?? '');
    setEditLiters(sale.liters != null ? String(sale.liters) : '');
    setEditRate(sale.rateAtSale != null ? String(sale.rateAtSale) : '');
    setEditErr(null);
  }

  function closeEdit() {
    setEditSale(null);
    setEditErr(null);
  }

  async function submitEdit() {
    if (!editSale || !profile) {
      return;
    }
    setEditErr(null);
    const partyErr = requireNonEmpty(editCustomerId, 'Party');
    const ltErr = requireMin(editLiters, 0, 'Litres');
    const rtErr = requireMin(editRate, 0, 'Rate');
    if (partyErr || ltErr || rtErr || !editFuelTypeId) {
      setEditErr(partyErr || ltErr || rtErr || 'Choose a fuel type.');
      return;
    }
    const ltVal = Number(editLiters);
    const rtVal = Number(editRate);
    if (!(ltVal > 0) || !(rtVal > 0) || editAmount <= 0) {
      setEditErr('Litres and rate must produce a positive amount.');
      return;
    }
    setEditSaving(true);
    try {
      const day = clampEntryDateForRole(profile.role, editDate);
      assertEntryDateAllowed(profile.role, day);
      await updateCreditSale(editSale.id, {
        customerId: editCustomerId,
        date: new Date(`${day}T12:00:00`),
        fuelTypeId: editFuelTypeId,
        liters: ltVal,
        rateAtSale: rtVal,
      });
      closeEdit();
      await load();
    } catch (e) {
      setEditErr(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteSale(row: CreditRegisterRow) {
    const shiftLine = row.sale.shiftId && row.sale.shiftId !== MANAGER_CREDIT_SHIFT_ID;
    const extra = shiftLine
      ? '\n\nThis line was posted from a shift. Deleting it does not change that shift recon.'
      : '';
    if (
      !window.confirm(
        `Delete this credit sale?\n${row.dateLabel} · ${row.party} · ${row.fuel} · ₹${row.amount}${extra}`,
      )
    ) {
      return;
    }
    try {
      await deleteCreditSale(row.id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      {readOnlyOps ? (
        <ReadOnlyBanner message="You can review parties and the credit register. Staff post sales and new accounts." />
      ) : null}
      <PageHeader title="Credit" />

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <FilterToolbar>
          <TextField
            size="small"
            label="Search parties or register"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            fullWidth
            sx={{
              maxWidth: { md: 360 },
              '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary', fontSize: 22 }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <FormControlLabel
            control={<Switch checked={showInactive} onChange={(_, c) => setShowInactive(c)} color="primary" />}
            label={<Typography variant="body2">Show inactive parties</Typography>}
          />
          <Button
            variant="contained"
            color="secondary"
            onClick={() =>
              downloadCsv(
                'credit_customers.csv',
                ['Name', 'Phone', 'Balance', 'Diesel L', 'Petrol L', 'Other L', 'Active'],
                filtered.map((c) => {
                  const ft = fuelTotalsByCustomerId[c.id];
                  const d = ft?.dieselLiters ?? 0;
                  const p = ft?.petrolLiters ?? 0;
                  const o = ft?.otherLiters ?? 0;
                  return [
                    c.name,
                    c.phone ?? '',
                    c.currentBalance,
                    trimNumberDisplay(d),
                    trimNumberDisplay(p),
                    trimNumberDisplay(o),
                    c.isActive ? 'Y' : 'N',
                  ];
                }),
              )
            }
            sx={{ minHeight: 44 }}
          >
            Export parties CSV
          </Button>
        </FilterToolbar>

        {!loading ? (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ mt: 2 }}
            divider={<Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', sm: 'block' } }} />}
          >
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
              <TrendingFlatOutlinedIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.04em' }}>
                  Outstanding (visible list)
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtRs(outstandingFiltered)}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <GroupOutlinedIcon sx={{ color: 'text.secondary' }} />
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.04em' }}>
                  Active parties
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {activePartiesCount}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <ReceiptLongOutlinedIcon sx={{ color: 'text.secondary' }} />
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.04em' }}>
                  Register rows (filtered)
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {registerFiltered.length}
                </Typography>
              </Box>
            </Stack>
          </Stack>
        ) : null}
      </Paper>

      {err && <Alert severity="error">{err}</Alert>}

      {!readOnlyOps ? (
      <Card
        elevation={0}
        component="form"
        onSubmit={addCustomer}
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          transition: 'box-shadow 0.2s ease',
          '&:hover': { boxShadow: (t) => `0 8px 24px ${alpha(t.palette.common.black, 0.06)}` },
        }}
      >
        <Box sx={{ height: 3, bgcolor: 'success.main' }} />
        <CardContent sx={{ pt: 2.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <PersonAddOutlinedIcon color="success" sx={{ opacity: 0.9 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              New credit party
            </Typography>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-start' }}>
            <TextField
              required
              label="Party name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
            <TextField
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
            <Button type="submit" variant="contained" size="large" disabled={saving} sx={{ borderRadius: 1.5, px: 3 }}>
              {saving ? 'Saving…' : 'Add & open ledger'}
            </Button>
          </Stack>
          {formError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {formError}
            </Alert>
          )}
        </CardContent>
      </Card>
      ) : null}

      {!readOnlyOps && activeForCreditSale.length > 0 && (
        <ManualCreditSaleFormCard
          mode="pickCustomer"
          customers={activeForCreditSale}
          customerId={creditSaleCustomerId}
          onCustomerIdChange={setCreditSaleCustomerId}
          onSuccess={async () => {
            await load();
          }}
        />
      )}

      {loading ? (
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            py: 6,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <CircularProgress size={40} thickness={4} />
          <Typography color="text.secondary">Loading credit data…</Typography>
        </Paper>
      ) : (
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Stack
              direction="row"
              sx={{
                px: 2,
                py: 1.5,
                bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.12 : 0.06),
                borderBottom: '1px solid',
                borderColor: 'divider',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <ReceiptLongOutlinedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Credit register
                </Typography>
                <Chip label="Newest first" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
              </Stack>
              <Button
                size="small"
                variant="outlined"
                onClick={() =>
                  downloadCsv(
                    'credit_register.csv',
                    ['Date', 'Party', 'Fuel', 'LTR', 'Rate', 'Amount'],
                    registerFiltered.map((r) => [r.dateLabel, r.party, r.fuel, r.qty, r.rate, r.amount]),
                  )
                }
                disabled={registerFiltered.length === 0}
              >
                Export register CSV
              </Button>
            </Stack>
            <ResponsiveTableContainer
              sx={{
                maxHeight: 420,
                minWidth: 0,
                overflowX: { xs: 'auto', md: 'hidden' },
                '& thead th:first-of-type': {
                  left: { xs: 0, md: 'auto' },
                  boxShadow: { xs: '2px 0 4px -2px rgba(0,0,0,0.18)', md: 'none' },
                },
                '& tbody td:first-of-type': {
                  position: { xs: 'sticky', md: 'static' },
                  left: { xs: 0, md: 'auto' },
                  zIndex: { xs: 2, md: 'auto' },
                  bgcolor: { xs: 'background.paper', md: 'transparent' },
                  boxShadow: { xs: '2px 0 4px -2px rgba(0,0,0,0.18)', md: 'none' },
                },
              }}
            >
              <Table
                size="small"
                stickyHeader
                aria-label="Credit register"
                sx={{
                  width: '100%',
                  minWidth: { xs: 640, md: 0 },
                  tableLayout: { xs: 'auto', md: 'fixed' },
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  '& th': {
                    py: 1.25,
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    letterSpacing: '0.06em',
                    bgcolor: (t) => (t.palette.mode === 'dark' ? t.palette.grey[800] : t.palette.grey[100]),
                  },
                  '& td': {
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    py: 1,
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: { md: '16%' }, whiteSpace: 'nowrap' }}>Date</TableCell>
                    <TableCell sx={{ width: { md: '28%' } }}>Party</TableCell>
                    <TableCell sx={{ width: { md: '14%' }, whiteSpace: 'nowrap' }}>Fuel</TableCell>
                    <TableCell align="right" sx={{ width: { md: '14%' }, whiteSpace: 'nowrap' }}>
                      Litres
                    </TableCell>
                    <TableCell align="right" sx={{ width: { md: '14%' }, whiteSpace: 'nowrap' }}>
                      ₹/L
                    </TableCell>
                    <TableCell align="right" sx={{ width: { md: isAdmin ? '12%' : '14%' }, whiteSpace: 'nowrap' }}>
                      Amount
                    </TableCell>
                    {isAdmin ? (
                      <TableCell align="right" sx={{ width: { md: '10%' }, whiteSpace: 'nowrap' }}>
                        Admin
                      </TableCell>
                    ) : null}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {registerFiltered.map((r, idx) => (
                    <TableRow
                      key={r.id}
                      sx={{
                        bgcolor:
                          idx % 2 === 1 ? (t) => alpha(t.palette.primary.main, 0.035) : 'transparent',
                      }}
                    >
                      <TableCell
                        sx={{
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {r.dateLabel}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{r.party}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.fuel}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {r.qty}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {r.rate}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {r.amount}
                      </TableCell>
                      {isAdmin ? (
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <IconButton
                            size="small"
                            aria-label={`Edit credit sale for ${r.party}`}
                            onClick={() => openEdit(r.sale)}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            aria-label={`Delete credit sale for ${r.party}`}
                            onClick={() => void handleDeleteSale(r)}
                          >
                            <DeleteOutlineOutlinedIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                  {registerFiltered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 7 : 6}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          No credit sales match this view — post a sale above or widen your search.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </Paper>

          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Parties
            </Typography>
            <Stack spacing={1.5}>
              {filtered.map((c) => (
                <Card
                  key={c.id}
                  elevation={0}
                  sx={{
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      borderColor: 'primary.light',
                      boxShadow: (t) => `0 6px 20px ${alpha(t.palette.primary.main, 0.08)}`,
                    },
                  }}
                >
                  <CardContent
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 2,
                      py: 2,
                    }}
                  >
                    <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ minWidth: 0, flex: 1 }}>
                      <Avatar
                        sx={{
                          bgcolor: (t) => alpha(t.palette.primary.main, 0.15),
                          color: 'primary.main',
                          fontWeight: 700,
                          width: 48,
                          height: 48,
                        }}
                      >
                        {c.name.trim().slice(0, 1).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{c.name}</Typography>
                          {!c.isActive ? (
                            <Chip label="Inactive" size="small" color="default" sx={{ height: 24 }} />
                          ) : (
                            <Chip label="Active" size="small" color="success" variant="outlined" sx={{ height: 24 }} />
                          )}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          Balance owed ·{' '}
                          <Typography component="span" color="primary.main" fontWeight={700} variant="body2">
                            {fmtRs(c.currentBalance)}
                          </Typography>
                        </Typography>
                        {(() => {
                          const ft = fuelTotalsByCustomerId[c.id];
                          const line = ft ? describeFuelCreditTotals(ft) : '';
                          if (!line) return null;
                          return (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                              Lifetime credit fuel: {line}
                            </Typography>
                          );
                        })()}
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                      <Button variant="contained" size="small" onClick={() => nav(`/manager/credit/${c.id}`)}>
                        Open ledger
                      </Button>
                      {!readOnlyOps ? (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={async () => {
                            await updateCustomer(c.id, { isActive: !c.isActive });
                            await load();
                          }}
                        >
                          {c.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      ) : null}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              {filtered.length === 0 && (
                <Paper variant="outlined" sx={{ borderRadius: 2, p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No parties match your search. Try clearing the filter or add a new party above.
                  </Typography>
                </Paper>
              )}
            </Stack>
          </Box>
        </Stack>
      )}

      <Dialog open={Boolean(editSale)} onClose={closeEdit} fullWidth maxWidth="sm">
        <DialogTitle>Edit credit sale</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {editShiftLocked ? (
              <Alert severity="info">
                Date follows the shift pump day. Party, fuel, litres, and rate can still be corrected.
              </Alert>
            ) : null}
            <TextField
              type="date"
              label="Date"
              value={editDate}
              onChange={(e) => setEditDate(clampEntryDateForRole(profile?.role, e.target.value))}
              size="small"
              disabled={editShiftLocked}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { min: dateBounds.min, max: dateBounds.max },
              }}
            />
            <TextField
              select
              label="Party"
              value={editCustomerId}
              onChange={(e) => setEditCustomerId(e.target.value)}
              size="small"
              fullWidth
            >
              {parties.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Fuel"
              value={editFuelTypeId}
              onChange={(e) => setEditFuelTypeId(e.target.value)}
              size="small"
              fullWidth
            >
              {fuels.map((f) => (
                <MenuItem key={f.id} value={f.id}>
                  {f.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Litres"
              type="number"
              value={editLiters}
              onChange={(e) => setEditLiters(e.target.value)}
              size="small"
              inputProps={{ min: 0, step: '0.001' }}
            />
            <TextField
              label="₹ / L"
              type="number"
              value={editRate}
              onChange={(e) => setEditRate(e.target.value)}
              size="small"
              inputProps={{ min: 0, step: '0.01' }}
            />
            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              Amount ₹{editAmount.toFixed(2)}
            </Typography>
            {editErr ? <Alert severity="error">{editErr}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeEdit} disabled={editSaving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void submitEdit()} disabled={editSaving}>
            {editSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
