import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { LOCAL_DEMO } from '@/config/appMode';
import type {
  CreditCustomer,
  CreditPayment,
  CreditPaymentMode,
  CreditSale,
  FuelType,
  LedgerEntry,
  LedgerType,
  Nozzle,
  ReconciliationCreditLine,
  Shift,
  ShiftReading,
  ShiftReconciliation,
  User,
  UserRole,
} from '@/types/entities';
import {
  creditPaymentModeLabel,
  creditPaymentModeLedgerChannel,
  normalizeCreditPaymentMode,
} from '@/types/entities';

const STORAGE_KEY = 'pumpstock-local-demo-v8';

type StoredUser = {
  name: string;
  role: string;
  phone?: string | null;
  isActive: boolean;
};
type StoredFuelType = { name: string; currentRate: number; lastUpdatedMs: number };
type StoredNozzle = {
  machineNumber: string;
  nozzleNumber: string;
  fuelTypeId: string;
  isActive: boolean;
};
type StoredShift = {
  operatorId: string;
  startMs: number;
  endMs: number | null;
  shiftLabel: string;
  status: 'open' | 'closed';
  readingsCompleteMs: number | null;
  notes?: string | null;
  pumpAttendants?: string | null;
  calendarDate?: string | null;
};
type StoredReading = {
  shiftId: string;
  nozzleId: string;
  openingReading: number;
  closingReading: number;
  testLiters: number;
  totalLiters: number;
  finalSalesLiters: number;
  rateAtSale: number;
  totalAmount: number;
};
type StoredRecon = {
  shiftId: string;
  operatorId: string;
  totalSalesAmount: number;
  paytmOnline: number;
  iciciCard: number;
  fleetCard: number;
  creditAmount: number;
  shortAmount?: number;
  cashAmount: number;
  totalReceived: number;
  difference: number;
  status: 'pending' | 'approved' | 'rejected';
  managerComment?: string | null;
  locked: boolean;
  creditLineItems: ReconciliationCreditLine[];
  createdMs: number;
  updatedMs: number;
};
type StoredCreditCustomer = {
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  vehicleNumber?: string | null;
  isActive: boolean;
  currentBalance: number;
};
type StoredCreditSale = {
  customerId: string;
  shiftId: string;
  dateMs: number;
  amount: number;
  fuelTypeId?: string | null;
  liters?: number | null;
  rateAtSale?: number | null;
  reference?: string | null;
};
type StoredCreditPayment = {
  customerId: string;
  dateMs: number;
  amountReceived: number;
  mode: string;
  notes?: string | null;
};
type StoredLedger = {
  dateMs: number;
  type: string;
  paymentChannel?: string;
  paidToOrReceivedFrom: string;
  particulars: string;
  category: string;
  amount: number;
  relatedCreditPaymentId?: string | null;
  relatedLoanId?: string | null;
  relatedLoanRepaymentId?: string | null;
  createdBy: string;
  createdMs: number;
};

type Rows = {
  users: Record<string, StoredUser>;
  fuelTypes: Record<string, StoredFuelType>;
  nozzles: Record<string, StoredNozzle>;
  shifts: Record<string, StoredShift>;
  shiftReadings: Record<string, StoredReading>;
  shiftReconciliations: Record<string, StoredRecon>;
  creditCustomers: Record<string, StoredCreditCustomer>;
  creditSales: Record<string, StoredCreditSale>;
  creditPayments: Record<string, StoredCreditPayment>;
  ledgerEntries: Record<string, StoredLedger>;
};

let row: Rows = emptyRows();

function emptyRows(): Rows {
  return {
    users: {},
    fuelTypes: {},
    nozzles: {},
    shifts: {},
    shiftReadings: {},
    shiftReconciliations: {},
    creditCustomers: {},
    creditSales: {},
    creditPayments: {},
    ledgerEntries: {},
  };
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function persist(): void {
  if (!LOCAL_DEMO || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(row));
  } catch {
    /* ignore quota */
  }
}

function ensureLoaded(): void {
  if (!LOCAL_DEMO) return;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Rows> & { loans?: unknown; loanRepayments?: unknown };
      const { loans: _omitLoans, loanRepayments: _omitLoanRepayments, ...rest } = parsed;
      row = { ...emptyRows(), ...rest };
    } else {
      seed();
      persist();
    }
  } catch {
    seed();
    persist();
  }
}

