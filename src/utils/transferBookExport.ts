export const DEMO_PUMP_NAME = 'PumpStock';

export type TransferBookExportLine = {
  date: string;
  particular: string;
  paid: string;
  received: string;
  running: string;
  bold?: boolean;
};

function safeFilePart(raw: string): string {
  const t = raw.trim().replace(/[<>:"/\\|?*]+/g, '').replace(/\s+/g, ' ');
  return t.length > 0 ? t.slice(0, 80) : 'transfers';
}

export function transferBookExportBasename(name: string): string {
  return `${safeFilePart(name)}-transfers`;
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

function escCsv(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

export function downloadTransferBookCsv(params: {
  partyName: string;
  rangeLabel: string;
  summaryLabel: string;
  rows: (string | number)[][];
}): void {
  const lines: (string | number)[][] = [
    [DEMO_PUMP_NAME],
    ['Transfer name book'],
    [`Name: ${params.partyName} · ${params.rangeLabel}`],
    [params.summaryLabel],
    [],
    ['Date', 'Particular', 'Paid', 'Received', 'Running'],
    ...params.rows,
  ];
  const body = lines.map((r) => r.map(escCsv).join(',')).join('\r\n');
  triggerDownload(transferBookExportBasename(params.partyName) + '.csv', 'text/csv;charset=utf-8', body);
}

function latinPdf(s: string): string {
  return s
    .replaceAll('₹', 'Rs ')
    .replaceAll('·', '-')
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

/** Approximate Helvetica string width. */
function textW(s: string, size: number): number {
  return latinPdf(s).length * size * 0.5;
}

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 36;
const COLS = [72, 155, 98, 98, 100] as const;
const TABLE_W = COLS.reduce((a, b) => a + b, 0);
const TABLE_X = (PAGE_W - TABLE_W) / 2;
const HEADER_H = 20;
const ROW_H = 18;
const HEADERS = ['Date', 'Particular', 'Paid', 'Received', 'Running'] as const;

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

function pageStream(
  partyName: string,
  rangeLabel: string,
  summaryLabel: string,
  rows: TransferBookExportLine[],
  start: number,
  pageIndex: number,
): string {
  const xs = colXs();
  const titleY = PAGE_H - 40;
  const tableTop = pageIndex === 0 ? PAGE_H - 118 : PAGE_H - 72;
  const maxRows = Math.max(1, Math.floor((tableTop - MARGIN - HEADER_H) / ROW_H));
  const slice = rows.slice(start, start + maxRows);
  const tableH = HEADER_H + slice.length * ROW_H;
  const tableBottom = tableTop - tableH;

  const gfx: string[] = [];
  gfx.push('0.5 w');
  gfx.push('0.90 g');
  gfx.push(`${TABLE_X.toFixed(1)} ${(tableTop - HEADER_H).toFixed(1)} ${TABLE_W.toFixed(1)} ${HEADER_H} re f`);
  gfx.push('0 g');
  gfx.push(`${TABLE_X.toFixed(1)} ${tableBottom.toFixed(1)} ${TABLE_W.toFixed(1)} ${tableH.toFixed(1)} re S`);
  for (let i = 1; i < xs.length - 1; i++) {
    gfx.push(`${xs[i]!.toFixed(1)} ${tableBottom.toFixed(1)} m ${xs[i]!.toFixed(1)} ${tableTop.toFixed(1)} l S`);
  }
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
    txt.push(centerText('Transfer name book', 11, titleY - 22, '/F1'));
    txt.push(centerText(`Name: ${partyName}  ${rangeLabel}`, 10, titleY - 40, '/F1'));
    txt.push(centerText(summaryLabel, 9, titleY - 56, '/F1'));
  } else {
    txt.push(centerText(`${partyName}  ${rangeLabel}`, 10, titleY - 22, '/F1'));
  }

  const headBaseline = tableTop - HEADER_H + 6;
  txt.push(cellLeft(HEADERS[0], 8, xs[0]!, headBaseline, '/F2'));
  txt.push(cellLeft(HEADERS[1], 8, xs[1]!, headBaseline, '/F2'));
  txt.push(cellRight(HEADERS[2], 8, xs[3]!, headBaseline, '/F2'));
  txt.push(cellRight(HEADERS[3], 8, xs[4]!, headBaseline, '/F2'));
  txt.push(cellRight(HEADERS[4], 8, xs[5]!, headBaseline, '/F2'));

  slice.forEach((row, i) => {
    const font: '/F1' | '/F2' = row.bold ? '/F2' : '/F1';
    const baseline = tableTop - HEADER_H - (i + 1) * ROW_H + 5;
    txt.push(cellLeft(clip(row.date, 12), 8, xs[0]!, baseline, font));
    txt.push(cellLeft(clip(row.particular, 24), 8, xs[1]!, baseline, font));
    txt.push(cellRight(clip(row.paid, 14), 8, xs[3]!, baseline, font));
    txt.push(cellRight(clip(row.received, 14), 8, xs[4]!, baseline, font));
    txt.push(cellRight(clip(row.running, 14), 8, xs[5]!, baseline, font));
  });
  txt.push('ET');

  return [...gfx, ...txt.filter(Boolean)].join('\n');
}

function rowsPerPage(pageIndex: number): number {
  const tableTop = pageIndex === 0 ? PAGE_H - 118 : PAGE_H - 72;
  return Math.max(1, Math.floor((tableTop - MARGIN - HEADER_H) / ROW_H));
}

/** Elite-style portrait A4 name-book PDF. */
export function downloadTransferBookPdf(
  partyName: string,
  rangeLabel: string,
  summaryLabel: string,
  rows: TransferBookExportLine[],
): void {
  const streams: string[] = [];
  let start = 0;
  let pageIndex = 0;
  if (rows.length === 0) {
    streams.push(pageStream(partyName, rangeLabel, summaryLabel, [], 0, 0));
  } else {
    while (start < rows.length) {
      const n = rowsPerPage(pageIndex);
      streams.push(pageStream(partyName, rangeLabel, summaryLabel, rows, start, pageIndex));
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

  triggerDownload(transferBookExportBasename(partyName) + '.pdf', 'application/pdf', pdf);
}
