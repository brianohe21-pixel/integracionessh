const DEFAULT_COUNTRY_CODE = "57";

const CALLING_CODE_COUNTRIES: Record<string, string> = {
  "599": "Antillas Neerlandesas",
  "598": "Uruguay",
  "597": "Surinam",
  "596": "Martinica",
  "595": "Paraguay",
  "594": "Guayana Francesa",
  "593": "Ecuador",
  "592": "Guyana",
  "591": "Bolivia",
  "590": "Guadalupe",
  "509": "Haití",
  "507": "Panamá",
  "506": "Costa Rica",
  "505": "Nicaragua",
  "504": "Honduras",
  "503": "El Salvador",
  "502": "Guatemala",
  "501": "Belice",
  "971": "Emiratos Árabes Unidos",
  "58": "Venezuela",
  "57": "Colombia",
  "56": "Chile",
  "55": "Brasil",
  "54": "Argentina",
  "53": "Cuba",
  "52": "México",
  "51": "Perú",
  "49": "Alemania",
  "44": "Reino Unido",
  "39": "Italia",
  "34": "España",
  "33": "Francia",
  "1": "Estados Unidos",
};

const SORTED_CALLING_CODES = Object.keys(CALLING_CODE_COUNTRIES).sort(
  (a, b) => b.length - a.length
);

function stripPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^0+/, "");
}

function matchCountryFromDigits(digits: string): string | undefined {
  for (const code of SORTED_CALLING_CODES) {
    if (digits.startsWith(code)) {
      return CALLING_CODE_COUNTRIES[code];
    }
  }
  return undefined;
}

export function detectCountryFromPhone(phone: string): string | undefined {
  const digits = stripPhoneDigits(phone);
  if (!digits || digits.length < 8) return undefined;

  const candidates =
    digits.length <= 10 ? [`${DEFAULT_COUNTRY_CODE}${digits}`, digits] : [digits];

  for (const candidate of candidates) {
    const country = matchCountryFromDigits(candidate);
    if (country) return country;
  }

  return undefined;
}
