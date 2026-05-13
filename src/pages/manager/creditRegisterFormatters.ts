/** Match Excel-style credit rows: trim trailing zeros, preserve integers. */
export function trimNumberDisplay(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (Number.isInteger(n)) return String(n);
  const s = n.toFixed(4).replace(/\.?0+$/, '');
  return s === '' ? '0' : s;
}
