import type { Theme } from '@mui/material/styles';

import type { FuelStockHealth, FuelStockItem, FuelType } from '@/types/entities';

/** Standard tank capacity for all fuel types at this pump. */
export const DEFAULT_TANK_CAPACITY_LITERS = 20_000;

/** Preferred dashboard order; unknown fuels sort after these. */
export const FUEL_STOCK_SORT_ORDER = ['MS', 'HSD', 'XP'] as const;

const DISPLAY_BY_KEY: Record<string, { displayName: string; shortCode: string }> = {
  MS: { displayName: 'Motor Spirit (MS)', shortCode: 'MS' },
  HSD: { displayName: 'High Speed Diesel (HSD)', shortCode: 'HSD' },
  XP: { displayName: 'Extra Premium (XP)', shortCode: 'XP' },
};

export function fuelStockDisplayMeta(fuelName: string): { displayName: string; shortCode: string } {
  const u = fuelName.toUpperCase().trim();
  if (u.includes('PETROL') || u === 'MS' || u.includes('MOTOR SPIRIT')) {
    return DISPLAY_BY_KEY.MS;
  }
  if (u.includes('DIESEL') || u === 'HSD' || u.includes('HIGH SPEED')) {
    return DISPLAY_BY_KEY.HSD;
  }
  if (u.includes('XP') || u.includes('EXTRA PREMIUM')) {
    return DISPLAY_BY_KEY.XP;
  }
  const shortCode = u.length <= 4 ? u : u.slice(0, 3);
  return { displayName: fuelName, shortCode };
}

/**
 * Per-fuel volume scale — calibrated to this pump's dip readings:
 * MS 135.8 cm = 14,902 L | XP 91.2 cm = 9,065 L | HSD 146 cm = 16,168 L
 * (base chart: 14,795 / 9,010 / 16,052 L at those dips).
 */
export function fuelDipVolumeScale(fuelName: string): number {
  const code = fuelStockDisplayMeta(fuelName).shortCode;
  if (code === 'MS') return 14_902 / 14_795;
  if (code === 'XP') return 9_065 / 9_010;
  if (code === 'HSD') return 16_168 / 16_052;
  return 1;
}

export function fuelStockHealthFromPercent(percent: number): FuelStockHealth {
  if (percent < 20) return 'critical';
  if (percent <= 50) return 'low';
  return 'healthy';
}

export function fuelStockHealthLabel(health: FuelStockHealth): string {
  if (health === 'healthy') return 'Healthy';
  if (health === 'low') return 'Low Stock';
  return 'Critical – Refill Required';
}

export function fuelStockHealthEmoji(health: FuelStockHealth): string {
  if (health === 'healthy') return '🟢';
  if (health === 'low') return '🟠';
  return '🔴';
}

export function fuelStockHealthColor(health: FuelStockHealth, theme: Theme): string {
  if (health === 'healthy') return theme.palette.success.main;
  if (health === 'low') return theme.palette.warning.main;
  return theme.palette.error.main;
}

export function sortFuelStockItems(items: FuelStockItem[]): FuelStockItem[] {
  return [...items].sort((a, b) => {
    const ai = FUEL_STOCK_SORT_ORDER.indexOf(a.shortCode as (typeof FUEL_STOCK_SORT_ORDER)[number]);
    const bi = FUEL_STOCK_SORT_ORDER.indexOf(b.shortCode as (typeof FUEL_STOCK_SORT_ORDER)[number]);
    const aRank = ai === -1 ? 999 : ai;
    const bRank = bi === -1 ? 999 : bi;
    if (aRank !== bRank) return aRank - bRank;
    return a.displayName.localeCompare(b.displayName);
  });
}

export function buildFuelStockItem(
  fuel: FuelType,
  opts: { updatedToday: boolean },
): FuelStockItem | null {
  const capacity = fuel.tankCapacityLiters;
  const stock = fuel.currentStockLiters;
  if (capacity == null || capacity <= 0 || stock == null) {
    return null;
  }

  const reserve = Math.max(0, fuel.reserveLiters ?? 0);
  const availablePercent = Math.min(100, Math.max(0, (stock / capacity) * 100));
  const meta = fuelStockDisplayMeta(fuel.name);

  return {
    fuelTypeId: fuel.id,
    displayName: meta.displayName,
    shortCode: meta.shortCode,
    currentStockLiters: stock,
    currentDipCm: fuel.lastDipCm ?? null,
    tankCapacityLiters: capacity,
    reserveLiters: reserve,
    availablePercent,
    health: fuelStockHealthFromPercent(availablePercent),
    lastDipAt: fuel.lastDipAt ?? null,
    updatedToday: opts.updatedToday,
    atOrBelowReserve: stock <= reserve,
  };
}

export const FUEL_STOCK_UPDATED_EVENT = 'pumpstock:fuel-stock-updated';

export function notifyFuelStockUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FUEL_STOCK_UPDATED_EVENT));
  }
}
