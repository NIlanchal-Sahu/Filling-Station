export function formatMachineNumbers(numbers: string[]): string {
  const unique = [...new Set(numbers.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return '—';
  unique.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return unique.map((n) => `M${n}`).join(', ');
}

export function formatMachineLabelFromNozzleSelection(
  selectedNozzleIds: Iterable<string>,
  nozzles: { id: string; machineNumber: string }[],
): string {
  const numbers: string[] = [];
  for (const id of selectedNozzleIds) {
    const nozzle = nozzles.find((n) => n.id === id);
    if (nozzle?.machineNumber.trim()) {
      numbers.push(nozzle.machineNumber.trim());
    }
  }
  return formatMachineNumbers(numbers);
}
