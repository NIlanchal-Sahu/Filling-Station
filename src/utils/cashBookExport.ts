import type { CashBookSummaryRow } from '@/utils/cashBookSummary';
import { cashBookAmtDisplay } from '@/utils/dailyCashBookVertical';
import { downloadCsv } from '@/utils/csvExport';
import { DEMO_PUMP_NAME } from '@/utils/transferBookExport';

function safeFilePart(raw: string): string {
  const t = raw.replace(/[/\\:*?"<>|]+/g, '_').trim();
  return t.length > 0 ? t.slice(0, 80) : 'cash-book';
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

function escHtml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function cashBookExportBasename(dateLabel: string): string {
  return `cash-book_${safeFilePart(dateLabel)}`;
}

export function downloadCashBookCsv(dateLabel: string, rows: CashBookSummaryRow[]): void {
  downloadCsv(
    `${cashBookExportBasename(dateLabel)}.csv`,
    ['Particular', 'Amount'],
    rows.map((r) => [r.label, cashBookAmtDisplay(r)]),
  );
}

/** Excel-compatible .xls (opens in Excel / LibreOffice). */
export function downloadCashBookExcel(dateLabel: string, rows: CashBookSummaryRow[]): void {
  const trs = rows
    .map((r) => {
      const weight = r.bold ? 'font-weight:700;' : '';
      return `<tr><td style="${weight}">${escHtml(r.label)}</td><td style="${weight}text-align:right">${escHtml(cashBookAmtDisplay(r))}</td></tr>`;
    })
    .join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"/></head>
<body>
<table border="1">
<tr><th colspan="2">Cash book — ${escHtml(dateLabel)}</th></tr>
<tr><th>Particular</th><th>Amount</th></tr>
${trs}
</table>
</body></html>`;
  triggerDownload(
    `${cashBookExportBasename(dateLabel)}.xls`,
    'application/vnd.ms-excel;charset=utf-8',
    html,
  );
}

function latinPdf(s: string): string {
  return s
    .replaceAll('₹', 'Rs ')
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

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 48;
const COLS = [340, 160] as const;
const TABLE_W = COLS.reduce((a, b) => a + b, 0);
const TABLE_X = (PAGE_W - TABLE_W) / 2;
const HEADER_H = 22;
const ROW_H = 20;

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
  return `${font} ${size} Tf\n1 0 0 1 ${(x + 8).toFixed(1)} ${y.toFixed(1)} Tm\n(${pdfEscape(s)}) Tj`;
}

function cellRight(s: string, size: number, xRight: number, y: number, font: '/F1' | '/F2'): string {
  if (!s) return '';
  const x = xRight - 8 - textW(s, size);
  return `${font} ${size} Tf\n1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm\n(${pdfEscape(s)}) Tj`;
}

function pageStream(dateLabel: string, rows: CashBookSummaryRow[], start: number, pageIndex: number): string {
  const xs = colXs();
  const titleY = PAGE_H - 44;
  const tableTop = pageIndex === 0 ? PAGE_H - 108 : PAGE_H - 72;
  const maxRows = Math.max(1, Math.floor((tableTop - MARGIN - HEADER_H) / ROW_H));
  const slice = rows.slice(start, start + maxRows);
  const tableH = HEADER_H + slice.length * ROW_H;
  const tableBottom = tableTop - tableH;

  const gfx: string[] = [];
  gfx.push('0.6 w');
  gfx.push('0.90 g');
  gfx.push(`${TABLE_X.toFixed(1)} ${(tableTop - HEADER_H).toFixed(1)} ${TABLE_W.toFixed(1)} ${HEADER_H} re f`);
  gfx.push('0 g');
  slice.forEach((r, i) => {
    if (!r.bold) return;
    const y = tableTop - HEADER_H - (i + 1) * ROW_H;
    gfx.push('0.94 g');
    gfx.push(`${TABLE_X.toFixed(1)} ${y.toFixed(1)} ${TABLE_W.toFixed(1)} ${ROW_H} re f`);
    gfx.push('0 g');
  });
  gfx.push(`${TABLE_X.toFixed(1)} ${tableBottom.toFixed(1)} ${TABLE_W.toFixed(1)} ${tableH.toFixed(1)} re S`);
  gfx.push(`${xs[1]!.toFixed(1)} ${tableBottom.toFixed(1)} m ${xs[1]!.toFixed(1)} ${tableTop.toFixed(1)} l S`);
  gfx.push(
    `${TABLE_X.toFixed(1)} ${(tableTop - HEADER_H).toFixed(1)} m ${(TABLE_X + TABLE_W).toFixed(1)} ${(tableTop - HEADER_H).toFixed(1)} l S`,
  );
  for (let r = 1; r < slice.length; r++) {
    const y = tableTop - HEADER_H - r * ROW_H;
    gfx.push(`${TABLE_X.toFixed(1)} ${y.toFixed(1)} m ${(TABLE_X + TABLE_W).toFixed(1)} ${y.toFixed(1)} l S`);
  }

  const txt: string[] = [];
  txt.push('BT');
  txt.push(centerText(DEMO_PUMP_NAME, 18, titleY, '/F2'));
  if (pageIndex === 0) {
    txt.push(centerText('Cash book', 12, titleY - 22, '/F1'));
    txt.push(centerText(dateLabel, 10, titleY - 40, '/F1'));
  } else {
    txt.push(centerText(`Cash book  ${dateLabel}`, 10, titleY - 22, '/F1'));
  }

  const headBaseline = tableTop - HEADER_H + 7;
  txt.push(cellLeft('Particular', 9, xs[0]!, headBaseline, '/F2'));
  txt.push(cellRight('Amount', 9, xs[2]!, headBaseline, '/F2'));

  slice.forEach((row, i) => {
    const font: '/F1' | '/F2' = row.bold ? '/F2' : '/F1';
    const baseline = tableTop - HEADER_H - (i + 1) * ROW_H + 6;
    txt.push(cellLeft(clip(row.label, 42), 9, xs[0]!, baseline, font));
    txt.push(cellRight(clip(cashBookAmtDisplay(row), 22), 9, xs[2]!, baseline, font));
  });
  txt.push('ET');

  return [...gfx, ...txt.filter(Boolean)].join('\n');
}

function rowsPerPage(pageIndex: number): number {
  const tableTop = pageIndex === 0 ? PAGE_H - 108 : PAGE_H - 72;
  return Math.max(1, Math.floor((tableTop - MARGIN - HEADER_H) / ROW_H));
}

/** Elite-style portrait A4 cash book PDF. */
export function downloadCashBookPdf(dateLabel: string, rows: CashBookSummaryRow[]): void {
  const streams: string[] = [];
  let start = 0;
  let pageIndex = 0;
  if (rows.length === 0) {
    streams.push(pageStream(dateLabel, [], 0, 0));
  } else {
    while (start < rows.length) {
      const n = rowsPerPage(pageIndex);
      streams.push(pageStream(dateLabel, rows, start, pageIndex));
      start += n;
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

  triggerDownload(`${cashBookExportBasename(dateLabel)}.pdf`, 'application/pdf', pdf);
}
