import {
  getKnowledgeFileExtension,
  isAllowedKnowledgeFilename,
  resolveKnowledgeMimeType,
} from "./extract-text.js";

describe("knowledge extract-text helpers", () => {
  it("accepts common office and text formats", () => {
    expect(isAllowedKnowledgeFilename("manual.txt")).toBe(true);
    expect(isAllowedKnowledgeFilename("faq.md")).toBe(true);
    expect(isAllowedKnowledgeFilename("prices.csv")).toBe(true);
    expect(isAllowedKnowledgeFilename("policy.pdf")).toBe(true);
    expect(isAllowedKnowledgeFilename("guide.docx")).toBe(true);
    expect(isAllowedKnowledgeFilename("inventory.xlsx")).toBe(true);
    expect(isAllowedKnowledgeFilename("legacy.xls")).toBe(true);
    expect(isAllowedKnowledgeFilename("image.png")).toBe(false);
    expect(isAllowedKnowledgeFilename("legacy.doc")).toBe(false);
  });

  it("resolves mime types from filename", () => {
    expect(getKnowledgeFileExtension("Guide.DOCX")).toBe(".docx");
    expect(resolveKnowledgeMimeType("sheet.xlsx", "application/octet-stream")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(resolveKnowledgeMimeType("notes.txt", "")).toBe("text/plain");
  });
});
