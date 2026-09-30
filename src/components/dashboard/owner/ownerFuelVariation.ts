import { VARIATION_ALERT_LITERS } from '@/utils/fuelStockConstants';

import type { PumpDayOpeningVariationRow } from '@/services/pumpDayDipVariationService';

import { withPumpDayQuery } from '@/utils/dateEntryPolicy';



export type FuelVariationAlertLine = {

  shortCode: string;

  variationLiters: number;

  label: string;

};



export const FUEL_VARIATION_TAB_CODES = ['MS', 'HSD', 'XP'] as const;

export type FuelVariationTabCode = (typeof FUEL_VARIATION_TAB_CODES)[number];



export function collectFuelVariationAlerts(

  rows: PumpDayOpeningVariationRow[],

): FuelVariationAlertLine[] {

  const out: FuelVariationAlertLine[] = [];

  for (const row of rows) {

    if (

      row.variationAlert &&

      row.variationLiters != null &&

      Math.abs(row.variationLiters) >= VARIATION_ALERT_LITERS

    ) {

      out.push({

        shortCode: row.shortCode,

        variationLiters: row.variationLiters,

        label: `${row.shortCode}: ${formatPumpDayVariationLiters(row.variationLiters)}`,

      });

    }

  }

  return out;

}



export function fuelVariationReportPath(pumpDayIso: string): string {

  return withPumpDayQuery('/manager/reports?report=fuel-stock&kind=variation', pumpDayIso);

}

/** Daily dip page; with `fuelCode`, opens that fuel’s register chart (`view=register`). */
export function dailyDipEntryPath(
  pumpDayIso: string,
  fuelCode?: FuelVariationTabCode,
): string {
  const params = new URLSearchParams();
  if (fuelCode) {
    params.set('fuel', fuelCode);
    params.set('view', 'register');
  }
  const qs = params.toString();
  const path = qs ? `/manager/fuel-stock/daily?${qs}` : '/manager/fuel-stock/daily';
  return withPumpDayQuery(path, pumpDayIso);
}

/** Opens the monthly dip register report; optional fuel tab (MS / HSD / XP). */
export function dailyDipReportPath(pumpDayIso: string, fuelCode?: FuelVariationTabCode): string {
  if (fuelCode) {
    return dailyDipEntryPath(pumpDayIso, fuelCode);
  }
  return withPumpDayQuery('/manager/fuel-stock/daily?view=register', pumpDayIso);
}

export function pumpDayVariationLiters(

  rows: PumpDayOpeningVariationRow[],

  code: FuelVariationTabCode,

): number | null {

  const row = rows.find((r) => r.shortCode === code);

  return row?.variationLiters ?? null;

}



/** Matches Daily Dip Entry VARIATION column (one decimal). */

export function formatPumpDayVariationLiters(liters: number | null): string {

  if (liters == null || !Number.isFinite(liters)) return '—';

  const sign = liters > 0 ? '+' : '';

  const formatted = liters.toLocaleString('en-IN', {

    minimumFractionDigits: 0,

    maximumFractionDigits: 1,

  });

  return `${sign}${formatted} L`;

}



export function isPumpDayVariationAlert(

  rows: PumpDayOpeningVariationRow[],

  code: FuelVariationTabCode,

): boolean {

  const row = rows.find((r) => r.shortCode === code);

  if (!row?.variationAlert || row.variationLiters == null) return false;

  return Math.abs(row.variationLiters) >= VARIATION_ALERT_LITERS;

}


