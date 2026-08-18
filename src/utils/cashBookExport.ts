import type { CashBookSummaryRow } from '@/utils/cashBookSummary';
import { cashBookAmtDisplay } from '@/utils/dailyCashBookVertical';
import { downloadCsv } from '@/utils/csvExport';

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

/** Builds a simple one-page PDF and downloads it (no popup / print dialog). */
export function downloadCashBookPdf(dateLabel: string, rows: CashBookSummaryRow[]): void {
  const lines: string[] = [];
  lines.push('BT');
  lines.push('/F1 14 Tf');
  lines.push('50 800 Td');
  lines.push(`(${pdfEscape(`Cash book - ${dateLabel}`)}) Tj`);
  lines.push('/F1 10 Tf');
  lines.push('0 -22 Td');
  lines.push('(Particular) Tj');
  lines.push('320 0 Td');
  lines.push('(Amount) Tj');
  lines.push('-320 -6 Td');
  lines.push('0 -2 Td');

  for (const r of rows) {
    const font = r.bold ? '/F1 11 Tf' : '/F1 10 Tf';
    lines.push(font);
    lines.push('0 -16 Td');
    lines.push(`(${pdfEscape(r.label)}) Tj`);
    lines.push('320 0 Td');
    lines.push(`(${pdfEscape(cashBookAmtDisplay(r))}) Tj`);
    lines.push('-320 0 Td');
  }
  lines.push('ET');
  const stream = lines.join('\n');
  const streamBytes = new TextEncoder().encode(stream);

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`,
  ];

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
