import { addDays, format, parseISO } from 'date-fns';

import { listReadingsForShift } from '@/services/shiftReadingsService';
import { getNozzle } from '@/services/nozzlesService';
import { listFuelTypes } from '@/services/fuelTypesService';
import { listClosedShiftsByPumpDayRange } from '@/services/shiftsService';
import { listFuelTankDipsInRange } from '@/services/fuelStockService';
import { sumFuelReceiptLitersForDay } from '@/services/fuelReceiptsService';
import type {
  DailyFuelStockRow,
  DipKind,
  FuelTankDipReading,
  FuelType,
  TankStockDaySummary,
} from '@/types/entities';
import { VARIATION_ALERT_LITERS } from '@/utils/fuelStockConstants';
import {
  fuelStockDisplayMeta,
  fuelStockHealthFromPercent,
  FUEL_STOCK_SORT_ORDER,
} from '@/utils/fuelStockDisplay';
import { canonicalDipCm, litersFromDipCm } from '@/utils/fuelTankCalibration';

function roundLiters(n: number): number {
  return Math.round(n);
}

export async function getMeterSalesLitersByFuelTypeId(
  pumpDayIso: string,
): Promise<Record<string, number>> {
  const day = parseISO(`${pumpDayIso}T12:00:00`);
  const shifts = await listClosedShiftsByPumpDayRange(day, day);
  const out: Record<string, number> = {};

  for (const sh of shifts) {
    const readings = await listReadingsForShift(sh.id);
    for (const r of readings) {
      const n = await getNozzle(r.nozzleId);
      if (!n) continue;
      out[n.fuelTypeId] = (out[n.fuelTypeId] ?? 0) + Number(r.finalSalesLiters ?? 0);
    }
  }

  for (const id of Object.keys(out)) {
    out[id] = roundLiters(out[id]);
  }
  return out;
}

function findDip(
  dips: FuelTankDipReading[],
  pumpDayIso: string,
  kind: DipKind,
): FuelTankDipReading | undefined {
  return dips.find((d) => d.pumpDayIso === pumpDayIso && d.dipKind === kind);
}

function priorClosingDip(dips: FuelTankDipReading[], pumpDayIso: string): FuelTankDipReading | undefined {
  return dips
    .filter((d) => d.pumpDayIso < pumpDayIso && d.dipKind === 'closing')
    .sort(
      (a, b) =>
        b.pumpDayIso.localeCompare(a.pumpDayIso) ||
        b.recordedAt.toMillis() - a.recordedAt.toMillis(),
    )[0];
}

/** Best dip (cm) to display — only from saved dip readings, not guessed from stock. */
function resolveDisplayDipCm(params: {
  fuel: FuelType;
  pumpDayIso: string;
  closingDip?: FuelTankDipReading;
  openingDip?: FuelTankDipReading;
  priorClose?: FuelTankDipReading;
}): number | null {
  const { fuel, pumpDayIso, closingDip, openingDip, priorClose } = params;
  const todayIso = format(new Date(), 'yyyy-MM-dd');

  if (closingDip?.dipCm != null && closingDip.dipCm > 0) return canonicalDipCm(closingDip.dipCm);
  if (openingDip?.dipCm != null && openingDip.dipCm > 0) return canonicalDipCm(openingDip.dipCm);
  if (priorClose?.dipCm != null && priorClose.dipCm > 0) return canonicalDipCm(priorClose.dipCm);
  if (pumpDayIso === todayIso && fuel.lastDipCm != null && fuel.lastDipCm > 0) {
    return canonicalDipCm(fuel.lastDipCm);
  }
  return null;
}

