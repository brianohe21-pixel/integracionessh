import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";

export const KNOWLEDGE_ALLOWED_EXTENSIONS = [
  ".txt",
  ".md",
  ".csv",
  ".pdf",
  ".docx",
  ".xls",
  ".xlsx",
] as const;

const EXTENSION_MIME: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function getKnowledgeFileExtension(filename: string): string {
  const index = filename.lastIndexOf(".");
  if (index < 0) return "";
  return filename.slice(index).toLowerCase();
}

export function isAllowedKnowledgeFilename(filename: string): boolean {
  const extension = getKnowledgeFileExtension(filename);
  return KNOWLEDGE_ALLOWED_EXTENSIONS.includes(
    extension as (typeof KNOWLEDGE_ALLOWED_EXTENSIONS)[number]
  );
}

export function resolveKnowledgeMimeType(filename: string, mimeType: string): string {
  const extension = getKnowledgeFileExtension(filename);
  if (extension && EXTENSION_MIME[extension]) {
    return EXTENSION_MIME[extension];
  }
  if (mimeType && mimeType !== "application/octet-stream") {
    return mimeType;
  }
  return "text/plain";
}

function extractSpreadsheetText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) {
      parts.push(`## ${sheetName}\n${csv}`);
    }
  }

  return parts.join("\n\n");
}

export async function extractKnowledgeText(params: {
  buffer: Uint8Array;
  mimeType: string;
  filename: string;
}): Promise<string> {
  const mime = resolveKnowledgeMimeType(params.filename, params.mimeType);
  const buffer = Buffer.from(params.buffer);

  if (mime === "text/plain" || mime === "text/markdown" || mime === "text/csv") {
    return buffer.toString("utf-8");
  }

  if (mime === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text ?? "";
    } finally {
      await parser.destroy();
    }
  }

  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? "";
  }

  if (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel"
  ) {
    return extractSpreadsheetText(buffer);
  }

  return buffer.toString("utf-8");
}
