import { useEffect, useState } from 'react';
import {
  getCashInHandAfterReconciliations,
  getTodaySalesByFuelType,
  getTotalOutstandingCredit,
} from '@/services/aggregatesService';
import { getFuelStockOverview } from '@/services/fuelStockService';
import { getShiftStatusForPumpDay } from '@/services/shiftStatusService';

export type DashboardKpiData = {
  salesTotal: number;
  openShifts: number;
  pendingRecon: number;
  lowStock: number;
  creditOutstanding: number;
  cashInHand: number;
};

const EMPTY: DashboardKpiData = {
  salesTotal: 0,
  openShifts: 0,
  pendingRecon: 0,
  lowStock: 0,
  creditOutstanding: 0,
  cashInHand: 0,
};

export function useDashboardKpis(pumpDayIso: string) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardKpiData>(EMPTY);

  useEffect(() => {
    let ok = true;
    setLoading(true);
    void (async () => {
      try {
        const [sales, shiftStatus, stock, credit, cashInHand] = await Promise.all([
          getTodaySalesByFuelType(),
          getShiftStatusForPumpDay(pumpDayIso),
          getFuelStockOverview(),
          getTotalOutstandingCredit(),
          getCashInHandAfterReconciliations(),
        ]);
        if (!ok) {
          return;
        }
        setData({
          salesTotal: sales.reduce((sum, row) => sum + row.amount, 0),
          openShifts: shiftStatus.totals.active,
          pendingRecon: shiftStatus.totals.pendingReconciliation,
          lowStock: stock.items.filter((i) => i.health === 'low' || i.health === 'critical').length,
          creditOutstanding: credit,
          cashInHand,
        });
      } catch {
        if (ok) {
          setData(EMPTY);
        }
      } finally {
        if (ok) {
          setLoading(false);
        }
      }
    })();
    return () => {
      ok = false;
    };
  }, [pumpDayIso]);

  return { loading, data };
}
