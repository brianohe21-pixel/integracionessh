"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BookOpen, ExternalLink } from "lucide-react";
import { useT } from "@/i18n/context";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import {
  AUTH_OTP_CODE_EXPIRATION_MAX,
  AUTH_OTP_CODE_EXPIRATION_MIN,
  BUTTON_TEXT_MAX_LENGTH,
  type AuthOtpTemplateFormValues,
} from "./types";

interface AuthOtpTemplateFormFieldsProps {
  values: AuthOtpTemplateFormValues;
  onChange: (values: AuthOtpTemplateFormValues) => void;
}

function ToggleCard({
  active,
  title,
  hint,
  onToggle,
  children,
}: {
  active: boolean;
  title: string;
  hint: string;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-all",
        active
          ? "border-accent bg-accent-muted/25 ring-1 ring-accent"
          : "border-default bg-surface-elevated"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
      >
        <div>
          <p className="text-sm font-medium text-primary">{title}</p>
          <p className="mt-1 text-xs text-muted">{hint}</p>
        </div>
        <span
          className={cn(
            "mt-0.5 h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
            active ? "bg-accent" : "bg-surface-muted"
          )}
        >
          <span
            className={cn(
              "block h-4 w-4 rounded-full bg-white shadow transition-transform",
              active ? "translate-x-4" : "translate-x-0"
            )}
          />
        </span>
      </button>
      {active && children ? (
        <div className="border-t border-default/70 px-4 pb-4 pt-3">{children}</div>
      ) : null}
    </div>
  );
}

export function AuthOtpTemplateFormFields({
  values,
  onChange,
}: AuthOtpTemplateFormFieldsProps) {
  const t = useT();
  const buttonLength = values.copyCodeButtonText.length;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div className="min-w-0">
            <p className="text-sm text-blue-800">{t("templates.authOtpVerifyDocsHint")}</p>
            <Link
              href="/docs/api#verify-otp"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 underline-offset-2 hover:underline"
            >
              {t("templates.authOtpVerifyDocsLink")}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <ToggleCard
        active={values.addSecurityRecommendation}
        title={t("templates.authOtpSecurityLabel")}
        hint={t("templates.authOtpSecurityHint")}
        onToggle={() =>
          onChange({
            ...values,
            addSecurityRecommendation: !values.addSecurityRecommendation,
          })
        }
      />

      <ToggleCard
        active={values.includeCodeExpiration}
        title={t("templates.authOtpExpirationLabel")}
        hint={t("templates.authOtpExpirationHint")}
        onToggle={() =>
          onChange({
            ...values,
            includeCodeExpiration: !values.includeCodeExpiration,
          })
        }
      >
        <label className="mb-1 block text-sm font-medium text-secondary">
          {t("templates.authOtpExpirationMinutes")}
        </label>
        <Input
          type="number"
          min={AUTH_OTP_CODE_EXPIRATION_MIN}
          max={AUTH_OTP_CODE_EXPIRATION_MAX}
          value={values.codeExpirationMinutes}
          onChange={(e) =>
            onChange({
              ...values,
              codeExpirationMinutes: Number(e.target.value) || AUTH_OTP_CODE_EXPIRATION_MIN,
            })
          }
        />
        <p className="mt-1 text-xs text-muted">
          {t("templates.authOtpExpirationRange", {
            min: AUTH_OTP_CODE_EXPIRATION_MIN,
            max: AUTH_OTP_CODE_EXPIRATION_MAX,
          })}
        </p>
      </ToggleCard>

      <div className="rounded-xl border border-default bg-surface-elevated p-4">
        <div className="mb-1 flex items-center justify-between gap-3">
          <label className="block text-sm font-medium text-secondary">
            {t("templates.authOtpButtonText")}{" "}
            <span className="font-normal text-muted">{t("templates.optional")}</span>
          </label>
          <span className="text-xs text-muted">
            {buttonLength}/{BUTTON_TEXT_MAX_LENGTH}
          </span>
        </div>
        <Input
          type="text"
          value={values.copyCodeButtonText}
          maxLength={BUTTON_TEXT_MAX_LENGTH}
          onChange={(e) => onChange({ ...values, copyCodeButtonText: e.target.value })}
          placeholder={t("templates.authOtpButtonPlaceholder")}
        />
        <p className="mt-1 text-xs text-muted">
          {t("templates.authOtpButtonHint", { max: BUTTON_TEXT_MAX_LENGTH })}
        </p>
      </div>
    </div>
  );
}
