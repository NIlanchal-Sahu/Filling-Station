import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { alpha, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import {
  getCashBankCollectionSummary,
  type CashBankCollectionSummary,
  type CollectionModeKey,
} from '@/services/collectionSummaryService';
import { SHIFT_SALES_UPDATED_EVENT } from '@/utils/shiftSalesDisplay';
import { SHIFT_STATUS_UPDATED_EVENT } from '@/utils/shiftStatusDisplay';
import { fmtInrCompact } from '@/components/dashboard/manager/dashboardPanelStyles';
import { withPumpDayQuery } from '@/utils/dateEntryPolicy';

const MODES: { key: CollectionModeKey; label: string; color: string }[] = [
  { key: 'cash', label: 'Cash', color: '#16a34a' },
  { key: 'upi', label: 'UPI', color: '#0284c7' },
  { key: 'card', label: 'Card', color: '#8b5cf6' },
  { key: 'fleet', label: 'Fleet Card', color: '#ea580c' },
  { key: 'credit', label: 'Credit Sales', color: '#d97706' },
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

  const maxModeAmount = useMemo(() => {
    if (!summary) return 1;
    return Math.max(...MODES.map((m) => summary[m.key].amount), 1);
  }, [summary]);

  if (loading) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3.5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          minHeight: 180,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <CircularProgress size={24} />
      </Paper>
    );
  }

  if (!summary) return null;

  return (
    <Paper
      id="collections"
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.25 },
        borderRadius: 3.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: (t) =>
          t.palette.mode === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
      }}
    >
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'text.secondary',
              fontSize: '0.68rem',
            }}
          >
            COLLECTIONS BREAKDOWN
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.success.main, 0.1),
              color: 'success.main',
            }}
          >
            <AccountBalanceOutlinedIcon sx={{ fontSize: 16 }} />
          </Box>
        </Stack>

        <Stack spacing={1.1}>
          {MODES.map(({ key, label, color }) => {
            const amount = summary[key].amount;
            const barWidthPercent =
              amount > 0 ? Math.max(3, Math.round((amount / maxModeAmount) * 100)) : 0;

            return (
              <Box key={key}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.35 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'text.secondary' }}>
                    {label}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem' }}
                  >
                    {fmtInrCompact(amount, 0)}
                  </Typography>
                </Stack>
                <Box
                  sx={{
                    width: '100%',
                    height: 6,
                    borderRadius: 1,
                    bgcolor: (t) => alpha(t.palette.divider, 0.6),
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      width: `${barWidthPercent}%`,
                      bgcolor: color,
                      borderRadius: 1,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </Box>
              </Box>
            );
          })}
        </Stack>
      </Box>

      <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
            Total Collection
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {fmtInrCompact(summary.totalCollection, 2)}
          </Typography>
        </Stack>
        <Button
          component={RouterLink}
          to={withPumpDayQuery('/manager/daily-sheet', pumpDayIso)}
          size="small"
          endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{
            mt: 1,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.82rem',
            p: 0,
            color: 'primary.main',
            '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
          }}
        >
          View Full Daily Sheet
        </Button>
      </Box>
    </Paper>
  );
}
