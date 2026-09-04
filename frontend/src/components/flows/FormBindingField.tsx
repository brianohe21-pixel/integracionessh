"use client";

interface FormBindingFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  sampleFields?: string[];
  placeholder?: string;
}

export function FormBindingField({
  label,
  value,
  onChange,
  sampleFields = [],
  placeholder,
}: FormBindingFieldProps) {
  return (
    <div>
      {label ? (
        <label className="block text-xs font-medium text-secondary mb-1">{label}</label>
      ) : null}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "{{form.field}}"}
        className="w-full text-sm border border-field-border rounded-lg p-2 bg-surface-elevated shadow-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
      />
      {sampleFields.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {sampleFields.map((field) => (
            <button
              key={field}
              type="button"
              onClick={() => onChange(`{{form.${field}}}`)}
              className="rounded-md border border-field-border px-2 py-0.5 text-[10px] text-secondary hover:border-accent/40 hover:text-primary"
            >
              {field}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function extractSampleFields(payload?: Record<string, unknown>): string[] {
  if (!payload) return [];
  const fields: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const nestedKey of Object.keys(value as Record<string, unknown>)) {
        fields.push(`${key}.${nestedKey}`);
      }
    } else {
      fields.push(key);
    }
  }
  return fields;
}