function seed(): void {
  row = emptyRows();
  row.users['demo-manager'] = { name: 'Demo Manager', role: 'manager', isActive: true };
  row.users['demo-operator'] = { name: 'Demo Operator', role: 'operator', isActive: true };
  const now = Date.now();
  row.fuelTypes['fuel-p'] = { name: 'PETROL', currentRate: 107.9, lastUpdatedMs: now };
  row.fuelTypes['fuel-d'] = { name: 'DIESEL', currentRate: 95.8, lastUpdatedMs: now };
  row.fuelTypes['fuel-x'] = { name: 'XP', currentRate: 112.5, lastUpdatedMs: now };
  /* M×N grid: M1(N1,N2 PETROL; N3,N4 XP); M2(N1,N2 DIESEL; N3,N4 PETROL); M3(all DIESEL) */
  const fuelByMachineNozzle = [
    ['fuel-p', 'fuel-p', 'fuel-x', 'fuel-x'],
    ['fuel-d', 'fuel-d', 'fuel-p', 'fuel-p'],
    ['fuel-d', 'fuel-d', 'fuel-d', 'fuel-d'],
  ] as const;
  for (let m = 1; m <= 3; m += 1) {
    for (let n = 1; n <= 4; n += 1) {
      const id = `nz-${m}-${n}`;
      row.nozzles[id] = {
        machineNumber: String(m),
        nozzleNumber: String(n),
        fuelTypeId: fuelByMachineNozzle[m - 1][n - 1],
        isActive: true,
      };
    }
  }
  row.creditCustomers['cc-1'] = {
    name: 'Sample Credit Fleet',
    isActive: true,
    currentBalance: 0,
  };
}

ensureLoaded();

/* ---- mappers --------------------------------------------------------- */

function mapUser(id: string, u: StoredUser): User {
  return {
    id,
    name: u.name,
    role: u.role === 'manager' ? 'manager' : 'operator',
    phone: u.phone ?? undefined,
    isActive: u.isActive !== false,
  };
}
function mapFt(id: string, f: StoredFuelType): FuelType {
  return {
    id,
    name: f.name,
    currentRate: f.currentRate,
    lastUpdatedAt: Timestamp.fromMillis(f.lastUpdatedMs),
  };
}
function mapNozzle(id: string, n: StoredNozzle): Nozzle {
  return {
    id,
    machineNumber: n.machineNumber,
    nozzleNumber: n.nozzleNumber,
    fuelTypeId: n.fuelTypeId,
    isActive: n.isActive !== false,
  };
}
function mapShift(id: string, s: StoredShift): Shift {
  const cal =
    typeof s.calendarDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.calendarDate.trim())
      ? s.calendarDate.trim()
      : undefined;
  return {
    id,
    operatorId: s.operatorId,
    shiftLabel: s.shiftLabel,
    status: s.status,
    notes: s.notes ?? undefined,
    pumpAttendants: s.pumpAttendants?.trim() ? s.pumpAttendants.trim() : undefined,
    calendarDate: cal,
    startTime: Timestamp.fromMillis(s.startMs),
    endTime: s.endMs === null ? null : Timestamp.fromMillis(s.endMs),
    readingsCompleteAt:
      s.readingsCompleteMs === null ? null : Timestamp.fromMillis(s.readingsCompleteMs),
  };
}

export async function demoGetUser(uid: string): Promise<User | null> {
  ensureLoaded();
  const u = row.users[uid];
  return u ? mapUser(uid, u) : null;
}
export async function demoListActiveUsers(): Promise<User[]> {
  ensureLoaded();
  return Object.entries(row.users)
    .filter(([, u]) => u.isActive !== false)
    .map(([id, u]) => mapUser(id, u));
}
export async function demoListUsersForManager(): Promise<User[]> {
  ensureLoaded();
  return Object.entries(row.users).map(([id, u]) => mapUser(id, u));
}
export async function demoUpsertUser(uid: string, input: Omit<User, 'id'>): Promise<void> {
  ensureLoaded();
  row.users[uid] = {
    name: input.name,
    role: input.role,
    phone: input.phone ?? null,
    isActive: input.isActive,
  };
  persist();
}
export async function demoUpdateUserRole(uid: string, role: UserRole): Promise<void> {
  ensureLoaded();
  if (!row.users[uid]) return;
  row.users[uid].role = role;
  persist();
}

