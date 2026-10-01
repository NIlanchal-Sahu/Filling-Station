/** Drop-in stand-in for the old Firestore Timestamp (`toDate` / `toMillis`). */
export class AppTimestamp {
  private readonly ms: number;

  private constructor(ms: number) {
    this.ms = ms;
  }

  static fromMillis(ms: number): AppTimestamp {
    return new AppTimestamp(ms);
  }

  static fromDate(date: Date): AppTimestamp {
    return new AppTimestamp(date.getTime());
  }

  static now(): AppTimestamp {
    return new AppTimestamp(Date.now());
  }

  toDate(): Date {
    return new Date(this.ms);
  }

  toMillis(): number {
    return this.ms;
  }
}

export function asTimestamp(value: unknown): AppTimestamp {
  if (value instanceof AppTimestamp) {
    return value;
  }
  if (value instanceof Date) {
    return AppTimestamp.fromDate(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return AppTimestamp.fromMillis(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const ms = Date.parse(value);
    if (!Number.isNaN(ms)) {
      return AppTimestamp.fromMillis(ms);
    }
  }
  if (value && typeof value === 'object' && 'toMillis' in value) {
    const toMillis = (value as { toMillis?: () => number }).toMillis;
    if (typeof toMillis === 'function') {
      return AppTimestamp.fromMillis(toMillis.call(value));
    }
  }
  return AppTimestamp.fromMillis(0);
}

export function asTimestampOrNull(value: unknown): AppTimestamp | null {
  if (value == null || value === '') {
    return null;
  }
  return asTimestamp(value);
}
