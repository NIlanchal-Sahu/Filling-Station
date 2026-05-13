import type { Timestamp } from 'firebase/firestore';

/** Auth profile stored in `users/{uid}` (id matches Firebase Auth uid). */
export type UserRole = 'manager' | 'operator';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
}

export interface FuelType {
  id: string;
  name: string;
  currentRate: number;
  lastUpdatedAt: Timestamp;
}

export interface Nozzle {
  id: string;
  machineNumber: string;
  nozzleNumber: string;
  fuelTypeId: string;
  isActive: boolean;
}

export type ShiftStatus = 'open' | 'closed';

export interface Shift {
  id: string;
  operatorId: string;
  startTime: Timestamp;
  endTime: Timestamp | null;
  shiftLabel: string;
  status: ShiftStatus;
  /** Set when end-of-meter readings are saved; reconciliation still optional while open. */
  readingsCompleteAt: Timestamp | null;
  notes?: string;
  /** Names of pump attendants / staff on duty this shift (optional). */
  pumpAttendants?: string;
  /** Business calendar day chosen when starting shift (yyyy-MM-dd, local date). */
  calendarDate?: string;
}

export interface ShiftReading {
  id: string;
  shiftId: string;
  nozzleId: string;
  openingReading: number;
  closingReading: number;
  testLiters: number;
  totalLiters: number;
  finalSalesLiters: number;
  rateAtSale: number;
  totalAmount: number;
}

export type ReconciliationStatus = 'pending' | 'approved' | 'rejected';

export interface ReconciliationCreditLine {
  customerId: string;
  amount: number;
  fuelTypeId?: string;
  liters?: number;
  rateAtSale?: number;
}

export interface ShiftReconciliation {
  id: string;
  shiftId: string;
  operatorId: string;
  totalSalesAmount: number;
  paytmOnline: number;
  iciciCard: number;
  fleetCard: number;
  creditAmount: number;
  /** Cash shortage in hand; deducted from meter total when computing shift cash (same as Excel SHORT row). */
  shortAmount: number;
  cashAmount: number;
  totalReceived: number;
  difference: number;
  status: ReconciliationStatus;
  managerComment?: string;
  /** When true and status is approved, operators cannot change this doc until manager sets false. */
  locked: boolean;
  /** Split of credit to customers (also mirrored as creditSales rows). */
  creditLineItems: ReconciliationCreditLine[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreditCustomer {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  vehicleNumber?: string;
  isActive: boolean;
  /** Denormalized running balance; recompute in app for accuracy. */
  currentBalance: number;
}

export interface CreditSale {
  id: string;
  customerId: string;
  shiftId: string;
  date: Timestamp;
  amount: number;
  fuelTypeId?: string;
  liters?: number;
  /** ₹/L captured at posting (manual entry or parity with reconciliation). */
  rateAtSale?: number;
  reference?: string;
}

/**
 * Stored on credit payments / loan repayments. Use {@link CREDIT_PAYMENT_MODE_ORDER} for dropdowns.
 * Legacy values `online` / `upi` normalize to `phone`.
 */
export type CreditPaymentMode =
  | 'cash'
  | 'phone'
  | 'fleet_card'
  | 'cheque'
  | 'union_bank'
  | 'sbi_bank'
  | 'other';

export const CREDIT_PAYMENT_MODE_ORDER: readonly CreditPaymentMode[] = [
  'cash',
  'phone',
  'fleet_card',
  'cheque',
  'union_bank',
  'sbi_bank',
  'other',
] as const;

const CREDIT_PAYMENT_MODE_LABELS: Record<CreditPaymentMode, string> = {
  cash: 'CASH',
  phone: 'PHONE',
  fleet_card: 'FLEET CARD',
  cheque: 'CHEQUE',
  union_bank: 'UNION BANK',
  sbi_bank: 'SBI BANK',
  other: 'OTHER',
};

/** Normalize Firestore string (includes legacy modes). */
export function normalizeCreditPaymentMode(raw: unknown): CreditPaymentMode {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/\s+/g, '_') : '';
  const legacy: Record<string, CreditPaymentMode> = {
    cash: 'cash',
    phone: 'phone',
    fleet_card: 'fleet_card',
    fleetcard: 'fleet_card',
    cheque: 'cheque',
    check: 'cheque',
    union_bank: 'union_bank',
    unionbank: 'union_bank',
    sbi_bank: 'sbi_bank',
    sbibank: 'sbi_bank',
    other: 'other',
    online: 'phone',
    upi: 'phone',
  };
  const coerced = legacy[s];
  if (coerced) {
    return coerced;
  }
  if ((CREDIT_PAYMENT_MODE_ORDER as readonly string[]).includes(s)) {
    return s as CreditPaymentMode;
  }
  return 'other';
}

export function creditPaymentModeLabel(mode: unknown): string {
  return CREDIT_PAYMENT_MODE_LABELS[normalizeCreditPaymentMode(mode)];
}

export interface CreditPayment {
  id: string;
  customerId: string;
  date: Timestamp;
  amountReceived: number;
  mode: CreditPaymentMode;
  notes?: string;
}

export type LedgerType = 'expense' | 'income';

/** How settlement was routed (shown as TRANSACTION TYPE: Cash vs Bank). */
export type LedgerPaymentChannel = 'cash' | 'bank' | 'upi';

/** Map receipt mode → ledger txn type (cash drawer vs Phone Pe vs bank). */
export function creditPaymentModeLedgerChannel(mode: CreditPaymentMode): LedgerPaymentChannel {
  const m = normalizeCreditPaymentMode(mode);
  if (m === 'cash') {
    return 'cash';
  }
  if (m === 'phone') {
    return 'upi';
  }
  return 'bank';
}

export interface LedgerEntry {
  id: string;
  date: Timestamp;
  type: LedgerType;
  /** Cash drawer vs bank for display; inferred for older rows when missing. */
  paymentChannel?: LedgerPaymentChannel;
  paidToOrReceivedFrom: string;
  particulars: string;
  category: string;
  amount: number;
  relatedCreditPaymentId?: string;
  /** Optional link id when row was created from removed Loans feature (legacy). */
  relatedLoanId?: string;
  relatedLoanRepaymentId?: string;
  createdBy: string;
  createdAt: Timestamp;
}

export const SHIFT_LABELS = [
  '6 AM – 2 PM',
  '2 PM – 10 PM',
  '10 PM – 6 AM',
] as const;

export type ShiftLabel = (typeof SHIFT_LABELS)[number];

export const LEDGER_CATEGORIES = {
  EXPENSE: ['EXPENSES', 'SALARY', 'MAINTENANCE', 'MISC', 'OTHER'] as const,
} as const;
