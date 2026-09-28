import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import {
  getCashBankCollectionSummary,
  type CashBankCollectionSummary,
  type CollectionModeKey,
} from '@/services/collectionSummaryService';
import { SHIFT_SALES_UPDATED_EVENT } from '@/utils/shiftSalesDisplay';
import { SHIFT_STATUS_UPDATED_EVENT } from '@/utils/shiftStatusDisplay';
import { fmtInrCompact, panelCardSx, panelTitleSx } from '@/components/dashboard/manager/dashboardPanelStyles';

const MODES: { key: CollectionModeKey; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'upi', label: 'UPI' },
  { key: 'card', label: 'Card' },
  { key: 'fleet', label: 'Fleet card' },
  { key: 'credit', label: 'Credit sales' },
];

type Props = {
  pumpDayIso: string;
};

export function ManagerCollectionsSummary({ pumpDayIso }: Props) {
  const [summary, setSummary] = useState<CashBankCollectionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSummary(await getCashBankCollectionSummary(pumpDayIso, pumpDayIso));
    } finally {
      setLoading(false);
    }
  }, [pumpDayIso]);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener(SHIFT_SALES_UPDATED_EVENT, refresh);
    window.addEventListener(SHIFT_STATUS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(SHIFT_SALES_UPDATED_EVENT, refresh);
      window.removeEventListener(SHIFT_STATUS_UPDATED_EVENT, refresh);
    };
  }, [load]);

  if (loading) {
    return (
      <Box sx={{ ...panelCardSx, display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!summary) return null;

  return (
    <Box id="collections" sx={panelCardSx}>
      <Typography sx={{ ...panelTitleSx, mb: 1 }}>Collections today</Typography>
      <Typography variant="h5" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {fmtInrCompact(summary.totalCollection, 2)}
      </Typography>
      <Stack spacing={0.75} sx={{ mt: 1.5 }}>
        {MODES.map(({ key, label }) => {
          const bucket = summary[key];
          return (
            <Stack key={key} direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {fmtInrCompact(bucket.amount, 2)}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
      <Button
        component={RouterLink}
        to="/manager/daily-sheet"
        size="small"
        endIcon={<ArrowForwardOutlinedIcon />}
        sx={{ mt: 1.5, textTransform: 'none', fontWeight: 600, px: 0 }}
      >
        View full collection
      </Button>
    </Box>
  );
}
