const DEFAULT_COUNTRY_CODE = "57";

export function stripPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^0+/, "");
}

export function normalizePhoneWithCountryCode(
  phone: string,
  countryCode: string = DEFAULT_COUNTRY_CODE
): string {
  const digits = stripPhoneDigits(phone);
  if (!digits) return digits;

  if (digits.startsWith(countryCode)) {
    return digits;
  }

  if (digits.length <= 10) {
    return `${countryCode}${digits}`;
  }

  return digits;
}