export async function demoListFuelTypes(): Promise<FuelType[]> {
  ensureLoaded();
  return Object.entries(row.fuelTypes).map(([id, f]) => mapFt(id, f));
}
export async function demoGetFuelType(id: string): Promise<FuelType | null> {
  ensureLoaded();
  const f = row.fuelTypes[id];
  return f ? mapFt(id, f) : null;
}
export async function demoCreateFuelType(name: string, currentRate: number): Promise<string> {
  ensureLoaded();
  const id = newId('fuel');
  row.fuelTypes[id] = { name, currentRate, lastUpdatedMs: Date.now() };
  persist();
  return id;
}
export async function demoUpdateFuelRate(id: string, currentRate: number): Promise<void> {
  ensureLoaded();
  if (!row.fuelTypes[id]) return;
  row.fuelTypes[id].currentRate = currentRate;
  row.fuelTypes[id].lastUpdatedMs = Date.now();
  persist();
}

export async function demoListNozzles(activeOnly = true): Promise<Nozzle[]> {
  ensureLoaded();
  let list = Object.entries(row.nozzles).map(([id, n]) => mapNozzle(id, n));
  if (activeOnly) list = list.filter((n) => n.isActive);
  return list.sort(
    (a, b) =>
      a.machineNumber.localeCompare(b.machineNumber, undefined, { numeric: true }) ||
      a.nozzleNumber.localeCompare(b.nozzleNumber, undefined, { numeric: true }),
  );
}
export async function demoGetNozzle(id: string): Promise<Nozzle | null> {
  ensureLoaded();
  const n = row.nozzles[id];
  return n ? mapNozzle(id, n) : null;
}
export async function demoCreateNozzle(input: {
  machineNumber: string;
  nozzleNumber: string;
  fuelTypeId: string;
}): Promise<string> {
  ensureLoaded();
  const id = newId('nz');
  row.nozzles[id] = {
    machineNumber: input.machineNumber,
    nozzleNumber: input.nozzleNumber,
    fuelTypeId: input.fuelTypeId,
    isActive: true,
  };
  persist();
  return id;
}
export async function demoSetNozzleActive(id: string, isActive: boolean): Promise<void> {
  ensureLoaded();
  if (!row.nozzles[id]) return;
  row.nozzles[id].isActive = isActive;
  persist();
}

export async function demoGetShift(shiftId: string): Promise<Shift | null> {
  ensureLoaded();
  const s = row.shifts[shiftId];
  return s ? mapShift(shiftId, s) : null;
}
export async function demoListOpenShiftsForOperator(operatorId: string): Promise<Shift[]> {
  ensureLoaded();
  return Object.entries(row.shifts)
    .filter(([, s]) => s.operatorId === operatorId && s.status === 'open')
    .map(([id, s]) => mapShift(id, s));
}
export async function demoListShiftsForDateRange(from: Date, to: Date): Promise<Shift[]> {
  ensureLoaded();
  const a = from.getTime();
  const b = to.getTime();
  return Object.entries(row.shifts)
    .filter(([, s]) => {
      const t = s.startMs;
      return t >= a && t <= b;
    })
    .map(([id, s]) => mapShift(id, s))
    .sort((x, y) => x.startTime.toMillis() - y.startTime.toMillis());
}

