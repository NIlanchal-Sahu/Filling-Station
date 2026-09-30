import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Paper, Stack, Typography, alpha } from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import { CREDIT_OVERDUE_DAYS, getOverdueCreditSummary } from '@/services/aggregatesService';
import { listCreditCustomers } from '@/services/creditCustomersService';
import { fmtInrCompact } from '@/components/dashboard/manager/dashboardPanelStyles';

export function ManagerCreditSummary() {
  const [loading, setLoading] = useState(true);
  const [outstanding, setOutstanding] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [overdueAmount, setOverdueAmount] = useState(0);

  useEffect(() => {
    let ok = true;
    void Promise.all([getOverdueCreditSummary(), listCreditCustomers(false)])
      .then(([overdue, customers]) => {
        if (!ok) return;
        setOutstanding(overdue.outstanding);
        setOverdueCount(overdue.overdueCount);
        setOverdueAmount(overdue.overdueAmount);
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
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3.5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Loading credit overview…
        </Typography>
      </Paper>
    );
  }

  const displayOutstanding = outstanding > 0 ? outstanding : overdueAmount;

  return (
    <Paper
      id="credit"
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
        <Stack direction="row" alignItems="center" justifyContent="space-between">
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
            CREDIT OVERVIEW
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
              color: 'primary.main',
            }}
          >
            <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 16 }} />
          </Box>
        </Stack>

        <Box sx={{ mt: 1.25 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              fontSize: { xs: '1.5rem', sm: '1.75rem' },
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            {fmtInrCompact(displayOutstanding, 0)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mt: 0.25 }}>
            Total Outstanding
          </Typography>
        </Box>

        <Box sx={{ mt: 1.5 }}>
          {overdueCount > 0 ? (
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main', flexShrink: 0 }} />
              <Typography variant="body2" sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                <Typography component="span" sx={{ fontWeight: 700, color: 'warning.dark', fontSize: '0.82rem' }}>
                  {overdueCount} {overdueCount === 1 ? 'party' : 'parties'}
                </Typography>{' '}
                • {CREDIT_OVERDUE_DAYS}+ days overdue ({fmtInrCompact(overdueAmount, 0)})
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
              {customerCount > 0
                ? `${customerCount} ${customerCount === 1 ? 'customer' : 'customers'} with balance`
                : 'All credit accounts current'}
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          component={RouterLink}
          to="/manager/credit"
          size="small"
          endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.82rem',
            p: 0,
            color: 'primary.main',
            '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
          }}
        >
          View Credit Ledger
        </Button>
      </Box>
    </Paper>
  );
}
