import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { alpha, Box, Button, Stack, Typography } from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import { CREDIT_OVERDUE_DAYS, getOverdueCreditSummary } from '@/services/aggregatesService';
import { fmtInrCompact, panelCardSx, panelTitleSx } from '@/components/dashboard/owner/ownerPanelStyles';

export function OwnerCreditAttention() {
  const [loading, setLoading] = useState(true);
  const [overdueAmount, setOverdueAmount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [outstanding, setOutstanding] = useState(0);

  useEffect(() => {
    let ok = true;
    void getOverdueCreditSummary()
      .then((c) => {
        if (!ok) return;
        setOverdueAmount(c.overdueAmount);
        setOverdueCount(c.overdueCount);
        setOutstanding(c.outstanding);
      })
      .finally(() => {
        if (ok) setLoading(false);
      });
    return () => {
      ok = false;
    };
  }, []);

  if (loading) return null;

  if (overdueCount <= 0) {
    return (
      <Box sx={panelCardSx}>
        <Typography sx={panelTitleSx}>Credit &amp; receivables</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          No parties overdue beyond {CREDIT_OVERDUE_DAYS} days.
          {outstanding > 0.005 ? ` Total outstanding ${fmtInrCompact(outstanding, 0)}.` : ''}
        </Typography>
        <Button
          component={RouterLink}
          to="/manager/credit"
          size="small"
          endIcon={<ArrowForwardOutlinedIcon />}
          sx={{ mt: 1.25, textTransform: 'none', fontWeight: 600, px: 0 }}
        >
          Review credit
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        ...panelCardSx,
        borderColor: (t) => alpha(t.palette.warning.main, 0.55),
        bgcolor: (t) => alpha(t.palette.warning.main, t.palette.mode === 'dark' ? 0.14 : 0.08),
      }}
    >
      <Typography sx={{ ...panelTitleSx, color: 'warning.dark' }}>Credit attention</Typography>
      <Typography variant="h4" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', mt: 0.75 }}>
        {fmtInrCompact(overdueAmount, 0)}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mt: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {overdueCount} {overdueCount === 1 ? 'party' : 'parties'} overdue
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Unpaid {CREDIT_OVERDUE_DAYS}+ days
        </Typography>
      </Stack>
      {outstanding > overdueAmount + 0.005 ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          Total outstanding {fmtInrCompact(outstanding, 0)}
        </Typography>
      ) : null}
      <Button
        component={RouterLink}
        to="/manager/credit"
        variant="contained"
        color="warning"
        size="small"
        endIcon={<ArrowForwardOutlinedIcon />}
        sx={{ mt: 1.5, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
      >
        Review credit
      </Button>
    </Box>
  );
}
