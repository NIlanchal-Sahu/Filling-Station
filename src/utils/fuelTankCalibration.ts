import {
  CHART_FULL_VOLUME_LITERS,
  CHART_MAX_DIP_CM,
  DIFF_LITERS_PER_MM_BY_DIP_CM,
  VOLUME_LITERS_BY_DIP_CM,
} from '@/utils/fuelTankCalibration20KLData';
import { fuelStockDisplayMeta } from '@/utils/fuelStockDisplay';

/**
 * Convert dip-stick reading (cm) to stock liters using the 20 KL horizontal tank chart.
 *
 * Chart columns: DIP (cm), VOLUME (L), DIFF (L per mm).
 * For fractional dips: volume = VOLUME[floor(dip)] + fractional_mm × DIFF[ceil(dip)]
 * where fractional_mm = (dip − floor(dip)) × 10.
 */
export function litersFromDipCm(dipCm: number, _fuelName?: string): number {
  if (!Number.isFinite(dipCm) || dipCm <= 0) return 0;

  if (dipCm >= CHART_MAX_DIP_CM) {
    return Math.round(VOLUME_LITERS_BY_DIP_CM[CHART_MAX_DIP_CM] ?? CHART_FULL_VOLUME_LITERS);
  }

  const floorDip = Math.floor(dipCm);
  const fractionCm = dipCm - floorDip;
  if (fractionCm <= 0) {
    return Math.round(VOLUME_LITERS_BY_DIP_CM[floorDip] ?? 0);
  }

  const baseVolume = VOLUME_LITERS_BY_DIP_CM[floorDip] ?? 0;
  const nextDip = Math.min(floorDip + 1, CHART_MAX_DIP_CM);
  const diffPerMm = DIFF_LITERS_PER_MM_BY_DIP_CM[nextDip] ?? 0;
  const fractionalMm = fractionCm * 10;

  return Math.round(baseVolume + fractionalMm * diffPerMm);
}

/** Inverse lookup: find dip cm for a given stock volume (binary search). */
export function dipCmFromLiters(liters: number, fuelName?: string): number | null {
  if (!Number.isFinite(liters) || liters <= 0) return null;

  const capped = Math.min(liters, CHART_FULL_VOLUME_LITERS);
  let lo = 0;
  let hi = CHART_MAX_DIP_CM;

  for (let i = 0; i < 48; i += 1) {
    const mid = (lo + hi) / 2;
    const vol = litersFromDipCm(mid, fuelName);
    if (Math.abs(vol - capped) <= 1) {
      return Math.round(mid * 10) / 10;
    }
    if (vol < capped) lo = mid;
    else hi = mid;
  }

  return Math.round(lo * 10) / 10;
}

export function formatDipCm(value: number): string {
  return `${value.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} cm`;
}

export function calibrationLabelForFuel(fuelName: string): string {
  return fuelStockDisplayMeta(fuelName).shortCode;
}

export { CHART_FULL_VOLUME_LITERS, CHART_MAX_DIP_CM };