/** Shifts whose stored `calendarDate` falls in [fromIso, toIso] (yyyy-MM-dd string order). */
export async function demoListShiftsForCalendarDateRange(
  fromIso: string,
  toIso: string,
): Promise<Shift[]> {
  ensureLoaded();
  const valid = (raw: string | null | undefined): raw is string =>
    typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim());
  return Object.entries(row.shifts)
    .filter(([, s]) => {
      const cal = valid(s.calendarDate) ? s.calendarDate.trim() : null;
      if (!cal) return false;
      return cal >= fromIso && cal <= toIso;
    })
    .map(([id, s]) => mapShift(id, s))
    .sort((x, y) => x.startTime.toMillis() - y.startTime.toMillis());
}
export async function demoListClosedShiftsInRange(from: Date, to: Date): Promise<Shift[]> {
  ensureLoaded();
  const a = from.getTime();
  const b = to.getTime();
  return Object.entries(row.shifts)
    .filter(([, s]) => s.status === 'closed' && s.endMs !== null && s.endMs >= a && s.endMs <= b)
    .map(([id, s]) => mapShift(id, s));
}
export async function demoListClosedShiftsInEndTimeWindow(
  windowStart: Date,
  windowEnd: Date,
): Promise<Shift[]> {
  return demoListClosedShiftsInRange(windowStart, windowEnd);
}
export async function demoCreateShift(input: {
  operatorId: string;
  shiftLabel: string;
  calendarDate: string;
  notes?: string;
  pumpAttendants?: string;
}): Promise<string> {
  ensureLoaded();
  const id = newId('shift');
  const now = Date.now();
  const pt = input.pumpAttendants?.trim();
  const cal = /^\d{4}-\d{2}-\d{2}$/.test(input.calendarDate.trim())
    ? input.calendarDate.trim()
    : format(new Date(now), 'yyyy-MM-dd');
  row.shifts[id] = {
    operatorId: input.operatorId,
    shiftLabel: input.shiftLabel,
    calendarDate: cal,
    notes: input.notes ?? null,
    pumpAttendants: pt ? pt : null,
    status: 'open',
    startMs: now,
    endMs: null,
    readingsCompleteMs: null,
  };
  persist();
  return id;
}
export async function demoSetShiftReadingsComplete(shiftId: string): Promise<void> {
  ensureLoaded();
  if (!row.shifts[shiftId]) return;
  row.shifts[shiftId].readingsCompleteMs = Date.now();
  persist();
}
export async function demoCloseShift(shiftId: string): Promise<void> {
  ensureLoaded();
  if (!row.shifts[shiftId]) return;
  row.shifts[shiftId].status = 'closed';
  row.shifts[shiftId].endMs = Date.now();
  persist();
}
export async function demoListRecentShifts(limitN: number): Promise<Shift[]> {
  ensureLoaded();
  return Object.entries(row.shifts)
    .map(([id, s]) => mapShift(id, s))
    .sort((a, b) => b.startTime.toMillis() - a.startTime.toMillis())
    .slice(0, limitN);
}

export async function demoListReadingsForShift(shiftId: string): Promise<ShiftReading[]> {
  ensureLoaded();
  return Object.entries(row.shiftReadings)
    .filter(([, r]) => r.shiftId === shiftId)
    .map(([id, r]) => ({
      id,
      shiftId: r.shiftId,
      nozzleId: r.nozzleId,
      openingReading: r.openingReading,
      closingReading: r.closingReading,
      testLiters: r.testLiters,
      totalLiters: r.totalLiters,
      finalSalesLiters: r.finalSalesLiters,
      rateAtSale: r.rateAtSale,
      totalAmount: r.totalAmount,
    }));
}
export async function demoGetReading(id: string): Promise<ShiftReading | null> {
  ensureLoaded();
  const r = row.shiftReadings[id];
  if (!r) return null;
  return {
    id,
    shiftId: r.shiftId,
    nozzleId: r.nozzleId,
    openingReading: r.openingReading,
    closingReading: r.closingReading,
    testLiters: r.testLiters,
    totalLiters: r.totalLiters,
    finalSalesLiters: r.finalSalesLiters,
    rateAtSale: r.rateAtSale,
    totalAmount: r.totalAmount,
  };
}
export async function demoGetLastClosingForNozzle(nozzleId: string): Promise<number> {
  ensureLoaded();
  let bestTs = -1;
  let bestClosing = 0;
  for (const [sid, shift] of Object.entries(row.shifts)) {
    const metersDone =
      typeof shift.readingsCompleteMs === 'number' &&
      Number.isFinite(shift.readingsCompleteMs) &&
      shift.readingsCompleteMs > 0;
    let ts: number;
    if (shift.status === 'closed' && shift.endMs != null) {
      ts = shift.endMs;
    } else if (metersDone) {
      ts = shift.readingsCompleteMs!;
    } else {
      continue;
    }
    for (const [, read] of Object.entries(row.shiftReadings)) {
      if (read.shiftId !== sid || read.nozzleId !== nozzleId) {
        continue;
      }
      if (ts > bestTs || (ts === bestTs && read.closingReading > bestClosing)) {
        bestTs = ts;
        bestClosing = read.closingReading;
      }
    }
  }
  return bestClosing;
}
export async function demoCreateInitialReadings(
  shiftId: string,
  nozzleIds: string[],
  openingByNozzle: Record<string, number>,
): Promise<void> {
  ensureLoaded();
  for (const nId of nozzleIds) {
    const open = openingByNozzle[nId] ?? 0;
    const id = newId('read');
    row.shiftReadings[id] = {
      shiftId,
      nozzleId: nId,
      openingReading: open,
      closingReading: open,
      testLiters: 0,
      totalLiters: 0,
      finalSalesLiters: 0,
      rateAtSale: 0,
      totalAmount: 0,
    };
  }
  persist();
}
export async function demoUpdateReadingsOnEnd(
  updates: {
    id: string;
    openingReading: number;
    closingReading: number;
    testLiters: number;
    totalLiters: number;
    finalSalesLiters: number;
    rateAtSale: number;
    totalAmount: number;
  }[],
): Promise<void> {
  ensureLoaded();
  for (const u of updates) {
    const r = row.shiftReadings[u.id];
    if (!r) continue;
    row.shiftReadings[u.id] = {
      ...r,
      openingReading: u.openingReading,
      closingReading: u.closingReading,
      testLiters: u.testLiters,
      totalLiters: u.totalLiters,
      finalSalesLiters: u.finalSalesLiters,
      rateAtSale: u.rateAtSale,
      totalAmount: u.totalAmount,
    };
  }
  persist();
}

