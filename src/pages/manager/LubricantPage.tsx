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
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { FilterToolbar } from '@/components/ui/FilterToolbar';
import { PageHeader } from '@/components/ui/PageHeader';
import type { Lubricant, LubricantSale, LubricantStockEntry } from '@/types/entities';
import { LUBRICANT_UNIT_LABELS } from '@/types/entities';
import {
  listLubricants,
  createLubricant,
  updateLubricant,
  addLubricantSale,
  listLubricantSales,
  addLubricantStock,
  listLubricantStockEntries,
} from '@/services/lubricantService';
import { useAuth } from '@/context/AuthContext';
import {
  assertEntryDateAllowed,
  clampEntryDateForRole,
  dateInputBoundsForRole,
  todayIso,
} from '@/utils/dateEntryPolicy';

function fmtRs(v: number) {
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function findLubricantByName(lubricants: Lubricant[], name: string): Lubricant | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return lubricants.find((l) => l.name.trim().toLowerCase() === key);
}

function lubricantNameForId(lubricants: Lubricant[], id?: string): string {
  if (!id) return '';
  return lubricants.find((l) => l.id === id)?.name ?? '';
}

// ── Add/Edit Lubricant Dialog ─────────────────────────────────────────────────

interface LubricantFormState {
  name: string;
  unit: string;
  sellingPrice: string;
  purchasePrice: string;
  minStockAlert: string;
}

