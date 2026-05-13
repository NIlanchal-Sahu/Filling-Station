/**
 * Exports a grid of string rows to a CSV file download. Escapes double quotes in cells.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
): void {
  const esc = (v: string | number) => {
    const s = String(v);
    if (/[",\n]/.test(s)) {
      return `"${s.replaceAll('"', '""')}"`;
    }
    return s;
  };
  const body = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
