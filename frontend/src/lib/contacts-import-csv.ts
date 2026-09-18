import { buildCsv, downloadCsvFile } from "@/lib/csv";

const IMPORT_HEADERS = ["phone", "name", "country", "company", "marketingConsent"];

export function downloadContactsImportTemplate(): void {
  const rows = [
    ["573001234567", "Juan Perez", "Colombia", "Acme SA", "opt_in"],
    ["573009876543", "Maria Lopez", "Colombia", "", "opt_in"],
  ];
  downloadCsvFile("plantilla_contactos.csv", buildCsv(IMPORT_HEADERS, rows));
}
