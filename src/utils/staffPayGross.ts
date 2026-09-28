import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  getDaysInMonth,
  startOfMonth,
} from 'date-fns';

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Pro-rate monthly salary across each calendar month overlapping [from, to] (inclusive local days).
 */
export function proratedMonthlySalaryInRange(monthlyInr: number, from: Date, to: Date): number {
  if (!Number.isFinite(monthlyInr) || monthlyInr < 0) {
    return 0;
  }
  const rangeStart = startOfLocalDay(from);
  const rangeEnd = startOfLocalDay(to);
  if (rangeEnd.getTime() < rangeStart.getTime()) {
    return 0;
  }

  let total = 0;
  let month = startOfMonth(rangeStart);
  const endMonth = startOfMonth(rangeEnd);

  while (month.getTime() <= endMonth.getTime()) {
    const monthStart = startOfMonth(month);
    const monthEndDay = endOfMonth(month);
    const overlapStart = rangeStart.getTime() > monthStart.getTime() ? rangeStart : monthStart;
    const overlapEnd = rangeEnd.getTime() < monthEndDay.getTime() ? rangeEnd : monthEndDay;
    if (overlapStart.getTime() <= overlapEnd.getTime()) {
      const overlapDays = differenceInCalendarDays(overlapEnd, overlapStart) + 1;
      const daysInMonth = getDaysInMonth(month);
      total += monthlyInr * (overlapDays / daysInMonth);
    }
    month = addMonths(month, 1);
  }

  return total;
}
