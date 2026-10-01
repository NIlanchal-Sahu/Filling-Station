export type StationAboutProfile = {
  displayName: string;
  tagline: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  alternatePhone: string;
  email: string;
  whatsapp: string;
  operatingHours: string;
  gstin: string;
  licenseNumber: string;
  website: string;
  notes: string;
};

export function defaultStationAbout(): StationAboutProfile {
  return {
    displayName: 'PumpStock',
    tagline: 'Filling station ops',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    alternatePhone: '',
    email: '',
    whatsapp: '',
    operatingHours: '',
    gstin: '',
    licenseNumber: '',
    website: '',
    notes: '',
  };
}

function trimField(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, maxLen);
}

export function mergeStationAbout(partial?: Partial<StationAboutProfile> | null): StationAboutProfile {
  const base = defaultStationAbout();
  if (!partial) {
    return base;
  }
  return {
    displayName: trimField(partial.displayName, 80) || base.displayName,
    tagline: trimField(partial.tagline, 120) || base.tagline,
    addressLine1: trimField(partial.addressLine1, 120),
    addressLine2: trimField(partial.addressLine2, 120),
    city: trimField(partial.city, 64),
    state: trimField(partial.state, 64),
    pincode: trimField(partial.pincode, 12),
    phone: trimField(partial.phone, 24),
    alternatePhone: trimField(partial.alternatePhone, 24),
    email: trimField(partial.email, 120),
    whatsapp: trimField(partial.whatsapp, 24),
    operatingHours: trimField(partial.operatingHours, 200),
    gstin: trimField(partial.gstin, 20),
    licenseNumber: trimField(partial.licenseNumber, 40),
    website: trimField(partial.website, 200),
    notes: trimField(partial.notes, 500),
  };
}

export function formatStationAddress(profile: StationAboutProfile): string {
  const parts = [
    profile.addressLine1,
    profile.addressLine2,
    [profile.city, profile.state].filter(Boolean).join(', '),
    profile.pincode,
  ].filter(Boolean);
  return parts.join('\n');
}