function mapRecon(id: string, d: StoredRecon): ShiftReconciliation {
  return {
    id,
    shiftId: d.shiftId,
    operatorId: d.operatorId,
    totalSalesAmount: d.totalSalesAmount,
    paytmOnline: d.paytmOnline,
    iciciCard: d.iciciCard,
    fleetCard: d.fleetCard,
    creditAmount: d.creditAmount,
    shortAmount: d.shortAmount ?? 0,
    cashAmount: d.cashAmount,
    totalReceived: d.totalReceived,
    difference: d.difference,
    status: d.status,
    managerComment: d.managerComment ?? undefined,
    locked: d.locked === true,
    creditLineItems: d.creditLineItems ?? [],
    createdAt: Timestamp.fromMillis(d.createdMs),
    updatedAt: Timestamp.fromMillis(d.updatedMs),
  };
}
export async function demoGetReconciliationForShift(
  shiftId: string,
): Promise<ShiftReconciliation | null> {
  ensureLoaded();
  let best: { id: string; d: StoredRecon } | null = null;
  for (const [id, r] of Object.entries(row.shiftReconciliations)) {
    if (r.shiftId !== shiftId) continue;
    if (!best || r.createdMs > best.d.createdMs) {
      best = { id, d: r };
    }
  }
  return best ? mapRecon(best.id, best.d) : null;
}
export async function demoGetReconciliation(id: string): Promise<ShiftReconciliation | null> {
  ensureLoaded();
  const r = row.shiftReconciliations[id];
  return r ? mapRecon(id, r) : null;
}
export async function demoListPendingReconciliations(): Promise<ShiftReconciliation[]> {
  ensureLoaded();
  return Object.entries(row.shiftReconciliations)
    .filter(([, r]) => r.status === 'pending')
    .map(([id, r]) => mapRecon(id, r))
    .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
}
async function bumpCustomerBalance(customerId: string, deltaCredit: number): Promise<void> {
  const c = row.creditCustomers[customerId];
  if (!c) return;
  c.currentBalance = (c.currentBalance ?? 0) + deltaCredit;
}
export async function demoCreateCreditSalesForReconciliation(
  _rid: string,
  shiftId: string,
  lines: ReconciliationCreditLine[],
): Promise<void> {
  ensureLoaded();
  const nowMs = Date.now();
  for (const line of lines) {
    if (line.amount <= 0) continue;
    const id = newId('sale');
    row.creditSales[id] = {
      customerId: line.customerId,
      shiftId,
      dateMs: nowMs,
      amount: line.amount,
      fuelTypeId: line.fuelTypeId ?? null,
      liters: line.liters ?? null,
      rateAtSale: line.rateAtSale ?? null,
      reference: `SHIFT_RECON:${shiftId}`,
    };
    await bumpCustomerBalance(line.customerId, line.amount);
  }
  persist();
}

export async function demoCreateManualCreditSale(input: {
  customerId: string;
  date: Date;
  fuelTypeId: string;
  liters: number;
  rateAtSale: number;
  amount: number;
}): Promise<string> {
  ensureLoaded();
  const id = newId('sale');
  row.creditSales[id] = {
    customerId: input.customerId,
    shiftId: '__mgr_credit__',
    dateMs: input.date.getTime(),
    amount: input.amount,
    fuelTypeId: input.fuelTypeId,
    liters: input.liters,
    rateAtSale: input.rateAtSale,
    reference: 'MANAGER_ENTRY',
  };
  await bumpCustomerBalance(input.customerId, input.amount);
  persist();
  return id;
}

