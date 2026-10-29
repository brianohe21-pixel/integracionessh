import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseContactsImportCsv } from "./contacts-import-csv";

describe("parseContactsImportCsv", () => {
  it("parses the template and reports invalid rows with line numbers", () => {
    const csv = [
      "phone,name,country,company,marketingConsent",
      "573001234567,Juan Perez,Colombia,Acme SA,opt_in",
      "12,Corto,Colombia,Acme,opt_in",
      ",Sin telefono,Colombia,Acme,opt_in",
      "573009876543,Maria,Colombia,Acme,maybe",
    ].join("\n");

    const parsed = parseContactsImportCsv(csv);

    assert.equal(parsed.total, 4);
    assert.deepEqual(parsed.rows, [
      {
        row: 2,
        phone: "573001234567",
        name: "Juan Perez",
        country: "Colombia",
        company: "Acme SA",
        marketingConsent: "opt_in",
      },
    ]);
    assert.deepEqual(parsed.rejected, [
      { row: 3, phone: "12", reason: "invalid_phone" },
      { row: 4, phone: "", reason: "missing_phone" },
      { row: 5, phone: "573009876543", reason: "invalid_consent" },
    ]);
  });

  it("accepts semicolon files and quoted commas", () => {
    const csv = 'telefono;nombre\n573001112233;"Perez, Juan"';
    const parsed = parseContactsImportCsv(csv);
    assert.deepEqual(parsed.rejected, []);
    assert.equal(parsed.rows[0]?.phone, "573001112233");
    assert.equal(parsed.rows[0]?.name, "Perez, Juan");
    assert.equal(parsed.rows[0]?.row, 2);
  });

  it("treats a header-only file as empty", () => {
    assert.equal(parseContactsImportCsv("phone,name\n").total, 0);
  });
});
