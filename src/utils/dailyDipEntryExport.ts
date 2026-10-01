import { format, parseISO } from 'date-fns';
import type { DipValueRegisterRow } from '@/utils/dipValueRegister';
import { downloadCsv } from '@/utils/csvExport';
import { getCachedPumpDisplayName } from '@/services/stationAboutService';

export type DailyDipExportRow = {
  fuelCode: string;
  openingLiters: string;
  receiptLiters: string;
  totalLiters: string;
  salesLiters: string;
  closingLiters: string;
  variationLiters: string;
};

function safeFilePart(raw: string): string {
  const t = raw.replace(/[/\\:*?"<>|]+/g, '_').trim();
  return t.length > 0 ? t.slice(0, 80) : 'daily-dip';
}

function triggerDownload(filename: string, mime: string, body: BlobPart): void {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function latinPdf(s: string): string {
  return s
    .replaceAll('—', '-')
    .replaceAll('–', '-')
    .replace(/[^\x20-\x7E]/g, '?');
}

function pdfEscape(s: string): string {
  return latinPdf(s).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function clip(s: string, max: number): string {
  const t = latinPdf(s);
  return t.length > max ? t.slice(0, max - 1) + '.' : t;
}

function textW(s: string, size: number): number {
  return latinPdf(s).length * size * 0.5;
}

/** Landscape A4 */
const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 40;
const COLS = [44, 108, 96, 108, 96, 108, 96] as const;
const TABLE_W = COLS.reduce((a, b) => a + b, 0);
const TABLE_X = (PAGE_W - TABLE_W) / 2;
const HEADER_H = 24;
const ROW_H = 22;

const HEADERS = [
  'Fuel',
  'Opening (L)',
  'Receipt (L)',
  'Total (L)',
  'Sales (L)',
  'Closing (L)',
  'Variation',
] as const;

function colXs(): number[] {
  const xs = [TABLE_X];
  let x = TABLE_X;
  for (const w of COLS) {
    x += w;
    xs.push(x);
  }
  return xs;
}

function centerText(s: string, size: number, y: number, font: '/F1' | '/F2'): string {
  const x = Math.max(MARGIN, (PAGE_W - textW(s, size)) / 2);
  return `${font} ${size} Tf\n1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm\n(${pdfEscape(s)}) Tj`;
}

function cellLeft(s: string, size: number, x: number, y: number, font: '/F1' | '/F2'): string {
  if (!s) return '';
  return `${font} ${size} Tf\n1 0 0 1 ${(x + 6).toFixed(1)} ${y.toFixed(1)} Tm\n(${pdfEscape(s)}) Tj`;
}

function cellRight(s: string, size: number, xRight: number, y: number, font: '/F1' | '/F2'): string {
  if (!s) return '';
  const x = xRight - 6 - textW(s, size);
  return `${font} ${size} Tf\n1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm\n(${pdfEscape(s)}) Tj`;
}

function pageStream(pumpDayLabel: string, rows: DailyDipExportRow[]): string {
  const xs = colXs();
  const titleY = PAGE_H - 40;
  const tableTop = PAGE_H - 96;
  const tableH = HEADER_H + rows.length * ROW_H;
  const tableBottom = tableTop - tableH;

  const gfx: string[] = [];
  gfx.push('0.6 w');
  gfx.push('0.90 g');
  gfx.push(`${TABLE_X.toFixed(1)} ${(tableTop - HEADER_H).toFixed(1)} ${TABLE_W.toFixed(1)} ${HEADER_H} re f`);
  gfx.push('0 g');
  gfx.push(`${TABLE_X.toFixed(1)} ${tableBottom.toFixed(1)} ${TABLE_W.toFixed(1)} ${tableH.toFixed(1)} re S`);
  for (let c = 1; c < xs.length - 1; c++) {
    gfx.push(`${xs[c]!.toFixed(1)} ${tableBottom.toFixed(1)} m ${xs[c]!.toFixed(1)} ${tableTop.toFixed(1)} l S`);
  }
  gfx.push(
    `${TABLE_X.toFixed(1)} ${(tableTop - HEADER_H).toFixed(1)} m ${(TABLE_X + TABLE_W).toFixed(1)} ${(tableTop - HEADER_H).toFixed(1)} l S`,
  );
  for (let r = 1; r < rows.length; r++) {
    const y = tableTop - HEADER_H - r * ROW_H;
    gfx.push(`${TABLE_X.toFixed(1)} ${y.toFixed(1)} m ${(TABLE_X + TABLE_W).toFixed(1)} ${y.toFixed(1)} l S`);
  }

  const txt: string[] = [];
  txt.push('BT');
  txt.push(centerText(getCachedPumpDisplayName(), 16, titleY, '/F2'));
  txt.push(centerText('Daily dip entry', 11, titleY - 20, '/F1'));
  txt.push(centerText(`Pump day: ${pumpDayLabel}`, 10, titleY - 36, '/F1'));

  const headBaseline = tableTop - HEADER_H + 8;
  HEADERS.forEach((h, i) => {
    if (i === 0) {
      txt.push(cellLeft(h, 8, xs[i]!, headBaseline, '/F2'));
    } else {
      txt.push(cellRight(h, 8, xs[i + 1]!, headBaseline, '/F2'));
    }
  });

  rows.forEach((row, i) => {
    const baseline = tableTop - HEADER_H - (i + 1) * ROW_H + 7;
    const cells = [
      row.fuelCode,
      row.openingLiters,
      row.receiptLiters,
      row.totalLiters,
      row.salesLiters,
      row.closingLiters,
      row.variationLiters,
    ];
    cells.forEach((cell, col) => {
      const clipped = clip(cell, col === 0 ? 8 : 14);
      if (col === 0) {
        txt.push(cellLeft(clipped, 9, xs[0]!, baseline, '/F2'));
      } else {
        txt.push(cellRight(clipped, 9, xs[col + 1]!, baseline, '/F1'));
      }
    });
  });
  txt.push('ET');

  return [...gfx, ...txt.filter(Boolean)].join('\n');
}

export function downloadDailyDipEntryPdf(pumpDayIso: string, pumpDayLabel: string, rows: DailyDipExportRow[]): void {
  const stream = pageStream(pumpDayLabel, rows.length > 0 ? rows : []);

  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [5 0 R] /Count 1 >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents 6 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`,
  );
  const streamBytes = new TextEncoder().encode(stream);
  objects.push(`<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;

  triggerDownload(`daily-dip_${safeFilePart(pumpDayIso)}.pdf`, 'application/pdf', pdf);
}

const REGISTER_HEADERS = [
  'Date',
  'Opening (L)',
  'Receipt (L)',
  'Total (L)',
  'Sales (L)',
  'Closing book (L)',
  'Variation (L)',
] as const;

function fmtRegisterLiters(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

function fmtRegisterVariation(n: number | null): string {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${fmtRegisterLiters(n)}`;
}

function fmtRegisterDate(pumpDayIso: string): string {
  try {
    return format(parseISO(`${pumpDayIso}T12:00:00`), 'dd-MMM-yyyy');
  } catch {
    return pumpDayIso;
  }
}

function registerExportBasename(fuelCode: string, monthLabel: string): string {
  return `dip-register_${safeFilePart(fuelCode)}_${safeFilePart(monthLabel)}`;
}

function registerGridRows(rows: DipValueRegisterRow[]): string[][] {
  return rows.map((r) => [
    fmtRegisterDate(r.pumpDayIso),
    fmtRegisterLiters(r.openingStockLiters),
    fmtRegisterLiters(r.receiptLiters),
    fmtRegisterLiters(r.totalStockLiters),
    fmtRegisterLiters(r.salesLiters),
    fmtRegisterLiters(r.closingBookLiters),
    fmtRegisterVariation(r.variationLiters),
  ]);
}

export function downloadDipRegisterCsv(
  _fuelLabel: string,
  fuelCode: string,
  monthLabel: string,
  rows: DipValueRegisterRow[],
): void {
  downloadCsv(
    `${registerExportBasename(fuelCode, monthLabel)}.csv`,
    [...REGISTER_HEADERS],
    registerGridRows(rows),
  );
}

function escHtml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function downloadDipRegisterExcel(
  fuelLabel: string,
  fuelCode: string,
  monthLabel: string,
  rows: DipValueRegisterRow[],
): void {
  const head = REGISTER_HEADERS.map((h) => `<th>${escHtml(h)}</th>`).join('');
  const trs = registerGridRows(rows)
    .map((cells) => {
      const [date, ...rest] = cells;
      return `<tr><td>${escHtml(date ?? '')}</td>${rest.map((c) => `<td style="text-align:right">${escHtml(c)}</td>`).join('')}</tr>`;
    })
    .join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"/></head>
<body>
<table border="1">
<tr><th colspan="7">Dip value register — ${escHtml(fuelLabel)} — ${escHtml(monthLabel)}</th></tr>
<tr>${head}</tr>
${trs}
</table>
</body></html>`;
  triggerDownload(
    `${registerExportBasename(fuelCode, monthLabel)}.xls`,
    'application/vnd.ms-excel;charset=utf-8',
    html,
  );
}

const REG_COLS = [92, 96, 88, 96, 88, 108, 96] as const;

function registerColXs(): number[] {
  const tableW = REG_COLS.reduce((a, b) => a + b, 0);
  const tableX = (PAGE_W - tableW) / 2;
  const xs = [tableX];
  let x = tableX;
  for (const w of REG_COLS) {
    x += w;
    xs.push(x);
  }
  return xs;
}

function registerTableWidth(): number {
  return REG_COLS.reduce((a, b) => a + b, 0);
}

function registerTableX(): number {
  return (PAGE_W - registerTableWidth()) / 2;
}

function registerPageStream(
  fuelLabel: string,
  monthLabel: string,
  grid: string[][],
  start: number,
  pageIndex: number,
): string {
  const xs = registerColXs();
  const tableX = registerTableX();
  const tableW = registerTableWidth();
  const titleY = PAGE_H - 40;
  const tableTop = pageIndex === 0 ? PAGE_H - 96 : PAGE_H - 72;
  const maxRows = Math.max(1, Math.floor((tableTop - MARGIN - HEADER_H) / ROW_H));
  const slice = grid.slice(start, start + maxRows);
  const tableH = HEADER_H + slice.length * ROW_H;
  const tableBottom = tableTop - tableH;

  const gfx: string[] = [];
  gfx.push('0.6 w');
  gfx.push('0.90 g');
  gfx.push(`${tableX.toFixed(1)} ${(tableTop - HEADER_H).toFixed(1)} ${tableW.toFixed(1)} ${HEADER_H} re f`);
  gfx.push('0 g');
  gfx.push(`${tableX.toFixed(1)} ${tableBottom.toFixed(1)} ${tableW.toFixed(1)} ${tableH.toFixed(1)} re S`);
  for (let c = 1; c < xs.length - 1; c++) {
    gfx.push(`${xs[c]!.toFixed(1)} ${tableBottom.toFixed(1)} m ${xs[c]!.toFixed(1)} ${tableTop.toFixed(1)} l S`);
  }
  gfx.push(
    `${tableX.toFixed(1)} ${(tableTop - HEADER_H).toFixed(1)} m ${(tableX + tableW).toFixed(1)} ${(tableTop - HEADER_H).toFixed(1)} l S`,
  );
  for (let r = 1; r < slice.length; r++) {
    const y = tableTop - HEADER_H - r * ROW_H;
    gfx.push(`${tableX.toFixed(1)} ${y.toFixed(1)} m ${(tableX + tableW).toFixed(1)} ${y.toFixed(1)} l S`);
  }

  const txt: string[] = [];
  txt.push('BT');
  txt.push(centerText(getCachedPumpDisplayName(), 16, titleY, '/F2'));
  if (pageIndex === 0) {
    txt.push(centerText('Dip value register', 11, titleY - 20, '/F1'));
    txt.push(centerText(`${clip(fuelLabel, 48)}  |  ${monthLabel}`, 10, titleY - 36, '/F1'));
  } else {
    txt.push(centerText(`${clip(fuelLabel, 32)} register (cont.)`, 10, titleY - 22, '/F1'));
  }

  const headBaseline = tableTop - HEADER_H + 8;
  REGISTER_HEADERS.forEach((h, i) => {
    if (i === 0) {
      txt.push(cellLeft(h, 8, xs[i]!, headBaseline, '/F2'));
    } else {
      txt.push(cellRight(h, 8, xs[i + 1]!, headBaseline, '/F2'));
    }
  });

  slice.forEach((cells, i) => {
    const baseline = tableTop - HEADER_H - (i + 1) * ROW_H + 7;
    cells.forEach((cell, col) => {
      const clipped = clip(cell, col === 0 ? 12 : 14);
      if (col === 0) {
        txt.push(cellLeft(clipped, 9, xs[0]!, baseline, '/F1'));
      } else {
        txt.push(cellRight(clipped, 9, xs[col + 1]!, baseline, '/F1'));
      }
    });
  });
  txt.push('ET');

  return [...gfx, ...txt.filter(Boolean)].join('\n');
}

function registerRowsPerPage(pageIndex: number): number {
  const tableTop = pageIndex === 0 ? PAGE_H - 96 : PAGE_H - 72;
  return Math.max(1, Math.floor((tableTop - MARGIN - HEADER_H) / ROW_H));
}

export function downloadDipRegisterPdf(
  fuelLabel: string,
  fuelCode: string,
  monthLabel: string,
  rows: DipValueRegisterRow[],
): void {
  const grid = registerGridRows(rows);
  const streams: string[] = [];
  let start = 0;
  let pageIndex = 0;
  if (grid.length === 0) {
    streams.push(registerPageStream(fuelLabel, monthLabel, [], 0, 0));
  } else {
    while (start < grid.length) {
      streams.push(registerPageStream(fuelLabel, monthLabel, grid, start, pageIndex));
      start += registerRowsPerPage(pageIndex);
      pageIndex += 1;
    }
  }

  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  const pageIds = streams.map((_, i) => `${5 + i * 2} 0 R`);
  objects.push(`<< /Type /Pages /Kids [${pageIds.join(' ')}] /Count ${streams.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  streams.forEach((stream, i) => {
    const pageObjNum = 5 + i * 2;
    const contentObjNum = pageObjNum + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`,
    );
    const streamBytes = new TextEncoder().encode(stream);
    objects.push(`<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;

  triggerDownload(`${registerExportBasename(fuelCode, monthLabel)}.pdf`, 'application/pdf', pdf);
}
