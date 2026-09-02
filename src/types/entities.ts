import type { Timestamp } from 'firebase/firestore';

/** Auth profile stored in `users/{uid}` (id matches Firebase Auth uid). */
export type UserRole = 'manager' | 'operator' | 'admin';

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
  /** Tank capacity in liters (optional until configured). */
  tankCapacityLiters?: number;
  /** Minimum safe stock before refill alert. */
  reserveLiters?: number;
  /** Latest dip reading in liters. */
  currentStockLiters?: number;
  /** Latest physical dip-stick reading in centimetres. */
  lastDipCm?: number | null;
  lastDipAt?: Timestamp | null;
}

export type FuelStockHealth = 'healthy' | 'low' | 'critical';

export type DipKind = 'opening' | 'closing';

export interface FuelTankDipReading {
  id: string;
  fuelTypeId: string;
  /** Physical dip-stick reading in centimetres. */
  dipCm: number;
  /** Stock in liters derived from calibration chart. */
  dipLiters: number;
  /** Pump business day (yyyy-MM-dd). */
  pumpDayIso: string;
  dipKind: DipKind;
  recordedAt: Timestamp;
  recordedBy?: string;
  notes?: string;
}

export interface FuelReceipt {
  id: string;
  fuelTypeId: string;
  pumpDayIso: string;
  liters: number;
  supplier?: string;
  invoiceNo?: string;
  recordedBy?: string;
  notes?: string;
  recordedAt: Timestamp;
}

export interface DailyFuelStockRow {
  pumpDayIso: string;
  fuelTypeId: string;
  displayName: string;
  shortCode: string;
  openingDipCm: number | null;
  openingStockLiters: number;
  closingDipCm: number | null;
  closingStockLiters: number | null;
  currentDipCm: number | null;
  currentStockLiters: number;
  salesLiters: number;
  receiptLiters: number;
  expectedStockLiters: number;
  actualStockLiters: number | null;
  variationLiters: number | null;
  availablePercent: number;
  health: FuelStockHealth;
  dipEnteredToday: boolean;
  variationAlert: boolean;
  lowStockAlert: boolean;
  tankCapacityLiters: number;
  reserveLiters: number;
}

export interface TankStockDaySummary {
  pumpDayIso: string;
  rows: DailyFuelStockRow[];
  alerts: string[];
}

export interface FuelStockItem {
  fuelTypeId: string;
  displayName: string;
  shortCode: string;
  currentStockLiters: number;
  /** Latest dip-stick reading in cm (e.g. 96.6). */
  currentDipCm: number | null;
  tankCapacityLiters: number;
  reserveLiters: number;
  availablePercent: number;
  health: FuelStockHealth;
  lastDipAt: Timestamp | null;
  updatedToday: boolean;
  atOrBelowReserve: boolean;
}

export interface FuelStockOverview {
  items: FuelStockItem[];
  totalStockLiters: number;
  totalCapacityLiters: number;
  overallUtilizationPercent: number;
  hasData: boolean;
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

// ─── Lubricants ──────────────────────────────────────────────────────────────

export interface Lubricant {
  id: string;
  name: string;
  brand: string;
  grade: string;            // e.g. "20W-40", "15W-40"
  unit: string;             // e.g. "litre", "quart", "kg"
  sellingPrice: number;     // ₹ per unit
  purchasePrice: number;    // ₹ per unit
  currentStock: number;     // units in hand
  minStockAlert: number;    // low-stock threshold
  isActive: boolean;
}

/** Inward stock entry (purchase / receipt). */
export interface LubricantStockEntry {
  id: string;
  lubricantId: string;
  pumpDayIso: string;
  quantity: number;
  purchasePricePerUnit: number;
  supplier?: string;
  invoiceNo?: string;
  notes?: string;
  recordedBy?: string;
  recordedAt: Timestamp;
}

/** A single retail sale of one or more units. */
export interface LubricantSale {
  id: string;
  lubricantId: string;
  pumpDayIso: string;
  quantity: number;
  sellingPricePerUnit: number;
  totalAmount: number;
  customerName?: string;
  vehicleNumber?: string;
  notes?: string;
  recordedBy?: string;
  recordedAt: Timestamp;
}

export const LUBRICANT_UNITS = ['litre', '500ml', 'quart', 'kg', 'can', 'bottle'] as const;
export type LubricantUnit = (typeof LUBRICANT_UNITS)[number];

export const LUBRICANT_GRADES = [
  '20W-40', '20W-50', '15W-40', '10W-30', '10W-40', '5W-30', '5W-40', 'Other',
] as const;

export const LUBRICANT_UNIT_LABELS: Record<string, string> = {
  litre: 'Litre',
  '500ml': '500 ml',
  quart: 'Quart',
  kg: 'kg',
  can: 'Can',
  bottle: 'Bottle',
};

// ─────────────────────────────────────────────────────────────────────────────

export const LEDGER_CATEGORIES = {
  EXPENSE: ['EXPENSES', 'SALARY', 'MAINTENANCE', 'MISC', 'OTHER'] as const,
} as const;
