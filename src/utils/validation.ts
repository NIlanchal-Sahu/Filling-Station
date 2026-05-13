const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requireNonEmpty(value: string, field: string): string | undefined {
  if (!value.trim()) {
    return `${field} is required.`;
  }
  return undefined;
}

export function requireEmail(value: string): string | undefined {
  if (!value.trim()) {
    return 'Email is required.';
  }
  if (!EMAIL_RE.test(value.trim())) {
    return 'Please enter a valid email address.';
  }
  return undefined;
}

export function requirePositiveNumber(value: string, field: string): string | undefined {
  const n = Number(value);
  if (value === '' || Number.isNaN(n)) {
    return `${field} must be a number.`;
  }
  if (n < 0) {
    return `${field} must be zero or positive.`;
  }
  return undefined;
}

export function requireMin(value: string, min: number, field: string): string | undefined {
  const n = Number(value);
  if (value === '' || Number.isNaN(n)) {
    return `${field} must be a number.`;
  }
  if (n < min) {
    return `${field} must be at least ${min}.`;
  }
  return undefined;
}