const emptyLubForm = (): LubricantFormState => ({
  name: '',
  unit: '',
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
        brand: '',
        grade: '',
        unit: form.unit.trim(),
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
          <TextField
            label="Product name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            fullWidth
            required
            size="small"
            autoFocus
            autoComplete="off"
          />
          <TextField
            label="Unit"
            value={form.unit}
            onChange={(e) => set('unit', e.target.value)}
            fullWidth
            size="small"
            autoComplete="off"
          />
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
  const { profile } = useAuth();
  const dateBounds = dateInputBoundsForRole(profile?.role);
  const [productName, setProductName] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [customer, setCustomer] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [date, setDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    const name = lubricantNameForId(lubricants, defaultLubricantId);
    setProductName(name);
    setQty('1');
    setErr('');
    setCustomer('');
    setVehicle('');
    setDate(todayIso());
    const lub = findLubricantByName(lubricants, name);
    setPrice(lub ? String(lub.sellingPrice) : '');
  }, [open, defaultLubricantId, lubricants]);

  const selected = findLubricantByName(lubricants, productName);

  useEffect(() => {
    if (!open) return;
    if (selected) setPrice(String(selected.sellingPrice));
  }, [open, selected]);

  async function handleSave() {
    if (!productName.trim()) { setErr('Type the product name.'); return; }
    const q = parseFloat(qty);
    if (!q || q <= 0) { setErr('Enter a valid quantity.'); return; }
    const lub = findLubricantByName(lubricants, productName);
    if (!lub) {
      setErr(`No product named “${productName.trim()}”. Add it first with Add product.`);
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const day = clampEntryDateForRole(profile?.role, date);
      assertEntryDateAllowed(profile?.role, day);
      await addLubricantSale({
        lubricantId: lub.id,
        pumpDayIso: day,
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

  const total = (parseFloat(qty) || 0) * (parseFloat(price) || 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Record Sale</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <TextField
            label="Date"
            value={date}
            onChange={(e) => setDate(clampEntryDateForRole(profile?.role, e.target.value))}
            size="small"
            type="date"
            fullWidth
            slotProps={{ htmlInput: { min: dateBounds.min, max: dateBounds.max } }}
          />
          <TextField
            label="Product name"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            size="small"
            fullWidth
            required
            autoComplete="off"
          />
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
  const { profile } = useAuth();
  const dateBounds = dateInputBoundsForRole(profile?.role);
  const [productName, setProductName] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [supplier, setSupplier] = useState('');
  const [invoice, setInvoice] = useState('');
  const [date, setDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    const name = lubricantNameForId(lubricants, defaultLubricantId);
    setProductName(name);
    setQty('');
    setErr('');
    setSupplier('');
    setInvoice('');
    setDate(todayIso());
    const lub = findLubricantByName(lubricants, name);
    setPrice(lub ? String(lub.purchasePrice) : '');
  }, [open, defaultLubricantId, lubricants]);

  const selected = findLubricantByName(lubricants, productName);

  useEffect(() => {
    if (!open) return;
    if (selected) setPrice(String(selected.purchasePrice));
  }, [open, selected]);

  async function handleSave() {
    const name = productName.trim();
    if (!name) { setErr('Type the product name.'); return; }
    const q = parseFloat(qty);
    if (!q || q <= 0) { setErr('Enter a valid quantity.'); return; }
    setSaving(true);
    setErr('');
    try {
      const day = clampEntryDateForRole(profile?.role, date);
      assertEntryDateAllowed(profile?.role, day);
      let lub = findLubricantByName(lubricants, name);
      if (!lub) {
        const purchasePrice = parseFloat(price) || 0;
        const id = await createLubricant({
          name,
          brand: '',
          grade: '',
          unit: 'litre',
          sellingPrice: purchasePrice,
          purchasePrice,
          minStockAlert: 5,
          isActive: true,
        });
        lub = { id, name, brand: '', grade: '', unit: 'litre', sellingPrice: purchasePrice, purchasePrice, minStockAlert: 5, isActive: true, currentStock: 0 };
      }
      await addLubricantStock({
        lubricantId: lub.id,
        pumpDayIso: day,
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
          <TextField
            label="Date"
            value={date}
            onChange={(e) => setDate(clampEntryDateForRole(profile?.role, e.target.value))}
            size="small"
            type="date"
            fullWidth
            slotProps={{ htmlInput: { min: dateBounds.min, max: dateBounds.max } }}
          />
          <TextField
            label="Product name"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            size="small"
            fullWidth
            required
            autoComplete="off"
            autoFocus={!defaultLubricantId}
          />
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
  onRemove: () => void;
}) {
  const { lub, onSell, onAddStock, onEdit, onRemove } = props;
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

        <Stack spacing={1} sx={{ mt: 1.5 }}>
          <Stack direction="row" spacing={1}>
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
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineOutlinedIcon />}
            onClick={onRemove}
          >
            Remove
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
      <FilterToolbar sx={{ mb: 2 }}>
        <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} size="small" sx={{ width: 170 }} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} size="small" sx={{ width: 170 }} slotProps={{ inputLabel: { shrink: true } }} />
        <Button variant="outlined" size="small" onClick={load} sx={{ minHeight: 48, alignSelf: { xs: 'stretch', sm: 'auto' } }}>Refresh</Button>
      </FilterToolbar>
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
                    <TableCell>{lub ? lub.name : s.lubricantId}</TableCell>
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
  const [removeTarget, setRemoveTarget] = useState<Lubricant | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeErr, setRemoveErr] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    listLubricants(false).then(setLubricants).finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const active = lubricants.filter((l) => l.isActive);
  const lowStock = active.filter((l) => l.currentStock <= l.minStockAlert);

  return (
    <Box>
      <PageHeader
        sx={{ mb: 3 }}
        title="Lubricants"
        action={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => { setSaleTarget(undefined); setSaleDialog(true); }}
              sx={{ minHeight: 48 }}
            >
              Record sale
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<InventoryOutlinedIcon />}
              onClick={() => { setStockTarget(undefined); setStockDialog(true); }}
              sx={{ minHeight: 48 }}
            >
              Add stock
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => { setEditingLub(null); setLubDialog(true); }}
              sx={{ minHeight: 48 }}
            >
              Add product
            </Button>
          </Stack>
        }
      />

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
                onRemove={() => { setRemoveErr(null); setRemoveTarget(lub); }}
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
      <Dialog
        open={removeTarget != null}
        onClose={() => { if (!removing) setRemoveTarget(null); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Remove lubricant</DialogTitle>
        <DialogContent>
          {removeErr ? <Alert severity="error" sx={{ mb: 1 }}>{removeErr}</Alert> : null}
          <Typography>
            Remove {removeTarget ? <strong>{removeTarget.name}</strong> : 'this product'}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveTarget(null)} disabled={removing}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={removing}
            onClick={async () => {
              if (!removeTarget) return;
              setRemoving(true);
              setRemoveErr(null);
              try {
                await updateLubricant(removeTarget.id, { isActive: false });
                setRemoveTarget(null);
                reload();
              } catch (e) {
                setRemoveErr(e instanceof Error ? e.message : 'Remove failed');
              } finally {
                setRemoving(false);
              }
            }}
          >
            {removing ? <CircularProgress size={18} /> : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
