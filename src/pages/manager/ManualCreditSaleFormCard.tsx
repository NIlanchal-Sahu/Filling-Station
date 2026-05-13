import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';
import { format } from 'date-fns';
import { alpha } from '@mui/material/styles';
import { createManualCreditSale } from '@/services/creditSalesService';
import { listFuelTypes } from '@/services/fuelTypesService';
import { requireMin } from '@/utils/validation';
import { creditSheetBodyCellSx, creditSheetHeaderCellSx } from '@/pages/manager/manualCreditSaleFormStyles';

type FixedParty = {
  mode: 'fixed';
  customerId: string;
  partyDisplayName: string;
};

type PickParty = {
  mode: 'pickCustomer';
  customers: Array<{ id: string; name: string }>;
  customerId: string;
  onCustomerIdChange: (id: string) => void;
};

export type ManualCreditSaleFormCardProps = {
  onSuccess: () => Promise<void>;
} & (FixedParty | PickParty);

/** Ledger-style posting row — matches manager credit workbook layout. */
export function ManualCreditSaleFormCard(props: ManualCreditSaleFormCardProps) {
  const { onSuccess } = props;
  const [fuels, setFuels] = useState<Array<{ id: string; name: string; currentRate: number }>>([]);
  const [fuelsErr, setFuelsErr] = useState<string | null>(null);
  const [saleErr, setSaleErr] = useState<string | null>(null);
  const [savingSale, setSavingSale] = useState(false);

  const [saleDate, setSaleDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [fuelTypeId, setFuelTypeId] = useState('');
  const [liters, setLiters] = useState('');
  const [rate, setRate] = useState('');

  const fuelMap = useMemo(() => new Map(fuels.map((f) => [f.id, f])), [fuels]);

  const computedAmount = useMemo(() => {
    const lt = Number(liters);
    const rt = Number(rate);
    if (Number.isNaN(lt) || Number.isNaN(rt)) {
      return 0;
    }
    return Math.round((lt * rt + Number.EPSILON) * 100) / 100;
  }, [liters, rate]);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const list = await listFuelTypes();
        if (!ok) {
          return;
        }
        list.sort((a, b) => a.name.localeCompare(b.name));
        setFuels(list.map((u) => ({ id: u.id, name: u.name, currentRate: u.currentRate })));
        setFuelsErr(null);
      } catch {
        if (ok) {
          setFuelsErr('Could not load fuel types; add fuels under Fuel prices first.');
        }
      }
    })();
    return () => {
      ok = false;
    };
  }, []);

  useEffect(() => {
    if (fuels.length && !fuelTypeId) {
      setFuelTypeId(fuels[0]!.id);
    }
  }, [fuels, fuelTypeId]);

  useEffect(() => {
    if (!fuelTypeId) {
      return;
    }
    const f = fuelMap.get(fuelTypeId);
    if (f) {
      setRate(String(f.currentRate));
    }
  }, [fuelTypeId, fuelMap]);

  async function submitCreditSale(e: React.FormEvent) {
    e.preventDefault();
    setSaleErr(null);

    const cid =
      props.mode === 'fixed' ? props.customerId.trim() : String(props.customerId || '').trim();
    if (props.mode === 'pickCustomer' && !cid) {
      setSaleErr('Choose party name.');
      return;
    }

    const ltErr = requireMin(liters, 0, 'Liters');
    const rtErr = requireMin(rate, 0, 'Rate');
    if (!fuelTypeId) {
      setSaleErr('Choose a fuel type.');
      return;
    }
    if (ltErr || rtErr) {
      setSaleErr(ltErr || rtErr || null);
      return;
    }
    const ltVal = Number(liters);
    const rtVal = Number(rate);
    if (Number.isNaN(ltVal) || ltVal <= 0) {
      setSaleErr('Enter liters greater than zero.');
      return;
    }
    if (Number.isNaN(rtVal) || rtVal <= 0) {
      setSaleErr('Enter rate greater than zero.');
      return;
    }
    if (computedAmount <= 0) {
      setSaleErr('Amount must be positive.');
      return;
    }

    setSavingSale(true);
    try {
      await createManualCreditSale({
        customerId: cid,
        date: new Date(`${saleDate}T12:00:00`),
        fuelTypeId,
        liters: ltVal,
        rateAtSale: rtVal,
      });
      setLiters('');
      await onSuccess();
    } catch (er) {
      setSaleErr(er instanceof Error ? er.message : 'Save failed');
    } finally {
      setSavingSale(false);
    }
  }

  const partyDisabled = props.mode === 'pickCustomer' && props.customers.length === 0;

  return (
    <Card
      elevation={0}
      component="form"
      onSubmit={submitCreditSale}
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s ease',
        '&:hover': { boxShadow: (t) => `0 8px 24px ${alpha(t.palette.common.black, 0.06)}` },
      }}
    >
      <Box sx={{ height: 3, bgcolor: 'primary.main' }} />
      <CardContent sx={{ pt: 2.5 }}>
        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.5 }}>
          <PlaylistAddOutlinedIcon color="primary" sx={{ mt: 0.25 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Add credit sale
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Post litres × rate to raise the party balance (same entries flow into the ledger and register).
            </Typography>
          </Box>
        </Stack>

        {fuelsErr && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {fuelsErr}
          </Alert>
        )}
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ maxWidth: '100%', overflowX: 'auto', borderRadius: 1.5 }}
        >
          <Table size="small" sx={{ minWidth: 720, borderCollapse: 'collapse' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...creditSheetHeaderCellSx, minWidth: 120 }}>Date</TableCell>
                <TableCell sx={{ ...creditSheetHeaderCellSx, minWidth: 140 }}>Party</TableCell>
                <TableCell sx={{ ...creditSheetHeaderCellSx, minWidth: 140 }}>Fuel</TableCell>
                <TableCell sx={{ ...creditSheetHeaderCellSx, minWidth: 72 }} align="right">
                  Litres
                </TableCell>
                <TableCell sx={{ ...creditSheetHeaderCellSx, minWidth: 88 }} align="right">
                  ₹ / L
                </TableCell>
                <TableCell sx={{ ...creditSheetHeaderCellSx, minWidth: 96 }} align="right">
                  Amount
                </TableCell>
                <TableCell sx={{ ...creditSheetHeaderCellSx, minWidth: 88 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell sx={creditSheetBodyCellSx}>
                  <TextField
                    type="date"
                    value={saleDate}
                    onChange={(ev) => setSaleDate(ev.target.value)}
                    size="small"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </TableCell>
                <TableCell sx={creditSheetBodyCellSx}>
                  {props.mode === 'fixed' ? (
                    <Typography variant="body2" sx={{ pt: 0.75, fontWeight: 600 }}>
                      {props.partyDisplayName}
                    </Typography>
                  ) : (
                    <TextField
                      select
                      value={props.customerId}
                      onChange={(ev) => props.onCustomerIdChange(ev.target.value)}
                      size="small"
                      fullWidth
                      label="Party"
                      disabled={partyDisabled}
                      slotProps={{ inputLabel: { shrink: true } }}
                    >
                      {props.customers.map((cust) => (
                        <MenuItem key={cust.id} value={cust.id}>
                          {cust.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                </TableCell>
                <TableCell sx={creditSheetBodyCellSx}>
                  <TextField
                    select
                    value={fuelTypeId}
                    onChange={(ev) => setFuelTypeId(ev.target.value)}
                    size="small"
                    fullWidth
                    disabled={!fuels.length}
                    label="Fuel"
                    slotProps={{ inputLabel: { shrink: !!fuelTypeId } }}
                  >
                    {fuels.map((f) => (
                      <MenuItem key={f.id} value={f.id}>
                        {f.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell sx={creditSheetBodyCellSx}>
                  <TextField
                    size="small"
                    type="number"
                    value={liters}
                    onChange={(ev) => setLiters(ev.target.value)}
                    fullWidth
                    inputProps={{ min: 0, step: '0.001' }}
                  />
                </TableCell>
                <TableCell sx={creditSheetBodyCellSx}>
                  <TextField
                    size="small"
                    type="number"
                    value={rate}
                    onChange={(ev) => setRate(ev.target.value)}
                    fullWidth
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </TableCell>
                <TableCell sx={{ ...creditSheetBodyCellSx, pt: 1.75 }} align="right">
                  <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    ₹{computedAmount.toFixed(2)}
                  </Typography>
                </TableCell>
                <TableCell sx={creditSheetBodyCellSx}>
                  <Button
                    type="submit"
                    size="small"
                    variant="contained"
                    disabled={savingSale || !fuels.length || partyDisabled}
                    sx={{ borderRadius: 1.25 }}
                  >
                    Post
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        {saleErr && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {saleErr}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
