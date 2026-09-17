import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  alpha,
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { getSalesByFuelForRange } from '@/services/aggregatesService';
import { getCashBankCollectionSummary } from '@/services/collectionSummaryService';
import { FUEL_CHART_COLORS } from '@/utils/fuelSalesChartDisplay';
import { COLLECTION_MODE_COLORS } from '@/utils/collectionSummaryConstants';
import type { CollectionModeKey } from '@/services/collectionSummaryService';

function fmtRs(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function buildConicGradient(
  slices: { pct: number; color: string }[],
): string {
  let cursor = 0;
  const parts: string[] = [];
  for (const slice of slices) {
    if (slice.pct <= 0) continue;
    const deg = slice.pct * 3.6;
    const end = cursor + deg;
    parts.push(`${slice.color} ${cursor}deg ${end}deg`);
    cursor = end;
  }
  if (parts.length === 0) {
    return `conic-gradient(${alpha('#90a4ae', 0.35)} 0deg 360deg)`;
  }
  return `conic-gradient(${parts.join(', ')})`;
}

function DonutChart(props: {
  title: string;
  centerLabel: string;
  centerValue: string;
  gradient: string;
  legend: { label: string; pct: number; color: string; amount?: string }[];
  emptyMessage?: string;
}) {
  const { title, centerLabel, centerValue, gradient, legend, emptyMessage } = props;
  const hasData = legend.some((l) => l.pct > 0);

  return (
    <Card
      elevation={0}
      sx={{
        p: 2.5,
        height: '100%',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
        {title}
      </Typography>
      {!hasData && emptyMessage ? (
        <Alert severity="info" sx={{ borderRadius: 2, fontSize: '0.85rem' }}>
          {emptyMessage}
        </Alert>
      ) : (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems="center">
          <Box sx={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
            <Box sx={{ width: '100%', height: '100%', borderRadius: '50%', background: gradient }} />
            <Box
              sx={{
                position: 'absolute',
                inset: '24%',
                borderRadius: '50%',
                bgcolor: 'background.paper',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                textAlign: 'center',
                px: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {centerLabel}
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {centerValue}
              </Typography>
            </Box>
          </Box>
          <Stack spacing={1} sx={{ flex: 1, width: '100%' }}>
            {legend.map((item) => (
              <Stack key={item.label} direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color, flexShrink: 0 }} />
                  <Typography variant="body2" noWrap>
                    {item.label}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                  {item.amount ? (
                    <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {item.amount}
                    </Typography>
                  ) : null}
                  <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 44, textAlign: 'right' }}>
                    {item.pct.toFixed(0)}%
                  </Typography>
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Stack>
      )}
    </Card>
  );
}

const COLLECTION_LABELS: Record<CollectionModeKey, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  credit: 'Credit',
  fleet: 'Fleet',
};

export function DashboardInsightsPanel(props: { pumpDayIso: string }) {
  const { pumpDayIso } = props;
  const [loading, setLoading] = useState(true);
  const [fuelTotal, setFuelTotal] = useState(0);
  const [fuelRows, setFuelRows] = useState<{ label: string; pct: number; color: string; amount: string }[]>([]);
  const [collectionTotal, setCollectionTotal] = useState(0);
  const [collectionRows, setCollectionRows] = useState<{ label: string; pct: number; color: string; amount: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fuelData, collectionData] = await Promise.all([
        getSalesByFuelForRange(pumpDayIso, pumpDayIso),
        getCashBankCollectionSummary(pumpDayIso, pumpDayIso),
      ]);

      setFuelTotal(fuelData.totalAmount);
      setFuelRows(
        fuelData.rows.map((row) => ({
          label: row.shortCode,
          pct: row.contributionPercent,
          color: FUEL_CHART_COLORS[row.shortCode] ?? '#1976d2',
          amount: fmtRs(row.amount),
        })),
      );

      setCollectionTotal(collectionData.totalCollection);
      const modes: CollectionModeKey[] = ['cash', 'upi', 'card', 'credit', 'fleet'];
      setCollectionRows(
        modes.map((key) => ({
          label: COLLECTION_LABELS[key],
          pct: collectionData.donutPercents[key],
          color: COLLECTION_MODE_COLORS[key],
          amount: fmtRs(collectionData[key].amount),
        })),
      );
    } catch {
      setFuelTotal(0);
      setFuelRows([]);
      setCollectionTotal(0);
      setCollectionRows([]);
    } finally {
      setLoading(false);
    }
  }, [pumpDayIso]);

  useEffect(() => {
    void load();
  }, [load]);

  const fuelGradient = useMemo(
    () => buildConicGradient(fuelRows.map((r) => ({ pct: r.pct, color: r.color }))),
    [fuelRows],
  );
  const collectionGradient = useMemo(
    () => buildConicGradient(collectionRows.map((r) => ({ pct: r.pct, color: r.color }))),
    [collectionRows],
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          component={RouterLink}
          to="/manager/reports"
          size="small"
          variant="text"
          endIcon={<OpenInNewOutlinedIcon />}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          All reports
        </Button>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        }}
      >
        <DonutChart
          title="Sales mix by fuel"
          centerLabel="Total sales"
          centerValue={fmtRs(fuelTotal)}
          gradient={fuelGradient}
          legend={fuelRows}
          emptyMessage="No reconciled fuel sales yet. Complete shift reconciliation to see the mix."
        />
        <DonutChart
          title="Collections by payment mode"
          centerLabel="Collected"
          centerValue={fmtRs(collectionTotal)}
          gradient={collectionGradient}
          legend={collectionRows}
          emptyMessage="No collections recorded yet. Reconcile shifts to populate payment breakdown."
        />
      </Box>
    </Stack>
  );
}
