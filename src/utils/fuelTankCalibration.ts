import {
  CHART_FULL_VOLUME_LITERS,
  CHART_MAX_DIP_CM,
  DIFF_LITERS_PER_MM_BY_DIP_CM,
  VOLUME_LITERS_BY_DIP_CM,
} from '@/utils/fuelTankCalibration20KLData';
import { fuelDipVolumeScale, fuelStockDisplayMeta } from '@/utils/fuelStockDisplay';

/**
 * Dip-stick readings are shown as whole centimetres on the gauge.
 * 135.8 cm is displayed as 136 cm; stock uses the fractional reading.
 */
export function normalizeDipCm(dipCm: number): number {
  if (!Number.isFinite(dipCm)) return 0;
  return Math.round(dipCm);
}

/** Store dip readings to one decimal place (e.g. 135.8). */
export function canonicalDipCm(dipCm: number): number {
  if (!Number.isFinite(dipCm)) return 0;
  return Math.round(dipCm * 10) / 10;
}

/**
 * Base liters from the 20 KL chart using fractional dip (mm interpolation).
 * Example: 135.8 cm uses VOLUME[135] + 8 mm × DIFF[136].
 */
export function chartLitersFromDipCm(dipCm: number): number {
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

/**
 * Stock liters for this pump — chart + per-fuel calibration.
 * Calibrated: MS 135.8 = 14,902 L | XP 91.2 = 9,065 L | HSD 146 = 16,168 L.
 */
export function litersFromDipCm(dipCm: number, fuelName?: string): number {
  const base = chartLitersFromDipCm(dipCm);
  if (base <= 0) return 0;
  const scale = fuelName ? fuelDipVolumeScale(fuelName) : 1;
  return Math.round(base * scale);
}

/** @deprecated Use litersFromDipCm — kept for call sites. */
export function previewLitersFromDipCm(dipCm: number, fuelName?: string): number {
  return litersFromDipCm(dipCm, fuelName);
}

/** Find dip (cm) that best matches a stock volume for this fuel. */
export function dipCmFromLiters(liters: number, fuelName?: string): number | null {
  if (!Number.isFinite(liters) || liters <= 0) return null;

  const capped = Math.min(liters, CHART_FULL_VOLUME_LITERS * (fuelName ? fuelDipVolumeScale(fuelName) : 1));
  let bestDip: number | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (let tenths = 10; tenths <= CHART_MAX_DIP_CM * 10; tenths += 1) {
    const dip = tenths / 10;
    const vol = litersFromDipCm(dip, fuelName);
    const diff = Math.abs(vol - capped);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestDip = dip;
    }
    if (diff === 0) break;
  }

  return bestDip != null ? canonicalDipCm(bestDip) : null;
}

export function formatDipCm(value: number): string {
  return `${normalizeDipCm(value).toLocaleString('en-IN')} cm`;
}

/** Raw dip for entry forms (one decimal). */
export function formatDipCmEntry(value: number): string {
  return canonicalDipCm(value).toFixed(1);
}

export function calibrationLabelForFuel(fuelName: string): string {
  return fuelStockDisplayMeta(fuelName).shortCode;
}

export { CHART_FULL_VOLUME_LITERS, CHART_MAX_DIP_CM };
