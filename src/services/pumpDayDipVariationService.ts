import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns';

import { getMeterSalesLitersByPumpDayInRange } from '@/services/fuelStockReconciliationService';
import {
  getPriorDayClosingBookLiters,
  listDipValueLedgerForDay,
  listDipValueLedgerInRange,
} from '@/services/dipValueLedgerService';
import {
  aggregateFuelReceiptLitersByPumpDay,
  listFuelReceiptsInRange,
} from '@/services/fuelReceiptsService';
import { listFuelTypes } from '@/services/fuelTypesService';
import {
  computeOpeningVariationLiters,
  priorCalendarDayClosingLiters,
} from '@/utils/dipValueRegister';
import { FUEL_STOCK_SORT_ORDER, fuelStockDisplayMeta } from '@/utils/fuelStockDisplay';
import { VARIATION_ALERT_LITERS } from '@/utils/fuelStockConstants';

export type PumpDayOpeningVariationRow = {
  fuelTypeId: string;
  shortCode: string;
  variationLiters: number | null;
  variationAlert: boolean;
};

function monthRangeForPumpDay(pumpDayIso: string): { start: string; end: string } {
  const d = parseISO(`${pumpDayIso}T12:00:00`);
  return {
    start: format(startOfMonth(d), 'yyyy-MM-dd'),
    end: format(endOfMonth(d), 'yyyy-MM-dd'),
  };
}

/** Same pump-day opening variation as Daily Dip Entry “Today’s entry” VARIATION column. */
export async function getPumpDayOpeningVariationByFuel(
  pumpDayIso: string,
): Promise<PumpDayOpeningVariationRow[]> {
  const fuels = await listFuelTypes();
  const tankFuels = fuels.filter((f) => f.tankCapacityLiters != null && f.tankCapacityLiters > 0);
  const { start, end } = monthRangeForPumpDay(pumpDayIso);

  const [dayLedgers, ledgerEntries, meterSalesByDay, fuelReceiptsInMonth] = await Promise.all([
    listDipValueLedgerForDay(pumpDayIso),
    listDipValueLedgerInRange(start, end),
    getMeterSalesLitersByPumpDayInRange(start, end),
    listFuelReceiptsInRange(start, end),
  ]);

  const purchaseReceiptByDay = aggregateFuelReceiptLitersByPumpDay(fuelReceiptsInMonth);
  const ledgerMap = new Map(dayLedgers.map((l) => [l.fuelTypeId, l]));

  const byCode = new Map<string, PumpDayOpeningVariationRow>();

  await Promise.all(
    tankFuels.map(async (f) => {
      const ledger = ledgerMap.get(f.id);
      const opening = ledger?.openingStockLiters;
      const meta = fuelStockDisplayMeta(f.name);

      let priorClosing = priorCalendarDayClosingLiters(
        ledgerEntries.filter((e) => e.fuelTypeId === f.id),
        pumpDayIso,
        meterSalesByDay,
        purchaseReceiptByDay,
      );
      if (priorClosing == null) {
        priorClosing = await getPriorDayClosingBookLiters(f.id, pumpDayIso);
      }

      const variationLiters =
        opening != null && Number.isFinite(opening)
          ? computeOpeningVariationLiters(opening, priorClosing)
          : null;

      const variationAlert =
        variationLiters != null && Math.abs(variationLiters) >= VARIATION_ALERT_LITERS;

      byCode.set(meta.shortCode, {
        fuelTypeId: f.id,
        shortCode: meta.shortCode,
        variationLiters,
        variationAlert,
      });
    }),
  );

  const out: PumpDayOpeningVariationRow[] = [];
  for (const code of FUEL_STOCK_SORT_ORDER) {
    const row = byCode.get(code);
    if (row) out.push(row);
  }
  for (const row of byCode.values()) {
    if (!FUEL_STOCK_SORT_ORDER.includes(row.shortCode as (typeof FUEL_STOCK_SORT_ORDER)[number])) {
      out.push(row);
    }
  }
  return out;
}