export async function demoCreateReconciliationWithClose(input: {
  shiftId: string;
  operatorId: string;
  totalSalesAmount: number;
  paytmOnline: number;
  iciciCard: number;
  fleetCard: number;
  creditAmount: number;
  shortAmount: number;
  cashAmount: number;
  totalReceived: number;
  difference: number;
  creditLineItems: ReconciliationCreditLine[];
}): Promise<string> {
  ensureLoaded();
  const id = newId('recon');
  const now = Date.now();
  row.shiftReconciliations[id] = {
    shiftId: input.shiftId,
    operatorId: input.operatorId,
    totalSalesAmount: input.totalSalesAmount,
    paytmOnline: input.paytmOnline,
    iciciCard: input.iciciCard,
    fleetCard: input.fleetCard,
    creditAmount: input.creditAmount,
    shortAmount: input.shortAmount,
    cashAmount: input.cashAmount,
    totalReceived: input.totalReceived,
    difference: input.difference,
    status: 'pending',
    locked: false,
    creditLineItems: input.creditLineItems,
    createdMs: now,
    updatedMs: now,
  };
  persist();
  if (input.creditLineItems.length > 0) {
    await demoCreateCreditSalesForReconciliation(id, input.shiftId, input.creditLineItems);
  }
  await demoCloseShift(input.shiftId);
  persist();
  return id;
}
export async function demoSetReconciliationStatus(
  id: string,
  status: 'approved' | 'rejected',
  managerComment?: string,
): Promise<void> {
  ensureLoaded();
  const r = row.shiftReconciliations[id];
  if (!r) return;
  r.status = status;
  r.managerComment = managerComment ?? null;
  r.locked = status === 'approved';
  r.updatedMs = Date.now();
  persist();
}
export async function demoSetReconciliationUnlocked(id: string, unlocked: boolean): Promise<void> {
  ensureLoaded();
  const r = row.shiftReconciliations[id];
  if (!r) return;
  r.locked = !unlocked;
  r.updatedMs = Date.now();
  persist();
}

function mapCust(id: string, c: StoredCreditCustomer): CreditCustomer {
  return {
    id,
    name: c.name,
    contactPerson: c.contactPerson ?? undefined,
    phone: c.phone ?? undefined,
    vehicleNumber: c.vehicleNumber ?? undefined,
    isActive: c.isActive !== false,
    currentBalance: Number(c.currentBalance ?? 0),
  };
}
export async function demoGetCustomer(id: string): Promise<CreditCustomer | null> {
  ensureLoaded();
  const c = row.creditCustomers[id];
  return c ? mapCust(id, c) : null;
}
export async function demoListCreditCustomers(includeInactive: boolean): Promise<CreditCustomer[]> {
  ensureLoaded();
  return Object.entries(row.creditCustomers)
    .filter(([, c]) => includeInactive || c.isActive)
    .map(([id, c]) => mapCust(id, c))
    .sort((a, b) => a.name.localeCompare(b.name));
}
export async function demoRecomputeAllBalancesFromLedger(): Promise<void> {
  ensureLoaded();
  const byC = new Map<string, { sales: number; pay: number }>();
  for (const s of Object.values(row.creditSales)) {
    const b = byC.get(s.customerId) ?? { sales: 0, pay: 0 };
    b.sales += s.amount;
    byC.set(s.customerId, b);
  }
  for (const p of Object.values(row.creditPayments)) {
    const b = byC.get(p.customerId) ?? { sales: 0, pay: 0 };
    b.pay += p.amountReceived;
    byC.set(p.customerId, b);
  }
  for (const [id, cust] of Object.entries(row.creditCustomers)) {
    const t = byC.get(id) ?? { sales: 0, pay: 0 };
    cust.currentBalance = t.sales - t.pay;
  }
  persist();
}
export async function demoCreateCustomer(
  input: Omit<CreditCustomer, 'id' | 'currentBalance'>,
): Promise<string> {
  ensureLoaded();
  const id = newId('cc');
  row.creditCustomers[id] = {
    name: input.name,
    contactPerson: input.contactPerson ?? null,
    phone: input.phone ?? null,
    vehicleNumber: input.vehicleNumber ?? null,
    isActive: input.isActive,
    currentBalance: 0,
  };
  persist();
  return id;
}
export async function demoUpdateCustomer(
  id: string,
  patch: Partial<
    Pick<
      CreditCustomer,
      'name' | 'contactPerson' | 'phone' | 'vehicleNumber' | 'isActive' | 'currentBalance'
    >
  >,
): Promise<void> {
  ensureLoaded();
  const r = row.creditCustomers[id];
  if (!r) return;
  if (patch.name != null) r.name = patch.name;
  if (patch.contactPerson !== undefined) r.contactPerson = patch.contactPerson ?? null;
  if (patch.phone !== undefined) r.phone = patch.phone ?? null;
  if (patch.vehicleNumber !== undefined) r.vehicleNumber = patch.vehicleNumber ?? null;
  if (patch.isActive != null) r.isActive = patch.isActive;
  persist();
}

