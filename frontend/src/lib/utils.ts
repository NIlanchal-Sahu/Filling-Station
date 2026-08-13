import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSalary(min?: number | null, max?: number | null, isHourly?: boolean) {
  if (isHourly) return 'Hourly rate';
  if (min && max) return `₹${min.toLocaleString()} - ₹${max.toLocaleString()}/mo`;
  if (min) return `₹${min.toLocaleString()}+/mo`;
  return 'Negotiable';
}

export function formatJobType(type: string) {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
