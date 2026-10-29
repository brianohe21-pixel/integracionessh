import { buildCsv, downloadCsvFile } from "@/lib/csv";
import type { MarketingConsent } from "@/types";

const IMPORT_HEADERS = ["phone", "name", "country", "company", "marketingConsent"];

const HEADER_FIELD: Record<string, "phone" | "name" | "country" | "company" | "marketingConsent" | "email"> = {
  phone: "phone",
  telefono: "phone",
  numero: "phone",
  celular: "phone",
  whatsapp: "phone",
  mobile: "phone",
  movil: "phone",
  name: "name",
  nombre: "name",
  displayname: "name",
  country: "country",
  pais: "country",
  company: "company",
  empresa: "company",
  organizacion: "company",
  marketingconsent: "marketingConsent",
  consentimiento: "marketingConsent",
  consent: "marketingConsent",
  email: "email",
  correo: "email",
  correoelectronico: "email",
};

const CONSENT_VALUES = new Set<MarketingConsent>(["unknown", "opt_in", "opt_out"]);

export type ContactsImportPayloadRow = {
  row: number;
  phone: string;
  name?: string;
  email?: string;
  country?: string;
  company?: string;
  marketingConsent?: MarketingConsent;
};

export type ContactsImportRejection = {
  row: number;
  phone: string;
  reason: "missing_phone" | "invalid_phone" | "invalid_consent" | "invalid_email";
};

export type ParsedContactsImport = {
  rows: ContactsImportPayloadRow[];
  rejected: ContactsImportRejection[];
  total: number;
};

export function downloadContactsImportTemplate(): void {
  const rows = [
    ["573001234567", "Juan Perez", "Colombia", "Acme SA", "opt_in"],
    ["573009876543", "Maria Lopez", "Colombia", "", "opt_in"],
  ];
  downloadCsvFile("plantilla_contactos.csv", buildCsv(IMPORT_HEADERS, rows));
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function countDelimiter(line: string, delimiter: "," | ";"): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char === delimiter) count++;
  }
  return count;
}

function splitCsvLine(line: string, delimiter: "," | ";"): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function clip(value: string, max: number): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function parseConsent(value: string): MarketingConsent | "invalid" | undefined {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) return undefined;
  if (normalized === "optin") return "opt_in";
  if (normalized === "optout") return "opt_out";
  if (CONSENT_VALUES.has(normalized as MarketingConsent)) return normalized as MarketingConsent;
  return "invalid";
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function parseContactsImportCsv(text: string): ParsedContactsImport {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const occupied = lines
    .map((line, index) => ({ line: line.trim(), row: index + 1 }))
    .filter((entry) => entry.line.length > 0);

  if (occupied.length === 0) {
    return { rows: [], rejected: [], total: 0 };
  }

  const delimiter: "," | ";" =
    countDelimiter(occupied[0].line, ";") > countDelimiter(occupied[0].line, ",") ? ";" : ",";
  const table = occupied.map((entry) => ({
    row: entry.row,
    cells: splitCsvLine(entry.line, delimiter),
  }));

  const headerCells = table[0].cells;
  const hasHeader = headerCells.some((cell) => HEADER_FIELD[normalizeHeader(cell)] === "phone");
  const data = hasHeader ? table.slice(1) : table;

  const indexOf = (field: "phone" | "name" | "country" | "company" | "marketingConsent" | "email") => {
    if (!hasHeader) {
      const positional: Record<string, number> = {
        phone: 0,
        name: 1,
        country: 2,
        company: 3,
        marketingConsent: 4,
      };
      return positional[field] ?? -1;
    }
    return headerCells.findIndex((cell) => HEADER_FIELD[normalizeHeader(cell)] === field);
  };

  const phoneIndex = indexOf("phone");
  const nameIndex = indexOf("name");
  const countryIndex = indexOf("country");
  const companyIndex = indexOf("company");
  const consentIndex = indexOf("marketingConsent");
  const emailIndex = indexOf("email");

  const rows: ContactsImportPayloadRow[] = [];
  const rejected: ContactsImportRejection[] = [];

  for (const entry of data) {
    if (entry.cells.every((cell) => cell.trim() === "")) continue;

    const rawPhone = (entry.cells[phoneIndex] ?? "").trim();
    if (!rawPhone) {
      rejected.push({ row: entry.row, phone: "", reason: "missing_phone" });
      continue;
    }

    const digits = rawPhone.replace(/\D/g, "");
    if (digits.length < 10 || /e[+-]\d+/i.test(rawPhone)) {
      rejected.push({ row: entry.row, phone: rawPhone, reason: "invalid_phone" });
      continue;
    }

    const consentRaw = consentIndex >= 0 ? (entry.cells[consentIndex] ?? "") : "";
    const consent = parseConsent(consentRaw);
    if (consent === "invalid") {
      rejected.push({ row: entry.row, phone: rawPhone, reason: "invalid_consent" });
      continue;
    }

    const email = emailIndex >= 0 ? clip(entry.cells[emailIndex] ?? "", 256) : undefined;
    if (email && !isEmail(email)) {
      rejected.push({ row: entry.row, phone: rawPhone, reason: "invalid_email" });
      continue;
    }

    rows.push({
      row: entry.row,
      phone: digits,
      ...(nameIndex >= 0 ? { name: clip(entry.cells[nameIndex] ?? "", 128) } : {}),
      ...(email ? { email } : {}),
      ...(countryIndex >= 0 ? { country: clip(entry.cells[countryIndex] ?? "", 100) } : {}),
      ...(companyIndex >= 0 ? { company: clip(entry.cells[companyIndex] ?? "", 200) } : {}),
      ...(consent ? { marketingConsent: consent } : {}),
    });
  }

  return { rows, rejected, total: rows.length + rejected.length };
}
