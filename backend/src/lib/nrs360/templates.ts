export interface MappedNrs360Template {
  templateId: string;
  name: string;
  subject: string;
  html: string;
  createdAt: string;
  updatedAt: string;
  type?: string;
  previewText?: string;
}

export function mapNrs360Template(raw: Record<string, unknown>): MappedNrs360Template | null {
  const id = Number(raw.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return null;
  const html = typeof raw.html === "string" ? raw.html : "";
  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : "";
  const updatedAt =
    typeof raw.updatedAt === "string" && raw.updatedAt ? raw.updatedAt : createdAt;
  const type = typeof raw.type === "string" ? raw.type : undefined;
  return {
    templateId: String(id),
    name,
    subject: name,
    html,
    createdAt,
    updatedAt,
    ...(type ? { type } : {}),
  };
}

export function mapNrs360Templates(items: Record<string, unknown>[]): MappedNrs360Template[] {
  return items
    .map((item) => mapNrs360Template(item))
    .filter((item): item is MappedNrs360Template => item !== null)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}
