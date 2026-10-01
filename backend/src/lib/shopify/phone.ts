const COUNTRY_CALLING_CODES: Record<string, string> = {
  CO: "57",
  MX: "52",
  AR: "54",
  CL: "56",
  PE: "51",
  EC: "593",
  PA: "507",
  CR: "506",
  GT: "502",
  DO: "1809",
  US: "1",
  CA: "1",
  BR: "55",
  ES: "34",
};

export function normalizeShopifyPhone(
  raw: string | undefined | null,
  countryCode?: string | null,
  defaultCountry = "CO"
): string | undefined {
  if (!raw?.trim()) return undefined;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return undefined;

  if (raw.trim().startsWith("+")) {
    return digits;
  }

  const country = (countryCode || defaultCountry).toUpperCase();
  const callingCode = COUNTRY_CALLING_CODES[country] ?? COUNTRY_CALLING_CODES[defaultCountry] ?? "57";

  if (digits.startsWith(callingCode)) {
    return digits;
  }

  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }

  return `${callingCode}${digits}`;
}

export function extractPhoneFromShopifyPayload(
  payload: Record<string, unknown>,
  defaultCountry: string
): { phone?: string; name?: string; country?: string } {
  const shipping =
    (payload.shipping_address as Record<string, unknown> | undefined) ??
    (payload.default_address as Record<string, unknown> | undefined);
  const billing = payload.billing_address as Record<string, unknown> | undefined;
  const customer = payload.customer as Record<string, unknown> | undefined;

  const candidates: Array<{ phone?: unknown; country?: unknown; name?: unknown }> = [
    shipping ?? {},
    billing ?? {},
    customer ?? {},
    { phone: payload.phone, country: payload.country_code ?? payload.country, name: payload.name },
  ];

  for (const candidate of candidates) {
    const country =
      typeof candidate.country === "string"
        ? candidate.country
        : typeof shipping?.country_code === "string"
          ? shipping.country_code
          : defaultCountry;
    const phone = normalizeShopifyPhone(
      typeof candidate.phone === "string" ? candidate.phone : undefined,
      country,
      defaultCountry
    );
    if (phone) {
      const firstName =
        typeof candidate.name === "string"
          ? candidate.name
          : [customer?.first_name, customer?.last_name].filter(Boolean).join(" ").trim() ||
            (typeof shipping?.name === "string" ? shipping.name : undefined);
      return {
        phone,
        ...(firstName ? { name: firstName } : {}),
        country,
      };
    }
  }

  return {};
}
