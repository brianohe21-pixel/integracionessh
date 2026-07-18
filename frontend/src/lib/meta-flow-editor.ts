export type VisualFieldType = "text" | "email" | "phone" | "number" | "radio";

export interface VisualRadioOption {
  id: string;
  title: string;
}

export interface VisualField {
  id: string;
  name: string;
  label: string;
  type: VisualFieldType;
  required: boolean;
  options?: VisualRadioOption[];
}

export interface VisualMetaFlow {
  screenTitle: string;
  submitLabel: string;
  fields: VisualField[];
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function findFormContainer(screen: JsonRecord): {
  form: JsonRecord;
  children: JsonRecord[];
} | null {
  const layout = asRecord(screen.layout);
  if (!layout) return null;

  const layoutChildren = layout.children;
  if (!Array.isArray(layoutChildren)) return null;

  for (const child of layoutChildren) {
    const record = asRecord(child);
    if (record?.type === "Form" && Array.isArray(record.children)) {
      return {
        form: record,
        children: record.children.map((item) => asRecord(item)).filter(Boolean) as JsonRecord[],
      };
    }
  }

  return null;
}

function parseField(component: JsonRecord, index: number): VisualField | null {
  if (component.type === "Footer") return null;

  if (component.type === "TextInput") {
    const inputType = String(component["input-type"] ?? component.input_type ?? "text").toLowerCase();
    const type: VisualFieldType =
      inputType === "email" || inputType === "phone" || inputType === "number" ? inputType : "text";
    const name = typeof component.name === "string" ? component.name : `field_${index + 1}`;
    return {
      id: `${name}-${index}`,
      name,
      label: typeof component.label === "string" ? component.label : name,
      type,
      required: component.required === true,
    };
  }

  if (component.type === "RadioButtonsGroup") {
    const name = typeof component.name === "string" ? component.name : `option_${index + 1}`;
    const dataSource = Array.isArray(component["data-source"])
      ? component["data-source"]
          .map((item) => asRecord(item))
          .filter((item): item is JsonRecord => item !== null)
          .map((item) => ({
            id: String(item.id ?? ""),
            title: String(item.title ?? ""),
          }))
          .filter((item) => item.id && item.title)
      : [];
    return {
      id: `${name}-${index}`,
      name,
      label: typeof component.label === "string" ? component.label : name,
      type: "radio",
      required: component.required === true,
      options: dataSource,
    };
  }

  return null;
}

export function parseMetaFlowJsonToVisual(json: unknown): VisualMetaFlow | null {
  const root = asRecord(json);
  const screens = root?.screens;
  if (!Array.isArray(screens) || screens.length === 0) return null;

  const screen = asRecord(screens[0]);
  if (!screen) return null;

  const formContainer = findFormContainer(screen);
  if (!formContainer) return null;

  const fields: VisualField[] = [];
  let submitLabel = "Submit";

  for (const [index, child] of formContainer.children.entries()) {
    if (child.type === "Footer") {
      submitLabel = typeof child.label === "string" ? child.label : submitLabel;
      continue;
    }
    const field = parseField(child, index);
    if (field) fields.push(field);
  }

  if (fields.length === 0) return null;

  return {
    screenTitle: typeof screen.title === "string" ? screen.title : "Form",
    submitLabel,
    fields,
  };
}

function fieldToComponent(field: VisualField): JsonRecord {
  if (field.type === "radio") {
    return {
      type: "RadioButtonsGroup",
      name: field.name,
      label: field.label,
      required: field.required,
      "data-source": (field.options ?? []).map((option) => ({
        id: option.id,
        title: option.title,
      })),
    };
  }

  return {
    type: "TextInput",
    name: field.name,
    label: field.label,
    required: field.required,
    ...(field.type !== "text" ? { "input-type": field.type } : {}),
  };
}

function buildCompletePayload(fields: VisualField[]): JsonRecord {
  const payload: JsonRecord = {};
  for (const field of fields) {
    payload[field.name] = `\${form.${field.name}}`;
  }
  return payload;
}

export function applyVisualToMetaFlowJson(
  json: Record<string, unknown>,
  visual: VisualMetaFlow
): Record<string, unknown> {
  const screens = Array.isArray(json.screens) ? [...json.screens] : [];
  const screen = asRecord(screens[0]) ?? {
    id: "SCREEN_1",
    terminal: true,
    success: true,
    data: {},
    layout: { type: "SingleColumnLayout", children: [] },
  };

  const layout = asRecord(screen.layout) ?? { type: "SingleColumnLayout", children: [] };
  const layoutChildren = Array.isArray(layout.children) ? [...layout.children] : [];

  let formIndex = layoutChildren.findIndex((child) => asRecord(child)?.type === "Form");
  let form = formIndex >= 0 ? asRecord(layoutChildren[formIndex]) : null;

  if (!form) {
    form = { type: "Form", name: "flow_form", children: [] };
    layoutChildren.unshift(form);
    formIndex = 0;
  }

  const formChildren = [
    ...visual.fields.map(fieldToComponent),
    {
      type: "Footer",
      label: visual.submitLabel,
      "on-click-action": {
        name: "complete",
        payload: buildCompletePayload(visual.fields),
      },
    },
  ];

  layoutChildren[formIndex] = { ...form, children: formChildren };

  screens[0] = {
    ...screen,
    title: visual.screenTitle,
    terminal: screen.terminal ?? true,
    success: screen.success ?? true,
    data: screen.data ?? {},
    layout: {
      ...layout,
      children: layoutChildren,
    },
  };

  return {
    ...json,
    version: typeof json.version === "string" ? json.version : "7.3",
    screens,
  };
}

export function createEmptyVisualFlow(): VisualMetaFlow {
  return {
    screenTitle: "Form",
    submitLabel: "Submit",
    fields: [
      {
        id: "name-0",
        name: "name",
        label: "Name",
        type: "text",
        required: true,
      },
    ],
  };
}
