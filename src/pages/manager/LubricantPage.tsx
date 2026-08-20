import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import type { Lubricant, LubricantSale, LubricantStockEntry } from '@/types/entities';
import { LUBRICANT_UNITS, LUBRICANT_GRADES, LUBRICANT_UNIT_LABELS } from '@/types/entities';
import {
  listLubricants,
  createLubricant,
  updateLubricant,
  addLubricantSale,
  listLubricantSales,
  addLubricantStock,
  listLubricantStockEntries,
} from '@/services/lubricantService';

const todayIso = () => format(new Date(), 'yyyy-MM-dd');

function fmtRs(v: number) {
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Add/Edit Lubricant Dialog ─────────────────────────────────────────────────

interface LubricantFormState {
  name: string;
  brand: string;
  grade: string;
  unit: string;
  sellingPrice: string;
  purchasePrice: string;
  minStockAlert: string;
}

const emptyLubForm = (): LubricantFormState => ({
  name: '',
  brand: '',
  grade: '20W-40',
  unit: 'litre',
  sellingPrice: '',
  purchasePrice: '',
  minStockAlert: '5',
});

function LubricantFormDialog(props: {
  open: boolean;
  editing: Lubricant | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { open, editing, onClose, onSaved } = props;
  const [form, setForm] = useState<LubricantFormState>(emptyLubForm());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        brand: editing.brand,
        grade: editing.grade,
        unit: editing.unit,
        sellingPrice: String(editing.sellingPrice),
        purchasePrice: String(editing.purchasePrice),
        minStockAlert: String(editing.minStockAlert),
      });
    } else {
      setForm(emptyLubForm());
    }
    setErr('');
  }, [open, editing]);

  function set(field: keyof LubricantFormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setErr('Name is required.'); return; }
    setSaving(true);
    setErr('');
    try {
      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim(),
        grade: form.grade,
        unit: form.unit,
        sellingPrice: parseFloat(form.sellingPrice) || 0,
        purchasePrice: parseFloat(form.purchasePrice) || 0,
        minStockAlert: parseFloat(form.minStockAlert) || 0,
        isActive: true,
      };
      if (editing) {
        await updateLubricant(editing.id, payload);
      } else {
        await createLubricant(payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{editing ? 'Edit Lubricant' : 'Add Lubricant'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <TextField label="Product name" value={form.name} onChange={(e) => set('name', e.target.value)} fullWidth required size="small" />
          <TextField label="Brand" value={form.brand} onChange={(e) => set('brand', e.target.value)} fullWidth size="small" />
          <TextField label="Grade / Viscosity" value={form.grade} onChange={(e) => set('grade', e.target.value)} fullWidth size="small" select>
            {LUBRICANT_GRADES.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
          </TextField>
          <TextField label="Unit" value={form.unit} onChange={(e) => set('unit', e.target.value)} fullWidth size="small" select>
            {LUBRICANT_UNITS.map((u) => <MenuItem key={u} value={u}>{LUBRICANT_UNIT_LABELS[u] ?? u}</MenuItem>)}
          </TextField>
          <Stack direction="row" spacing={1}>
            <TextField
              label="Selling price"
              value={form.sellingPrice}
              onChange={(e) => set('sellingPrice', e.target.value)}
              size="small" type="number" fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
            />
            <TextField
              label="Purchase price"
              value={form.purchasePrice}
              onChange={(e) => set('purchasePrice', e.target.value)}
              size="small" type="number" fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
            />
          </Stack>
          <TextField
            label="Low-stock alert threshold"
            value={form.minStockAlert}
            onChange={(e) => set('minStockAlert', e.target.value)}
            size="small" type="number" fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={18} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Record Sale Dialog ────────────────────────────────────────────────────────

function SaleDialog(props: {
  open: boolean;
  lubricants: Lubricant[];
  defaultLubricantId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { open, lubricants, defaultLubricantId, onClose, onSaved } = props;
  const [lubId, setLubId] = useState(defaultLubricantId ?? '');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [customer, setCustomer] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [date, setDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setLubId(defaultLubricantId ?? (lubricants[0]?.id ?? ''));
    setQty('1');
    setErr('');
    setCustomer('');
    setVehicle('');
    setDate(todayIso());
  }, [open, defaultLubricantId, lubricants]);

  useEffect(() => {
    const lub = lubricants.find((l) => l.id === lubId);
    if (lub) setPrice(String(lub.sellingPrice));
  }, [lubId, lubricants]);

  async function handleSave() {
    if (!lubId) { setErr('Select a product.'); return; }
    const q = parseFloat(qty);
    if (!q || q <= 0) { setErr('Enter a valid quantity.'); return; }
    setSaving(true);
    setErr('');
    try {
      await addLubricantSale({
        lubricantId: lubId,
        pumpDayIso: date,
        quantity: q,
        sellingPricePerUnit: parseFloat(price) || 0,
        customerName: customer || undefined,
        vehicleNumber: vehicle || undefined,
      });
      onSaved();
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  const selected = lubricants.find((l) => l.id === lubId);
  const total = (parseFloat(qty) || 0) * (parseFloat(price) || 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Record Sale</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <TextField label="Date" value={date} onChange={(e) => setDate(e.target.value)} size="small" type="date" fullWidth />
          <TextField label="Product" value={lubId} onChange={(e) => setLubId(e.target.value)} size="small" select fullWidth>
            {lubricants.map((l) => (
              <MenuItem key={l.id} value={l.id}>
                {l.name} — {l.brand} ({l.grade})
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <TextField
              label={`Quantity (${selected ? (LUBRICANT_UNIT_LABELS[selected.unit] ?? selected.unit) : 'unit'})`}
              value={qty} onChange={(e) => setQty(e.target.value)}
              size="small" type="number" fullWidth
            />
            <TextField
              label="Price / unit"
              value={price} onChange={(e) => setPrice(e.target.value)}
              size="small" type="number" fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
            />
          </Stack>
          <TextField label="Customer name (optional)" value={customer} onChange={(e) => setCustomer(e.target.value)} size="small" fullWidth />
          <TextField label="Vehicle no. (optional)" value={vehicle} onChange={(e) => setVehicle(e.target.value)} size="small" fullWidth />
          {total > 0 && (
            <Typography variant="body2" align="right" sx={{ fontWeight: 700 }}>
              Total: {fmtRs(total)}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={18} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Add Stock (inward) Dialog ─────────────────────────────────────────────────

function StockInDialog(props: {
  open: boolean;
  lubricants: Lubricant[];
  defaultLubricantId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { open, lubricants, defaultLubricantId, onClose, onSaved } = props;
  const [lubId, setLubId] = useState(defaultLubricantId ?? '');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [supplier, setSupplier] = useState('');
  const [invoice, setInvoice] = useState('');
  const [date, setDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setLubId(defaultLubricantId ?? (lubricants[0]?.id ?? ''));
    setQty('');
    setErr('');
    setSupplier('');
    setInvoice('');
    setDate(todayIso());
  }, [open, defaultLubricantId, lubricants]);

  useEffect(() => {
    const lub = lubricants.find((l) => l.id === lubId);
    if (lub) setPrice(String(lub.purchasePrice));
  }, [lubId, lubricants]);

  async function handleSave() {
    if (!lubId) { setErr('Select a product.'); return; }
    const q = parseFloat(qty);
    if (!q || q <= 0) { setErr('Enter a valid quantity.'); return; }
    setSaving(true);
    setErr('');
    try {
      await addLubricantStock({
        lubricantId: lubId,
        pumpDayIso: date,
        quantity: q,
        purchasePricePerUnit: parseFloat(price) || 0,
        supplier: supplier || undefined,
        invoiceNo: invoice || undefined,
      });
      onSaved();
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add Stock (Inward)</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <TextField label="Date" value={date} onChange={(e) => setDate(e.target.value)} size="small" type="date" fullWidth />
          <TextField label="Product" value={lubId} onChange={(e) => setLubId(e.target.value)} size="small" select fullWidth>
            {lubricants.map((l) => (
              <MenuItem key={l.id} value={l.id}>
                {l.name} — {l.brand}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <TextField label="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} size="small" type="number" fullWidth />
            <TextField
              label="Purchase price"
              value={price} onChange={(e) => setPrice(e.target.value)}
              size="small" type="number" fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
            />
          </Stack>
          <TextField label="Supplier (optional)" value={supplier} onChange={(e) => setSupplier(e.target.value)} size="small" fullWidth />
          <TextField label="Invoice no. (optional)" value={invoice} onChange={(e) => setInvoice(e.target.value)} size="small" fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={18} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Stock summary cards ───────────────────────────────────────────────────────

function StockCard(props: {
  lub: Lubricant;
  onSell: () => void;
  onAddStock: () => void;
  onEdit: () => void;
}) {
  const { lub, onSell, onAddStock, onEdit } = props;
  const isLow = lub.currentStock <= lub.minStockAlert;
  const accent = isLow ? '#ef5350' : '#43a047';

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: isLow ? alpha('#ef5350', 0.5) : 'divider',
        overflow: 'hidden',
        bgcolor: isLow ? alpha('#ef5350', 0.04) : 'background.paper',
      }}
    >
      <Box sx={{ height: 4, bgcolor: accent }} />
      <Box sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {lub.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {lub.brand} · {lub.grade}
            </Typography>
          </Box>
          <Tooltip title="Edit product">
            <IconButton size="small" onClick={onEdit}>
              <SettingsOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mt: 1.5 }}>
          <Typography
            variant="h5"
            sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: isLow ? '#ef5350' : 'text.primary' }}
          >
            {lub.currentStock.toLocaleString('en-IN')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {LUBRICANT_UNIT_LABELS[lub.unit] ?? lub.unit}
          </Typography>
          {isLow && (
            <Chip
              icon={<WarningAmberRoundedIcon />}
              label="Low stock"
              size="small"
              color="error"
              sx={{ ml: 1, fontSize: 11 }}
            />
          )}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 0.75 }} divider={<Divider orientation="vertical" flexItem />}>
          <Typography variant="caption" color="text.secondary">
            Sell: <strong>{fmtRs(lub.sellingPrice)}</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Cost: <strong>{fmtRs(lub.purchasePrice)}</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Alert: <strong>&lt; {lub.minStockAlert}</strong>
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Button
            size="small"
            variant="contained"
            startIcon={<ShoppingCartOutlinedIcon />}
            onClick={onSell}
            sx={{ flex: 1 }}
          >
            Sell
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<InventoryOutlinedIcon />}
            onClick={onAddStock}
            sx={{ flex: 1 }}
          >
            Add stock
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}

// ── Sales history table ───────────────────────────────────────────────────────

function SalesHistoryTab(props: { lubricants: Lubricant[] }) {
  const { lubricants } = props;
  const [sales, setSales] = useState<LubricantSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(() => format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'));
  const [to, setTo] = useState(todayIso());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSales(await listLubricantSales(from, to));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const lubMap = Object.fromEntries(lubricants.map((l) => [l.id, l]));
  const total = sales.reduce((s, r) => s + r.totalAmount, 0);

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
        <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} size="small" sx={{ width: 170 }} />
        <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} size="small" sx={{ width: 170 }} />
        <Button variant="outlined" size="small" onClick={load}>Refresh</Button>
      </Stack>
      {loading ? (
        <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>
      ) : sales.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No sales in this period.</Typography>
      ) : (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell>Date</TableCell>
                <TableCell>Product</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Price/unit</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Vehicle</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sales.map((s) => {
                const lub = lubMap[s.lubricantId];
                return (
                  <TableRow key={s.id} hover>
                    <TableCell>{s.pumpDayIso}</TableCell>
                    <TableCell>{lub ? `${lub.name} (${lub.grade})` : s.lubricantId}</TableCell>
                    <TableCell align="right">
                      {s.quantity} {lub ? (LUBRICANT_UNIT_LABELS[lub.unit] ?? lub.unit) : ''}
                    </TableCell>
                    <TableCell align="right">{fmtRs(s.sellingPricePerUnit)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtRs(s.totalAmount)}</TableCell>
                    <TableCell>{s.customerName ?? '—'}</TableCell>
                    <TableCell>{s.vehicleNumber ?? '—'}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell colSpan={4} sx={{ fontWeight: 700 }}>Total</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtRs(total)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}

// ── Stock history table ───────────────────────────────────────────────────────

function StockHistoryTab(props: { lubricants: Lubricant[] }) {
  const { lubricants } = props;
  const [entries, setEntries] = useState<LubricantStockEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listLubricantStockEntries().then(setEntries).finally(() => setLoading(false));
  }, []);

  const lubMap = Object.fromEntries(lubricants.map((l) => [l.id, l]));

  return (
    <Box>
      {loading ? (
        <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>
      ) : entries.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No inward stock entries yet.</Typography>
      ) : (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell>Date</TableCell>
                <TableCell>Product</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Purchase price</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell>Invoice</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((e) => {
                const lub = lubMap[e.lubricantId];
                return (
                  <TableRow key={e.id} hover>
                    <TableCell>{e.pumpDayIso}</TableCell>
                    <TableCell>{lub ? lub.name : e.lubricantId}</TableCell>
                    <TableCell align="right">{e.quantity}</TableCell>
                    <TableCell align="right">{fmtRs(e.purchasePricePerUnit)}</TableCell>
                    <TableCell>{e.supplier ?? '—'}</TableCell>
                    <TableCell>{e.invoiceNo ?? '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function LubricantPage() {
  const [lubricants, setLubricants] = useState<Lubricant[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  // dialog state
  const [lubDialog, setLubDialog] = useState(false);
  const [editingLub, setEditingLub] = useState<Lubricant | null>(null);
  const [saleDialog, setSaleDialog] = useState(false);
  const [saleTarget, setSaleTarget] = useState<string | undefined>();
  const [stockDialog, setStockDialog] = useState(false);
  const [stockTarget, setStockTarget] = useState<string | undefined>();

  const reload = useCallback(() => {
    setLoading(true);
    listLubricants(false).then(setLubricants).finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const active = lubricants.filter((l) => l.isActive);
  const lowStock = active.filter((l) => l.currentStock <= l.minStockAlert);

  return (
    <Box>
      {/* Header */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Lubricants</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage lubricant stock, record sales and inward receipts.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => { setSaleTarget(undefined); setSaleDialog(true); }}
          >
            Record sale
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<InventoryOutlinedIcon />}
            onClick={() => { setStockTarget(undefined); setStockDialog(true); }}
          >
            Add stock
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => { setEditingLub(null); setLubDialog(true); }}
          >
            Add product
          </Button>
        </Stack>
      </Stack>

      {lowStock.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Low stock alert:{' '}
          {lowStock.map((l) => l.name).join(', ')} — please reorder.
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v as number)} sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="Stock overview" />
        <Tab label="Sales history" />
        <Tab label="Stock history" />
      </Tabs>

      {tab === 0 && (
        loading ? (
          <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box>
        ) : active.length === 0 ? (
          <Paper elevation={0} sx={{ p: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
            <Typography color="text.secondary">No lubricant products yet. Click "Add product" to get started.</Typography>
          </Paper>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            }}
          >
            {active.map((lub) => (
              <StockCard
                key={lub.id}
                lub={lub}
                onSell={() => { setSaleTarget(lub.id); setSaleDialog(true); }}
                onAddStock={() => { setStockTarget(lub.id); setStockDialog(true); }}
                onEdit={() => { setEditingLub(lub); setLubDialog(true); }}
              />
            ))}
          </Box>
        )
      )}

      {tab === 1 && <SalesHistoryTab lubricants={lubricants} />}
      {tab === 2 && <StockHistoryTab lubricants={lubricants} />}

      {/* Dialogs */}
      <LubricantFormDialog
        open={lubDialog}
        editing={editingLub}
        onClose={() => setLubDialog(false)}
        onSaved={reload}
      />
      <SaleDialog
        open={saleDialog}
        lubricants={active}
        defaultLubricantId={saleTarget}
        onClose={() => setSaleDialog(false)}
        onSaved={reload}
      />
      <StockInDialog
        open={stockDialog}
        lubricants={active}
        defaultLubricantId={stockTarget}
        onClose={() => setStockDialog(false)}
        onSaved={reload}
      />
    </Box>
  );
}
