import { Link as RouterLink } from 'react-router-dom';
import { alpha, Box, Button, Paper, Stack, Typography } from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import { withPumpDayQuery } from '@/utils/dateEntryPolicy';

type Props = {
  pumpDayIso: string;
};

export function OwnerDetailedReports({ pumpDayIso }: Props) {
  const categories = [
    {
      title: 'Financial Reports',
      subtitle: 'Daily cash sheet, banking & expenses',
      to: withPumpDayQuery('/manager/daily-sheet', pumpDayIso),
      icon: AssessmentOutlinedIcon,
    },
    {
      title: 'Fuel & Inventory Reports',
      subtitle: 'Dip value register, tank history & purchases',
      to: withPumpDayQuery('/manager/fuel-stock/daily', pumpDayIso),
      icon: LocalGasStationOutlinedIcon,
    },
    {
      title: 'Employee Reports',
      subtitle: 'Attendant register, duties & pay summaries',
      to: withPumpDayQuery('/manager/attendant-sheet', pumpDayIso),
      icon: PeopleAltOutlinedIcon,
    },
    {
      title: 'Credit & Reconciliation',
      subtitle: 'Customer ledger, shift review & adjustments',
      to: '/manager/credit',
      icon: AccountBalanceWalletOutlinedIcon,
    },
  ];

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.25 },
        borderRadius: 3.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: (t) =>
          t.palette.mode === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.03)',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
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
          REPORTS & REGISTERS
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
          <DescriptionOutlinedIcon sx={{ fontSize: 16 }} />
        </Box>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 1.25,
        }}
      >
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <Paper
              key={cat.title}
              component={RouterLink}
              to={cat.to}
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: (t) =>
                  t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.04) : '#f8fafc',
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
                  transform: 'translateX(2px)',
                },
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                    color: 'primary.main',
                    flexShrink: 0,
                  }}
                >
                  <Icon sx={{ fontSize: 18 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }} noWrap>
                    {cat.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.72rem' }} noWrap>
                    {cat.subtitle}
                  </Typography>
                </Box>
              </Stack>
              <ArrowForwardOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary', ml: 1, flexShrink: 0 }} />
            </Paper>
          );
        })}
      </Box>

      <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Access complete archive, exportable registers and audits
        </Typography>
        <Button
          component={RouterLink}
          to="/manager/reports"
          size="small"
          endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.82rem',
            color: 'primary.main',
            p: 0,
            '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
          }}
        >
          View All Reports
        </Button>
      </Box>
    </Paper>
  );
}