async function buildRowForFuel(
  fuel: FuelType,
  pumpDayIso: string,
  salesByFuel: Record<string, number>,
  allDips: FuelTankDipReading[],
): Promise<DailyFuelStockRow | null> {
  const capacity = fuel.tankCapacityLiters;
  if (capacity == null || capacity <= 0) return null;

  const meta = fuelStockDisplayMeta(fuel.name);
  const reserve = Math.max(0, fuel.reserveLiters ?? 0);
  const fuelDips = allDips.filter((d) => d.fuelTypeId === fuel.id);
  const openingDip = findDip(fuelDips, pumpDayIso, 'opening');
  const closingDip = findDip(fuelDips, pumpDayIso, 'closing');
  const priorClose = priorClosingDip(fuelDips, pumpDayIso);

  const openingStockLiters = roundLiters(
    openingDip?.dipLiters ?? priorClose?.dipLiters ?? fuel.currentStockLiters ?? 0,
  );
  const receiptLiters = roundLiters(await sumFuelReceiptLitersForDay(fuel.id, pumpDayIso));
  const salesLiters = roundLiters(salesByFuel[fuel.id] ?? 0);
  const expectedStockLiters = roundLiters(openingStockLiters + receiptLiters - salesLiters);

  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const actualStockLiters =
    closingDip?.dipLiters ??
    (pumpDayIso === todayIso ? (fuel.currentStockLiters ?? null) : null);
  const variationLiters =
    actualStockLiters != null ? roundLiters(actualStockLiters - expectedStockLiters) : null;

  const currentStockLiters = actualStockLiters ?? expectedStockLiters;
  const currentDipCm = resolveDisplayDipCm({
    fuel,
    pumpDayIso,
    closingDip,
    openingDip,
    priorClose,
  });
  /** When dip is known, stock shown matches the calibration chart at that dip. */
  const displayStockLiters =
    closingDip?.dipLiters ??
    (currentDipCm != null ? litersFromDipCm(currentDipCm, fuel.name) : currentStockLiters);
  const availablePercent =
    capacity > 0 ? Math.min(100, (currentStockLiters / capacity) * 100) : 0;

  const dipEnteredToday = closingDip != null;
  const variationAlert =
    variationLiters != null && Math.abs(variationLiters) > VARIATION_ALERT_LITERS;
  const lowStockAlert = currentStockLiters <= reserve;

  return {
    pumpDayIso,
    fuelTypeId: fuel.id,
    displayName: meta.displayName,
    shortCode: meta.shortCode,
    openingDipCm: openingDip?.dipCm ?? priorClose?.dipCm ?? null,
    openingStockLiters,
    closingDipCm: closingDip?.dipCm ?? null,
    closingStockLiters: closingDip?.dipLiters ?? null,
    currentDipCm,
    currentStockLiters: displayStockLiters,
    salesLiters,
    receiptLiters,
    expectedStockLiters,
    actualStockLiters,
    variationLiters,
    availablePercent,
    health: fuelStockHealthFromPercent(availablePercent),
    dipEnteredToday,
    variationAlert,
    lowStockAlert,
    tankCapacityLiters: capacity,
    reserveLiters: reserve,
  };
}

function buildAlerts(rows: DailyFuelStockRow[], pumpDayIso: string): string[] {
  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const messages: string[] = [];

  for (const row of rows) {
    if (pumpDayIso === todayIso && !row.dipEnteredToday) {
      messages.push(`${row.shortCode} closing dip not entered for today.`);
    }
    if (row.variationAlert && row.variationLiters != null) {
      const sign = row.variationLiters > 0 ? '+' : '';
      messages.push(
        `${row.shortCode} variation ${sign}${row.variationLiters.toLocaleString('en-IN')} L exceeds ±${VARIATION_ALERT_LITERS} L limit.`,
      );
    }
    if (row.lowStockAlert) {
      messages.push(`${row.shortCode} stock at or below reserve level.`);
    }
  }

  return messages;
}

function sortDailyRows(rows: DailyFuelStockRow[]): DailyFuelStockRow[] {
  return [...rows].sort((a, b) => {
    const ai = FUEL_STOCK_SORT_ORDER.indexOf(a.shortCode as (typeof FUEL_STOCK_SORT_ORDER)[number]);
    const bi = FUEL_STOCK_SORT_ORDER.indexOf(b.shortCode as (typeof FUEL_STOCK_SORT_ORDER)[number]);
    const aRank = ai === -1 ? 999 : ai;
    const bRank = bi === -1 ? 999 : bi;
    if (aRank !== bRank) return aRank - bRank;
    return a.pumpDayIso.localeCompare(b.pumpDayIso);
  });
}

export async function getTankStockDaySummary(pumpDayIso: string): Promise<TankStockDaySummary> {
  const fuels = await listFuelTypes();
  const tankFuels = fuels.filter((f) => f.tankCapacityLiters != null && f.tankCapacityLiters > 0);

  const fromIso = format(addDays(parseISO(`${pumpDayIso}T12:00:00`), -60), 'yyyy-MM-dd');
  const [salesByFuel, allDips] = await Promise.all([
    getMeterSalesLitersByFuelTypeId(pumpDayIso),
    listFuelTankDipsInRange(fromIso, pumpDayIso),
  ]);

  const rows = sortDailyRows(
    (
      await Promise.all(
        tankFuels.map((f) => buildRowForFuel(f, pumpDayIso, salesByFuel, allDips)),
      )
    ).filter((r): r is DailyFuelStockRow => r != null),
  );

  return {
    pumpDayIso,
    rows,
    alerts: buildAlerts(rows, pumpDayIso),
  };
}

export async function getDailyFuelStockReport(
  fromIso: string,
  toIso: string,
): Promise<DailyFuelStockRow[]> {
  const start = parseISO(`${fromIso}T12:00:00`);
  const end = parseISO(`${toIso}T12:00:00`);
  if (start.getTime() > end.getTime()) return [];

  const allRows: DailyFuelStockRow[] = [];
  let cursor = start;
  while (cursor.getTime() <= end.getTime()) {
    const iso = format(cursor, 'yyyy-MM-dd');
    const summary = await getTankStockDaySummary(iso);
    allRows.push(...summary.rows);
    cursor = addDays(cursor, 1);
  }
  return allRows;
}
