import type { HostedFormField, HostedFormFieldType } from "@/types";

export const FORM_FIELD_TYPE_ORDER: HostedFormFieldType[] = [
  "text",
  "email",
  "phone",
  "textarea",
  "number",
  "select",
  "radio",
  "checkbox",
  "date",
  "hidden",
];

export function createHostedFormField(type: HostedFormFieldType): HostedFormField {
  const id = crypto.randomUUID();
  const base: HostedFormField = {
    id,
    type,
    name: `${type}_${id.slice(0, 8)}`,
    label: type.charAt(0).toUpperCase() + type.slice(1),
    required: type !== "hidden" && type !== "checkbox",
  };
  if (type === "select" || type === "radio") {
    return {
      ...base,
      options: [
        { value: "option_1", label: "Option 1" },
        { value: "option_2", label: "Option 2" },
      ],
    };
  }
  return base;
}

export function defaultEditorFields(): HostedFormField[] {
  return [
    { id: crypto.randomUUID(), type: "text", name: "name", label: "Name", required: true },
    { id: crypto.randomUUID(), type: "email", name: "email", label: "Email", required: true },
    { id: crypto.randomUUID(), type: "phone", name: "phone", label: "Phone", required: true },
    { id: crypto.randomUUID(), type: "textarea", name: "message", label: "Message", required: false },
  ];
}
