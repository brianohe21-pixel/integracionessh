"use client";

import type { FormEvent } from "react";
import type { HostedFormField } from "@/types";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Values = Record<string, string | boolean | string[]>;

interface FormRendererProps {
  name: string;
  description?: string;
  fields: HostedFormField[];
  submitLabel: string;
  values: Values;
  onChange: (name: string, value: string | boolean | string[]) => void;
  onSubmit: (event: FormEvent) => void;
  submitting?: boolean;
  disabled?: boolean;
  accent?: string;
  error?: string;
}

export function FormRenderer({
  name,
  description,
  fields,
  submitLabel,
  values,
  onChange,
  onSubmit,
  submitting,
  disabled,
  accent,
  error,
}: FormRendererProps) {
  const visible = fields.filter((field) => field.type !== "hidden");

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-primary">{name}</h2>
        {description ? <p className="mt-1 text-sm text-secondary">{description}</p> : null}
      </div>
      {visible.map((field) => (
        <div key={field.id}>
          {field.type !== "checkbox" || field.options?.length ? (
            <label className="mb-1 block text-sm font-medium text-primary">
              {field.label}
              {field.required ? <span className="text-danger"> *</span> : null}
            </label>
          ) : null}
          <FieldControl
            field={field}
            value={values[field.name]}
            disabled={disabled || submitting}
            onChange={onChange}
          />
          {field.helperText ? (
            <p className="mt-1 text-xs text-secondary">{field.helperText}</p>
          ) : null}
        </div>
      ))}
      {fields
        .filter((field) => field.type === "hidden")
        .map((field) => (
          <input key={field.id} type="hidden" name={field.name} value={String(values[field.name] ?? field.defaultValue ?? "")} />
        ))}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button
        type="submit"
        disabled={disabled || submitting}
        className="w-full"
        style={accent ? { backgroundColor: accent } : undefined}
      >
        {submitLabel}
      </Button>
    </form>
  );
}

function FieldControl({
  field,
  value,
  disabled,
  onChange,
}: {
  field: HostedFormField;
  value: string | boolean | string[] | undefined;
  disabled?: boolean;
  onChange: (name: string, value: string | boolean | string[]) => void;
}) {
  if (field.type === "textarea") {
    return (
      <Textarea
        required={field.required}
        disabled={disabled}
        placeholder={field.placeholder}
        rows={4}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(field.name, e.target.value)}
      />
    );
  }

  if (field.type === "select") {
    return (
      <Select
        required={field.required}
        disabled={disabled}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(field.name, e.target.value)}
      >
        <option value="">{field.placeholder || ""}</option>
        {(field.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    );
  }

  if (field.type === "radio") {
    return (
      <div className="space-y-2">
        {(field.options ?? []).map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm text-primary">
            <input
              type="radio"
              name={field.name}
              required={field.required}
              disabled={disabled}
              checked={value === option.value}
              onChange={() => onChange(field.name, option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "checkbox" && field.options?.length) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        {field.options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm text-primary">
            <input
              type="checkbox"
              disabled={disabled}
              checked={selected.includes(option.value)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...selected, option.value]
                  : selected.filter((item) => item !== option.value);
                onChange(field.name, next);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm text-primary">
        <input
          type="checkbox"
          disabled={disabled}
          checked={value === true}
          onChange={(e) => onChange(field.name, e.target.checked)}
        />
        {field.label}
        {field.required ? <span className="text-danger"> *</span> : null}
      </label>
    );
  }

  const inputType =
    field.type === "email"
      ? "email"
      : field.type === "phone"
        ? "tel"
        : field.type === "number"
          ? "number"
          : field.type === "date"
            ? "date"
            : "text";

  return (
    <Input
      type={inputType}
      required={field.required}
      disabled={disabled}
      placeholder={field.placeholder}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(field.name, e.target.value)}
      className={cn(disabled && "opacity-70")}
    />
  );
}
