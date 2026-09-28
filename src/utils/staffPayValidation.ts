import type { StaffPayMode } from '@/types/entities';

export type ParsedStaffPay = {
  staffPayMode: StaffPayMode;
  shiftPayRateInr?: number;
  monthlySalaryInr?: number;
};

export function effectiveStaffPayMode(mode: StaffPayMode | undefined): StaffPayMode {
  return mode === 'monthly' ? 'monthly' : 'per_shift';
}

/** Parse pay fields for an operator; returns error message or parsed values. */
export function parseOperatorStaffPay(
  staffPayMode: StaffPayMode,
  shiftPayRateRaw: string,
  monthlySalaryRaw: string,
): { ok: true; value: ParsedStaffPay } | { ok: false; error: string } {
  if (staffPayMode === 'monthly') {
    const trimmed = monthlySalaryRaw.trim();
    if (trimmed === '') {
      return { ok: false, error: 'Enter monthly salary (₹).' };
    }
    const monthlySalaryInr = Number(trimmed);
    if (!Number.isFinite(monthlySalaryInr) || monthlySalaryInr <= 0) {
      return { ok: false, error: 'Monthly salary must be a positive number.' };
    }
    return {
      ok: true,
      value: { staffPayMode: 'monthly', monthlySalaryInr },
    };
  }

  let shiftPayRateInr: number | undefined;
  if (shiftPayRateRaw.trim() !== '') {
    const rate = Number(shiftPayRateRaw);
    if (!Number.isFinite(rate) || rate < 0) {
      return { ok: false, error: 'Pay per shift must be a non-negative number.' };
    }
    shiftPayRateInr = rate;
  }
  return {
    ok: true,
    value: { staffPayMode: 'per_shift', shiftPayRateInr },
  };
}
