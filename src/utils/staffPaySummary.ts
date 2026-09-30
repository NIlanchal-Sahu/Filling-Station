/** Fixed payroll month length for daily rate. */
export const PAYROLL_BASE_MONTH_DAYS = 30;

/** Included paid leave days added to shifts for gross. */
export const PAYROLL_DEFAULT_PAID_LEAVES = 2;

export type StaffPaySummaryCalc = {
  baseSalaryInr: number | null;
  absentDays: number;
  allowedPaidLeaves: number;
  totalPaidDays: number;
  dailyRateInr: number | null;
  grossDueInr: number | null;
  netBalanceInr: number | null;
};

function roundMoney2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Monthly salary, or shift rate × 30 when only per-shift rate is set. */
export function resolveBaseSalaryInr(
  monthlySalaryInr: number | null,
  shiftPayRateInr: number | null,
): number | null {
  if (monthlySalaryInr != null && Number.isFinite(monthlySalaryInr) && monthlySalaryInr >= 0) {
    return monthlySalaryInr;
  }
  if (shiftPayRateInr != null && Number.isFinite(shiftPayRateInr) && shiftPayRateInr >= 0) {
    return roundMoney2(shiftPayRateInr * PAYROLL_BASE_MONTH_DAYS);
  }
  return null;
}

/**
 * Pay summary formulas:
 * - Total paid days = shifts worked + 2 paid leaves
 * - Daily rate = base salary / 30
 * - Gross = total paid days × daily rate
 * - Net balance = gross − salary paid − advance − short
 * - Absent days = max(0, calendar days in range − shifts − 2)
 */
export function computeStaffPaySummary(
  shiftsWorked: number,
  baseSalaryInr: number | null,
  salaryPaidInr: number,
  advancePaidInr: number,
  shortAmountInr: number,
  calendarDaysInRange: number,
): StaffPaySummaryCalc {
  const allowedPaidLeaves = PAYROLL_DEFAULT_PAID_LEAVES;
  const shifts = Math.max(0, Math.floor(shiftsWorked));
  const periodDays = Math.max(1, Math.floor(calendarDaysInRange));
  const absentDays = Math.max(0, periodDays - shifts - allowedPaidLeaves);
  const totalPaidDays = shifts + allowedPaidLeaves;

  if (baseSalaryInr == null || !Number.isFinite(baseSalaryInr)) {
    return {
      baseSalaryInr: null,
      absentDays,
      allowedPaidLeaves,
      totalPaidDays,
      dailyRateInr: null,
      grossDueInr: null,
      netBalanceInr: null,
    };
  }

  const dailyRateInr = roundMoney2(baseSalaryInr / PAYROLL_BASE_MONTH_DAYS);
  const grossDueInr = roundMoney2(totalPaidDays * dailyRateInr);
  const netBalanceInr = roundMoney2(
    grossDueInr - salaryPaidInr - advancePaidInr - shortAmountInr,
  );

  return {
    baseSalaryInr,
    absentDays,
    allowedPaidLeaves,
    totalPaidDays,
    dailyRateInr,
    grossDueInr,
    netBalanceInr,
  };
}
