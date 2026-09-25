import Grid from '@mui/material/Grid2';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import { KpiStat } from '@/components/ui/KpiStat';
import { KpiStatSkeleton } from '@/components/ui/KpiStatSkeleton';
import type { DashboardKpiData } from '@/hooks/useDashboardKpis';

function fmtInr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** 3 cards per row on sm+ → two rows for six KPIs */
const KPI_GRID_SIZE = { xs: 6, sm: 4 } as const;
const KPI_GRID_ITEM_SX = {
  minWidth: 0,
  '@media (max-width:359.95px)': {
    flexBasis: '100%',
    maxWidth: '100%',
  },
} as const;

type Props = {
  loading: boolean;
  data: DashboardKpiData;
  showStartShift?: boolean;
};

export function DashboardKpiGrid({ loading, data, showStartShift = false }: Props) {
  if (loading) {
    return (
      <Grid container spacing={2} sx={{ width: '100%', minWidth: 0 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Grid key={i} size={KPI_GRID_SIZE} sx={KPI_GRID_ITEM_SX}>
            <KpiStatSkeleton />
          </Grid>
        ))}
      </Grid>
    );
  }

  const kpis = [
    {
      label: "Today's sales",
      value: fmtInr(data.salesTotal),
      icon: PaymentsOutlinedIcon,
      color: 'primary' as const,
      onClick: () => {
        document.getElementById('shift-performance')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      staggerIndex: 1,
    },
    {
      label: 'Cash in hand',
      value: fmtInr(data.cashInHand),
      icon: AccountBalanceWalletOutlinedIcon,
      color: 'success' as const,
      staggerIndex: 2,
    },
    {
      label: 'Credit outstanding',
      value: fmtInr(data.creditOutstanding),
      icon: CreditCardOutlinedIcon,
      color: 'secondary' as const,
      to: '/manager/credit',
      staggerIndex: 3,
    },
    {
      label: 'Open shifts',
      value: data.openShifts,
      icon: PlayCircleOutlineOutlinedIcon,
      color: 'success' as const,
      to: showStartShift ? '/shifts/new' : '/manager/reconciliations',
      staggerIndex: 4,
    },
    {
      label: 'Pending recon',
      value: data.pendingRecon,
      icon: FactCheckOutlinedIcon,
      color: 'warning' as const,
      to: '/manager/reconciliations',
      staggerIndex: 5,
    },
    {
      label: 'Low stock tanks',
      value: data.lowStock,
      icon: WarningAmberOutlinedIcon,
      color: 'error' as const,
      to: '/manager/fuel-stock/daily',
      staggerIndex: 6,
    },
  ];

  return (
    <Grid container spacing={2} sx={{ width: '100%', minWidth: 0 }}>
      {kpis.map((kpi) => (
        <Grid key={kpi.label} size={KPI_GRID_SIZE} sx={KPI_GRID_ITEM_SX}>
          <KpiStat
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            color={kpi.color}
            to={'to' in kpi ? kpi.to : undefined}
            onClick={'onClick' in kpi ? kpi.onClick : undefined}
            animateOnMount
            staggerIndex={kpi.staggerIndex}
          />
        </Grid>
      ))}
    </Grid>
  );
}
