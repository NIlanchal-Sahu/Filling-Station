/** Sort machine then nozzle numerically (M1 N1, M1 N2, M2 N1, …). */
export function compareNozzleOrder(
  a: { machineNumber: string; nozzleNumber: string },
  b: { machineNumber: string; nozzleNumber: string },
): number {
  const mc = a.machineNumber.localeCompare(b.machineNumber, undefined, { numeric: true });
  if (mc !== 0) return mc;
  return a.nozzleNumber.localeCompare(b.nozzleNumber, undefined, { numeric: true });
}
