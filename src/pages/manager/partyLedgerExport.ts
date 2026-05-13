import { format } from 'date-fns';
import type { CreditSale } from '@/types/entities';
import type { PartyCreditLedgerDisplayRow } from '@/pages/manager/partyCreditLedger';
import { particularsForLedgerCreditSale } from '@/pages/manager/partyCreditLedger';

export const PARTY_LEDGER_CSV_HEADERS = [
  'Party',
  'Date',
  'Particulars',
  'Fuel',
  'Litres',
  'Rate_per_L_Rs',
  'Debit_Rs',
  'Credit_Rs',
  'Balance_Rs',
] as const;

/** Fuel / litre / rate cells depend on master data loaded in the UI. */
export type PartyLedgerFuelFormatters = {
  fuelUpper: (sale: CreditSale) => string;
  litresDisplay: (sale: CreditSale) => string;
  rateDisplay: (sale: CreditSale) => string;
};

/** Safe fragment for filenames on Windows/macOS/Linux. */
export function safeLedgerFilenameBasename(raw: string): string {
  const t = raw.replace(/[/\\:*?"<>|]+/g, '_').trim();
  return t.length > 0 ? t.slice(0, 120) : 'party';
}

function escHtml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function rowToCsv(
  partyName: string,
  row: PartyCreditLedgerDisplayRow,
  fm: PartyLedgerFuelFormatters,
): (string | number)[] {
  if (row.kind === 'broughtForward') {
    return [
      partyName,
      '—',
      'Brought forward (before entries below)',
      '—',
      '—',
      '—',
      '—',
      '—',
      row.balanceAfter.toFixed(2),
    ];
  }
  if (row.kind === 'payment') {
    return [
      partyName,
      row.dateLabel,
      `Payment · ${row.mode}`,
      '—',
      '—',
      '—',
      '—',
      row.creditRupees.toFixed(2),
      row.balanceAfter.toFixed(2),
    ];
  }
  const s = row.sale;
  const litresCell =
    s.liters != null && Number.isFinite(s.liters) ? fm.litresDisplay(s) : '—';
  return [
    partyName,
    row.dateLabel,
    particularsForLedgerCreditSale(s),
    fm.fuelUpper(s),
    litresCell,
    fm.rateDisplay(s),
    row.debitRupees.toFixed(2),
    '—',
    row.balanceAfter.toFixed(2),
  ];
}

export function creditLedgerCsvDataRows(
  partyName: string,
  rows: PartyCreditLedgerDisplayRow[],
  fm: PartyLedgerFuelFormatters,
): (string | number)[][] {
  return rows.map((r) => rowToCsv(partyName, r, fm));
}

function ledgerTableBodyHtml(rows: PartyCreditLedgerDisplayRow[], fm: PartyLedgerFuelFormatters): string {
  const parts: string[] = [];
  for (const row of rows) {
    if (row.kind === 'broughtForward') {
      parts.push(
        `<tr><td>—</td><td colspan="4">${escHtml('Brought forward (before entries below)')}</td><td>—</td><td>—</td><td class="num">${escHtml(row.balanceAfter.toFixed(2))}</td></tr>`,
      );
      continue;
    }
    if (row.kind === 'payment') {
      parts.push(
        `<tr><td>${escHtml(row.dateLabel)}</td><td>${escHtml(`Payment · ${row.mode}`)}</td><td>—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">${escHtml(row.creditRupees.toFixed(2))}</td><td class="num bal">${escHtml(row.balanceAfter.toFixed(2))}</td></tr>`,
      );
      continue;
    }
    const s = row.sale;
    const litresCell =
      s.liters != null && Number.isFinite(s.liters) ? fm.litresDisplay(s) : '—';
    parts.push(
      `<tr><td>${escHtml(row.dateLabel)}</td><td>${escHtml(particularsForLedgerCreditSale(s))}</td><td>${escHtml(fm.fuelUpper(s))}</td><td class="num">${escHtml(litresCell)}</td><td class="num">${escHtml(fm.rateDisplay(s))}</td><td class="num">${escHtml(row.debitRupees.toFixed(2))}</td><td class="num">—</td><td class="num bal">${escHtml(row.balanceAfter.toFixed(2))}</td></tr>`,
    );
  }
  return parts.join('\n');
}

export function buildPartyLedgerPrintableHtml(params: {
  partyName: string;
  currentBalanceOwed: number;
  rows: PartyCreditLedgerDisplayRow[];
  fm: PartyLedgerFuelFormatters;
  generatedAt?: Date;
}): string {
  const { partyName, currentBalanceOwed, rows, fm } = params;
  const at = params.generatedAt ?? new Date();
  const stamp = format(at, 'dd-MM-yyyy HH:mm');
  const body =
    rows.length === 0
      ? '<tr><td colspan="8">No ledger movements yet.</td></tr>'
      : ledgerTableBodyHtml(rows, fm);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${escHtml(partyName)} — credit ledger</title>
<style>
  body { font-family: system-ui, Segoe UI, Roboto, sans-serif; margin: 16px; color: #111; }
  h1 { font-size: 1.25rem; margin: 0 0 4px; }
  .meta { font-size: 0.875rem; color: #444; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; font-weight: 600; }
  td.num, th:nth-child(n+4) { text-align: right; }
  td.bal { font-weight: 600; }
  .foot { margin-top: 12px; font-size: 0.875rem; }
  @media print {
    body { margin: 8px; }
    a { display: none; }
  }
</style>
</head>
<body>
  <h1>Credit ledger</h1>
  <div class="meta">Party: <strong>${escHtml(partyName)}</strong> · Generated ${escHtml(stamp)} · Current balance (outstanding) ₹ <strong>${escHtml(currentBalanceOwed.toFixed(2))}</strong></div>
  <p class="meta">Oldest entry first. Debit = fuel on credit. Credit = payment received.</p>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Particulars</th>
        <th>Fuel</th>
        <th>Litres</th>
        <th>₹/L</th>
        <th>Debit ₹</th>
        <th>Credit ₹</th>
        <th>Balance ₹</th>
      </tr>
    </thead>
    <tbody>
${body}
    </tbody>
  </table>
  <p class="foot">Use your browser <strong>Print</strong> dialog and choose <strong>Save as PDF</strong> to share this statement.</p>
</body>
</html>`;
}

/** Opens a new tab with the ledger and triggers the print dialog (save as PDF from there). */
export function openPartyLedgerPrintDialog(params: {
  partyName: string;
  currentBalanceOwed: number;
  rows: PartyCreditLedgerDisplayRow[];
  fm: PartyLedgerFuelFormatters;
}): void {
  const html = buildPartyLedgerPrintableHtml(params);
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) {
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  window.setTimeout(() => {
    w.print();
  }, 200);
}
