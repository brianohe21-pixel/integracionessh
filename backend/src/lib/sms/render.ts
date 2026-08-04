export function extractBodyVariableKeys(text: string): string[] {
  const matches = text.match(/\{\{\d+\}\}/g);
  return matches ? [...new Set(matches)].sort(
    (a, b) => parseInt(a.replace(/\D/g, ""), 10) - parseInt(b.replace(/\D/g, ""), 10)
  ) : [];
}

export function renderTemplateBody(body: string, values: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, index: string) => {
    const position = parseInt(index, 10) - 1;
    const value = values[position];
    return value !== undefined && value !== "" ? value : `{{${index}}}`;
  });
}

export function parametersFromComponents(
  components?: Array<{
    type: string;
    parameters?: Array<{ type: string; text?: string }>;
  }>
): string[] {
  const body = components?.find((component) => component.type === "body");
  return body?.parameters?.map((parameter) => parameter.text ?? "") ?? [];
}
