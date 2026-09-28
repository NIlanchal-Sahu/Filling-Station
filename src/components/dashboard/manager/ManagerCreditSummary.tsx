import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { getOverdueCreditSummary } from '@/services/aggregatesService';
import { listCreditCustomers } from '@/services/creditCustomersService';
import { fmtInrCompact, panelCardSx, panelTitleSx } from '@/components/dashboard/manager/dashboardPanelStyles';

export function ManagerCreditSummary() {
  const [loading, setLoading] = useState(true);
  const [outstanding, setOutstanding] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    let ok = true;
    setLoading(true);
    void Promise.all([getOverdueCreditSummary(), listCreditCustomers(false)])
      .then(([overdue, customers]) => {
        if (!ok) return;
        setOutstanding(overdue.outstanding);
        setOverdueCount(overdue.overdueCount);
        setCustomerCount(customers.filter((c) => (c.currentBalance ?? 0) > 0.005).length);
      })
      .finally(() => {
        if (ok) setLoading(false);
      });
    return () => {
      ok = false;
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ ...panelCardSx, display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (outstanding <= 0.005) {
    return (
      <Box sx={panelCardSx}>
        <Stack direction="row" spacing={1} alignItems="center">
          <CheckCircleOutlineOutlinedIcon color="success" fontSize="small" />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            No outstanding credit
          </Typography>
        </Stack>
        <Button
          component={RouterLink}
          to="/manager/credit"
          size="small"
          endIcon={<ArrowForwardOutlinedIcon />}
          sx={{ mt: 1.25, textTransform: 'none', fontWeight: 600, px: 0 }}
        >
          View credit ledger
        </Button>
      </Box>
    );
  }

  return (
    <Box id="credit" sx={panelCardSx}>
      <Typography sx={{ ...panelTitleSx, mb: 1 }}>Credit outstanding</Typography>
      <Typography variant="h5" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {fmtInrCompact(outstanding, 2)}
      </Typography>
      <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {customerCount} {customerCount === 1 ? 'customer' : 'customers'}
        </Typography>
        {overdueCount > 0 ? (
          <Typography variant="body2" color="warning.main" sx={{ fontWeight: 600 }}>
            {overdueCount} overdue
          </Typography>
        ) : null}
      </Stack>
      <Button
        component={RouterLink}
        to="/manager/credit"
        size="small"
        endIcon={<ArrowForwardOutlinedIcon />}
        sx={{ mt: 1.5, textTransform: 'none', fontWeight: 600, px: 0 }}
      >
        View credit ledger
      </Button>
    </Box>
  );
}
