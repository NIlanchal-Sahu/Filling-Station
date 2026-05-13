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
  Divider,
  FormControlLabel,
  InputAdornment,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SearchIcon from '@mui/icons-material/Search';
import TrendingFlatOutlinedIcon from '@mui/icons-material/TrendingFlatOutlined';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { listCreditCustomers, createCustomer, updateCustomer } from '@/services/creditCustomersService';
import { listAllCreditSales } from '@/services/creditSalesService';
import { listFuelTypes } from '@/services/fuelTypesService';
import type { CreditCustomer } from '@/types/entities';
import type { CustomerFuelCreditTotals } from '@/pages/manager/creditFuelTotals';
import { fuelCreditTotalsByCustomerId, describeFuelCreditTotals } from '@/pages/manager/creditFuelTotals';
import { requireNonEmpty } from '@/utils/validation';
import { downloadCsv } from '@/utils/csvExport';
import { ManualCreditSaleFormCard } from '@/pages/manager/ManualCreditSaleFormCard';
import { trimNumberDisplay } from '@/pages/manager/creditRegisterFormatters';

function fmtRs(n: number): string {
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CreditCustomersPage() {
  const theme = useTheme();
  const nav = useNavigate();
  const [list, setList] = useState<CreditCustomer[]>([]);
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [creditSaleCustomerId, setCreditSaleCustomerId] = useState('');

  type CreditRegisterRow = {
    id: string;
    dateLabel: string;
    party: string;
    partyLc: string;
    fuel: string;
    qty: string;
    rate: string;
    amount: string;
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

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      <Box
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          background: (t) =>
            `linear-gradient(120deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 52%, ${t.palette.primary.light} 115%)`,
          color: 'primary.contrastText',
          p: { xs: 2.5, sm: 3 },
          boxShadow: (t) => `0 12px 40px ${alpha(t.palette.primary.main, 0.3)}`,
        }}
      >
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ sm: 'flex-start' }}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <CreditCardOutlinedIcon sx={{ opacity: 0.95 }} />
                <Typography variant="overline" sx={{ opacity: 0.92, letterSpacing: '0.12em', fontWeight: 600 }}>
                  Fleet & parties
                </Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                Credit
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.75, maxWidth: 560 }}>
                Track party balances, post manual fuel sales on credit, and browse the dated register — same flow as your
                written credit book.
              </Typography>
            </Box>
          </Stack>

          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.12 : 0.98),
              color: 'text.primary',
              border: '1px solid',
              borderColor: alpha('#fff', 0.35),
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
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
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={{ xs: 1, sm: 2 }}
                alignItems={{ sm: 'center' }}
                flexWrap="wrap"
                sx={{ flex: 1, justifyContent: { md: 'flex-end' }, gap: 1 }}
              >
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
                >
                  Export parties CSV
                </Button>
              </Stack>
            </Stack>

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
        </Stack>
      </Box>

      {err && <Alert severity="error">{err}</Alert>}

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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Creates an account you can bill on shift reconciliation or via quick credit sale below.
          </Typography>
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

      {activeForCreditSale.length > 0 && (
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
            <TableContainer sx={{ maxHeight: 420 }}>
              <Table
                size="small"
                stickyHeader
                aria-label="Credit register"
                sx={{
                  tableLayout: 'fixed',
                  '& th': {
                    py: 1.25,
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    letterSpacing: '0.06em',
                    bgcolor: 'action.hover',
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
                    <TableCell sx={{ width: '12%', whiteSpace: 'nowrap' }}>Date</TableCell>
                    <TableCell sx={{ width: '24%' }}>Party</TableCell>
                    <TableCell sx={{ width: '14%', whiteSpace: 'nowrap' }}>Fuel</TableCell>
                    <TableCell align="right" sx={{ width: '14%', whiteSpace: 'nowrap' }}>
                      Litres
                    </TableCell>
                    <TableCell align="right" sx={{ width: '14%', whiteSpace: 'nowrap' }}>
                      ₹/L
                    </TableCell>
                    <TableCell align="right" sx={{ width: '16%', whiteSpace: 'nowrap' }}>
                      Amount
                    </TableCell>
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
                      <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
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
                    </TableRow>
                  ))}
                  {registerFiltered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          No credit sales match this view — post a sale above or widen your search.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
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
    </Stack>
  );
}
