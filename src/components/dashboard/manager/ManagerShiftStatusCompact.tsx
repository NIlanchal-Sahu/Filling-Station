import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import { getShiftStatusForPumpDay, type ShiftStatusRow } from '@/services/shiftStatusService';
import { getTodaySalesByShift, type ShiftSalesBucket } from '@/services/aggregatesService';
import { usePermissions } from '@/hooks/usePermissions';
import {
  SHIFT_STATUS_UPDATED_EVENT,
  shiftActivityPath,
  shiftStatusChipColor,
  shiftStatusLabel,
} from '@/utils/shiftStatusDisplay';
import { SHIFT_SALES_UPDATED_EVENT } from '@/utils/shiftSalesDisplay';
import { fmtInrCompact, panelCardSx, panelTitleSx } from '@/components/dashboard/manager/dashboardPanelStyles';

function salesForRow(
  row: ShiftStatusRow,
  shift1: ShiftSalesBucket,
  shift2: ShiftSalesBucket,
): ShiftSalesBucket {
  if (row.slot === 'morning') return shift1;
  if (row.slot === 'evening') return shift2;
  return {
    shiftKey: 'shift2',
    displayName: row.displayName,
    shiftLabel: row.shiftLabel,
    totalAmount: 0,
    totalLiters: 0,
    transactionCount: 0,
    shiftId: null,
  };
}

function attendantLine(row: ShiftStatusRow): string {
  if (row.presentNames.length > 0) return row.presentNames.join(', ');
  if (row.attendant && row.attendant !== '—') return row.attendant;
  return '—';
}

type Props = {
  pumpDayIso: string;
};

export function ManagerShiftStatusCompact({ pumpDayIso }: Props) {
  const { role } = usePermissions();
  const [rows, setRows] = useState<ShiftStatusRow[]>([]);
  const [shift1, setShift1] = useState<ShiftSalesBucket | null>(null);
  const [shift2, setShift2] = useState<ShiftSalesBucket | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const day = new Date(`${pumpDayIso}T00:00:00`);
      const [status, sales] = await Promise.all([getShiftStatusForPumpDay(pumpDayIso), getTodaySalesByShift(day)]);
      setRows(status.rows);
      setShift1(sales.shift1);
      setShift2(sales.shift2);
    } finally {
      setLoading(false);
    }
  }, [pumpDayIso]);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener(SHIFT_STATUS_UPDATED_EVENT, refresh);
    window.addEventListener(SHIFT_SALES_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(SHIFT_STATUS_UPDATED_EVENT, refresh);
      window.removeEventListener(SHIFT_SALES_UPDATED_EVENT, refresh);
    };
  }, [load]);

  if (loading || !shift1 || !shift2) {
    return (
      <Box sx={{ ...panelCardSx, display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box id="shift-status" sx={panelCardSx}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography sx={panelTitleSx}>Shift status</Typography>
        <Button
          component={RouterLink}
          to={`/manager/shift-activity?day=${pumpDayIso}`}
          size="small"
          endIcon={<ArrowForwardOutlinedIcon />}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          View details
        </Button>
      </Stack>
      <Stack spacing={1.25}>
        {rows.map((row) => {
          const sales = salesForRow(row, shift1, shift2);
          const chipColor = shiftStatusChipColor(row.status);
          const detailTo = shiftActivityPath({ owner: role === 'owner', pumpDayIso, slot: row.slot });
          return (
            <Box
              key={row.slot}
              component={RouterLink}
              to={detailTo}
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
                minWidth: 0,
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    {row.displayName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {attendantLine(row)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Start {row.startTimeLabel !== '—' ? row.startTimeLabel : row.scheduledStartLabel}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={shiftStatusLabel(row.status)}
                  color={chipColor === 'default' ? 'default' : chipColor}
                  variant={chipColor === 'default' ? 'outlined' : 'filled'}
                  sx={{ height: 24, fontWeight: 600, flexShrink: 0 }}
                />
              </Stack>
              <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtInrCompact(sales.totalAmount, 2)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {sales.transactionCount.toLocaleString('en-IN')} transactions
                </Typography>
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
