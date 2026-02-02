// Utility functions for formatting MAC addresses and other data

/**
 * Format a MAC address with colons every 2 characters (XX:XX:XX:XX:XX:XX)
 */
export const formatMacAddress = (value: string): string => {
  // Remove everything except hexadecimal characters
  const hex = value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
  // Limit to 12 characters
  const limited = hex.slice(0, 12);
  // Insert : every 2 characters
  const parts = limited.match(/.{1,2}/g) || [];
  return parts.join(':');
};

/**
 * Remove colons from MAC address
 */
export const unformatMacAddress = (value: string): string => {
  return value.replace(/:/g, '');
};

/**
 * Validate if a MAC address has exactly 12 hex digits
 */
export const isValidMacAddress = (value: string): boolean => {
  const unformatted = unformatMacAddress(value);
  return /^[0-9A-Fa-f]{12}$/.test(unformatted);
};

/**
 * Check if MAC address is complete (12 hex digits)
 */
export const isMacAddressComplete = (value: string): boolean => {
  if (!value) return true; // Empty is valid for optional fields
  const unformatted = unformatMacAddress(value);
  return unformatted.length === 12;
};

/**
 * Validate IPv4 address format (XXX.XXX.XXX.XXX with each octet 0-255)
 */
export const isValidIPAddress = (ip: string): boolean => {
  if (!ip) return true; // Empty is valid for optional fields
  const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!pattern.test(ip)) return false;
  return ip.split('.').every(n => parseInt(n) <= 255);
};
