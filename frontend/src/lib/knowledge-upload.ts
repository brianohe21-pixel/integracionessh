export const KNOWLEDGE_ACCEPT =
  ".txt,.md,.csv,.pdf,.docx,.xls,.xlsx,text/plain,text/markdown,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const EXTENSION_MIME: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function inferKnowledgeMimeType(filename: string, mimeType: string): string {
  const index = filename.lastIndexOf(".");
  const extension = index >= 0 ? filename.slice(index).toLowerCase() : "";
  if (extension && EXTENSION_MIME[extension]) {
    return EXTENSION_MIME[extension];
  }
  if (mimeType && mimeType !== "application/octet-stream") {
    return mimeType;
  }
  return "text/plain";
}