function mapPay(id: string, p: StoredCreditPayment): CreditPayment {
  return {
    id,
    customerId: p.customerId,
    date: Timestamp.fromMillis(p.dateMs),
    amountReceived: p.amountReceived,
    mode: normalizeCreditPaymentMode(p.mode),
    notes: p.notes ?? undefined,
  };
}
export async function demoListPaymentsForCustomer(customerId: string): Promise<CreditPayment[]> {
  ensureLoaded();
  return Object.entries(row.creditPayments)
    .filter(([, p]) => p.customerId === customerId)
    .map(([id, p]) => mapPay(id, p))
    .sort((a, b) => b.date.toMillis() - a.date.toMillis());
}
export async function demoListAllCreditPayments(): Promise<CreditPayment[]> {
  ensureLoaded();
  return Object.entries(row.creditPayments).map(([id, p]) => mapPay(id, p));
}
export async function demoListPaymentsInRange(from: Date, to: Date): Promise<CreditPayment[]> {
  ensureLoaded();
  const a = from.getTime();
  const b = to.getTime();
  return Object.entries(row.creditPayments)
    .filter(([, p]) => p.dateMs >= a && p.dateMs <= b)
    .map(([id, p]) => mapPay(id, p))
    .sort((x, y) => x.date.toMillis() - y.date.toMillis());
}
export async function demoRecordPayment(input: {
  customerId: string;
  amountReceived: number;
  date: Date;
  mode: CreditPaymentMode;
  notes?: string;
  customerName: string;
  createdBy: string;
}): Promise<string> {
  ensureLoaded();
  const id = newId('pay');
  row.creditPayments[id] = {
    customerId: input.customerId,
    dateMs: input.date.getTime(),
    amountReceived: input.amountReceived,
    mode: input.mode,
    notes: input.notes ?? null,
  };
  const c = row.creditCustomers[input.customerId];
  if (c) {
    c.currentBalance -= input.amountReceived;
  }
  const lid = newId('led');
  row.ledgerEntries[lid] = {
    dateMs: input.date.getTime(),
    type: 'income',
    paymentChannel: creditPaymentModeLedgerChannel(input.mode),
    paidToOrReceivedFrom: `Due received: ${input.customerName}`,
    particulars: `Due Received from ${input.customerName} (${creditPaymentModeLabel(input.mode)})`,
    category: 'SALES',
    amount: input.amountReceived,
    relatedCreditPaymentId: id,
    createdBy: input.createdBy,
    createdMs: Date.now(),
  };
  persist();
  return id;
}

function mapSale(id: string, s: StoredCreditSale): CreditSale {
  return {
    id,
    customerId: s.customerId,
    shiftId: s.shiftId,
    date: Timestamp.fromMillis(s.dateMs),
    amount: s.amount,
    fuelTypeId: s.fuelTypeId ?? undefined,
    liters: s.liters ?? undefined,
    rateAtSale: s.rateAtSale != null ? Number(s.rateAtSale) : undefined,
    reference: s.reference ?? undefined,
  };
}
export async function demoListSalesForCustomer(customerId: string): Promise<CreditSale[]> {
  ensureLoaded();
  return Object.entries(row.creditSales)
    .filter(([, s]) => s.customerId === customerId)
    .map(([id, s]) => mapSale(id, s))
    .sort((a, b) => b.date.toMillis() - a.date.toMillis());
}
export async function demoListAllCreditSales(): Promise<CreditSale[]> {
  ensureLoaded();
  return Object.entries(row.creditSales).map(([id, s]) => mapSale(id, s));
}

