// Utility functions for phone number formatting and country handling

export type PhoneCountry = 'MX' | 'US';

export interface PhoneCountryOption {
  value: PhoneCountry;
  label: string;
  flag: string;
  code: string;
}

export const PHONE_COUNTRIES: PhoneCountryOption[] = [
  { value: 'MX', label: 'México', flag: '🇲🇽', code: '+52' },
  { value: 'US', label: 'EE.UU.', flag: '🇺🇸', code: '+1' },
];

export const getCountryInfo = (country: PhoneCountry | string | null | undefined): PhoneCountryOption => {
  return PHONE_COUNTRIES.find(c => c.value === country) || PHONE_COUNTRIES[0];
};

/**
 * Formats a phone number as XXX-XXX-XXXX
 * Only keeps digits and formats them with dashes
 */
export const formatPhoneNumber = (value: string): string => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Limit to 10 digits
  const limited = digits.slice(0, 10);
  
  // Format as XXX-XXX-XXXX
  if (limited.length <= 3) {
    return limited;
  } else if (limited.length <= 6) {
    return `${limited.slice(0, 3)}-${limited.slice(3)}`;
  } else {
    return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`;
  }
};

/**
 * Removes formatting from phone number (returns only digits)
 */
export const unformatPhoneNumber = (value: string): string => {
  return value.replace(/\D/g, '');
};

/**
 * Formats phone for display with country code
 */
export const formatPhoneWithCountry = (phone: string | null | undefined, country: PhoneCountry | string | null | undefined): string => {
  if (!phone) return '';
  const countryInfo = getCountryInfo(country);
  const formattedPhone = formatPhoneNumber(phone);
  return `${countryInfo.flag} ${countryInfo.code} ${formattedPhone}`;
};

/**
 * Gets display format for phone in tables (shorter version)
 */
export const formatPhoneDisplay = (phone: string | null | undefined, country?: PhoneCountry | string | null): string => {
  if (!phone) return '-';
  const countryInfo = getCountryInfo(country);
  const formattedPhone = formatPhoneNumber(phone);
  return `${countryInfo.flag} ${formattedPhone}`;
};

/**
 * Check if phone number is complete (10 digits)
 */
export const isPhoneComplete = (phone: string): boolean => {
  if (!phone) return true; // Empty is valid for optional fields
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10;
};

/**
 * Translates status to Spanish
 */
export const translateStatus = (status: string): string => {
  const translations: Record<string, string> = {
    'pending': 'PENDIENTE',
    'finalized': 'FINALIZADO',
    'cancelled': 'CANCELADO',
    'active': 'ACTIVO',
  };
  return translations[status] || status.toUpperCase();
};