function mapLed(id: string, e: StoredLedger): LedgerEntry {
  const ch =
    e.paymentChannel === 'bank' || e.paymentChannel === 'cash' || e.paymentChannel === 'upi'
      ? (e.paymentChannel as LedgerEntry['paymentChannel'])
      : undefined;
  return {
    id,
    date: Timestamp.fromMillis(e.dateMs),
    type: (e.type as LedgerType) ?? 'expense',
    paymentChannel: ch,
    paidToOrReceivedFrom: e.paidToOrReceivedFrom,
    particulars: e.particulars,
    category: e.category,
    amount: e.amount,
    relatedCreditPaymentId: e.relatedCreditPaymentId ?? undefined,
    relatedLoanId: e.relatedLoanId ?? undefined,
    relatedLoanRepaymentId: e.relatedLoanRepaymentId ?? undefined,
    createdBy: e.createdBy,
    createdAt: Timestamp.fromMillis(e.createdMs),
  };
}
export async function demoCreateLedgerEntry(input: {
  date: Date;
  type: LedgerType;
  paymentChannel?: LedgerEntry['paymentChannel'];
  paidToOrReceivedFrom: string;
  particulars: string;
  category: string;
  amount: number;
  relatedCreditPaymentId?: string;
  relatedLoanId?: string;
  relatedLoanRepaymentId?: string;
  createdBy: string;
}): Promise<string> {
  ensureLoaded();
  const id = newId('led');
  const now = Date.now();
  row.ledgerEntries[id] = {
    dateMs: input.date.getTime(),
    type: input.type,
    ...(input.paymentChannel ? { paymentChannel: input.paymentChannel } : {}),
    paidToOrReceivedFrom: input.paidToOrReceivedFrom,
    particulars: input.particulars,
    category: input.category,
    amount: input.amount,
    relatedCreditPaymentId: input.relatedCreditPaymentId ?? null,
    relatedLoanId: input.relatedLoanId ?? null,
    relatedLoanRepaymentId: input.relatedLoanRepaymentId ?? null,
    createdBy: input.createdBy,
    createdMs: now,
  };
  persist();
  return id;
}

export async function demoDeleteLedgerEntry(id: string): Promise<void> {
  ensureLoaded();
  if (!row.ledgerEntries[id]) {
    return;
  }
  delete row.ledgerEntries[id];
  persist();
}

/** Preserves credit link and audit fields when updating a row. */
export async function demoUpdateLedgerEntry(
  id: string,
  input: {
    date: Date;
    type: LedgerType;
    paymentChannel: NonNullable<LedgerEntry['paymentChannel']>;
    paidToOrReceivedFrom: string;
    particulars: string;
    category: string;
    amount: number;
  },
): Promise<void> {
  ensureLoaded();
  const prev = row.ledgerEntries[id];
  if (!prev) {
    return;
  }
  row.ledgerEntries[id] = {
    ...prev,
    dateMs: input.date.getTime(),
    type: input.type,
    paymentChannel: input.paymentChannel,
    paidToOrReceivedFrom: input.paidToOrReceivedFrom,
    particulars: input.particulars,
    category: input.category,
    amount: input.amount,
  };
  persist();
}

export async function demoListLedgerInRange(
  from: Date,
  to: Date,
  typeFilter?: LedgerType,
): Promise<LedgerEntry[]> {
  ensureLoaded();
  const a = from.getTime();
  const b = to.getTime();
  let xs = Object.entries(row.ledgerEntries)
    .filter(([, e]) => e.dateMs >= a && e.dateMs <= b)
    .map(([id, e]) => mapLed(id, e));
  if (typeFilter) xs = xs.filter((e) => e.type === typeFilter);
  return xs.sort((x, y) => x.date.toMillis() - y.date.toMillis());
}
export async function demoListExpensesInRange(
  from: Date,
  to: Date,
  category?: string,
): Promise<LedgerEntry[]> {
  ensureLoaded();
  const all = await demoListLedgerInRange(from, to, 'expense');
  if (category) return all.filter((e) => e.category === category);
  return all;
}
export async function demoListAllLedgerForBalance(): Promise<LedgerEntry[]> {
  ensureLoaded();
  return Object.entries(row.ledgerEntries)
    .map(([id, e]) => mapLed(id, e))
    .sort((a, b) => a.date.toMillis() - b.date.toMillis());
}

export async function demoListAllReconciliations(): Promise<ShiftReconciliation[]> {
  ensureLoaded();
  return Object.entries(row.shiftReconciliations).map(([id, r]) => mapRecon(id, r));
}
export async function demoListReconciliationsInWindow(from: Date, to: Date): Promise<ShiftReconciliation[]> {
  ensureLoaded();
  const a = from.getTime();
  const b = to.getTime();
  return Object.entries(row.shiftReconciliations)
    .filter(([, r]) => r.createdMs >= a && r.createdMs <= b)
    .map(([id, r]) => mapRecon(id, r));
}

export function demoResetStores(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
  seed();
  persist();
}
