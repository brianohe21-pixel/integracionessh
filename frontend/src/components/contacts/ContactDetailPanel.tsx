"use client";

import Link from "next/link";
import { useState } from "react";
import { History, Mail, Megaphone, Phone, Tag, User } from "lucide-react";
import { SideDrawer } from "@/components/ui/SideDrawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { WhatsAppRiskBadge } from "@/components/whatsapp/WhatsAppRiskBadge";
import { useFormatters } from "@/hooks/useFormatters";
import { useUpdateContact } from "@/hooks/useContacts";
import { useT } from "@/i18n/context";
import { resolveWhatsAppRisk, type WhatsAppRiskResponse } from "@/hooks/useWhatsAppRisk";
import { detectCountryFromPhone } from "@/lib/phone/country-from-phone";
import type { Contact, MarketingConsent } from "@/types";

function consentVariant(c: MarketingConsent): "success" | "warning" | "danger" | "default" {
  if (c === "opt_in") return "success";
  if (c === "opt_out") return "danger";
  return "default";
}

function contactInitials(name?: string, phone?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return phone?.slice(-2) ?? "?";
}

export function ContactDetailPanel({
  contact,
  whatsappRisk,
  onClose,
  onDelete,
  onStartCampaign,
}: {
  contact: Contact;
  whatsappRisk?: WhatsAppRiskResponse;
  onClose: () => void;
  onDelete: () => void;
  onStartCampaign?: () => void;
}) {
  const t = useT();
  const { formatDate, formatRelativeTime } = useFormatters();
  const updateContact = useUpdateContact();

  const [displayName, setDisplayName] = useState(contact.displayName ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [country, setCountry] = useState(
    contact.country ?? detectCountryFromPhone(contact.phoneNumber) ?? ""
  );
  const [company, setCompany] = useState(contact.company ?? "");
  const [tags, setTags] = useState(contact.tags.join(", "));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const initials = contactInitials(contact.displayName, contact.phoneNumber);
  const title = contact.displayName?.trim() || contact.phoneNumber;

  async function saveProfile() {
    setError("");
    setSaved(false);
    try {
      await updateContact.mutateAsync({
        phone: contact.phoneNumber,
        displayName: displayName.trim() || undefined,
        email: email.trim() || undefined,
        country: country.trim() || undefined,
        company: company.trim() || undefined,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function setConsent(consent: MarketingConsent) {
    setError("");
    await updateContact.mutateAsync({
      phone: contact.phoneNumber,
      marketingConsent: consent,
      ...(consent === "opt_out" ? { suppressed: true } : {}),
    });
  }

  const sourceKey = `contacts.source_${contact.source}` as const;

  return (
    <SideDrawer
      title={title}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap gap-2">
          {onStartCampaign && (
            <Button type="button" size="sm" onClick={onStartCampaign}>
              <Megaphone className="h-4 w-4" />
              {t("contacts.startCampaign")}
            </Button>
          )}
          {contact.marketingConsent !== "opt_in" && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setConsent("opt_in")}
              disabled={updateContact.isPending}
            >
              {t("contacts.markOptIn")}
            </Button>
          )}
          {contact.marketingConsent !== "opt_out" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setConsent("opt_out")}
              disabled={updateContact.isPending}
              className="text-danger border-danger/30 hover:bg-danger/5"
            >
              {t("contacts.markOptOut")}
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={onDelete} className="text-danger">
            {t("common.delete")}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 p-5">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-muted text-lg font-semibold text-accent">
            {initials}
          </div>
          <p className="mt-3 font-mono text-sm text-secondary">{contact.phoneNumber}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <Badge variant={consentVariant(contact.marketingConsent)}>
              {t(`contacts.consent_${contact.marketingConsent}`)}
            </Badge>
            {contact.suppressed && <Badge variant="danger">{t("contacts.suppressed")}</Badge>}
            {contact.leadId && (
              <Badge variant="info">
                {contact.tags.includes("converted") ? t("contacts.tagConverted") : t("contacts.tagLead")}
              </Badge>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-default bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
              {t("contacts.sectionProfile")}
            </span>
            <WhatsAppRiskBadge
              risk={resolveWhatsAppRisk(whatsappRisk, contact.lastBotId)}
            />
          </div>

          <div>
            <FieldLabel label={t("contacts.colName")} tooltip={t("contacts.namePlaceholder")} />
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("contacts.namePlaceholder")}
            />
          </div>

          <div>
            <FieldLabel label={t("contacts.colEmail")} tooltip={t("common.email")} />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("common.email")}
            />
          </div>

          <div>
            <FieldLabel label={t("contacts.colCountry")} tooltip={t("contacts.countryPlaceholder")} />
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder={t("contacts.countryPlaceholder")}
            />
          </div>

          <div>
            <FieldLabel label={t("contacts.colCompany")} tooltip={t("contacts.companyPlaceholder")} />
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder={t("contacts.companyPlaceholder")}
            />
          </div>

          <div>
            <FieldLabel label={t("contacts.colTags")} tooltip={t("contacts.tagsPlaceholder")} />
            <Textarea
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              rows={2}
              placeholder={t("contacts.tagsPlaceholder")}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={saveProfile} disabled={updateContact.isPending}>
              {t("common.save")}
            </Button>
            {saved && <span className="text-xs text-success">{t("contacts.saved")}</span>}
          </div>
        </div>

        {contact.csatAverage !== undefined && contact.csatRatingCount !== undefined && (
          <div className="rounded-xl border border-default bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary mb-2">
              {t("contacts.colCsat")}
            </p>
            <p className="text-2xl font-bold text-primary">
              {contact.csatAverage}/5
              <span className="ml-2 text-sm font-normal text-secondary">
                ({contact.csatRatingCount} {t("contacts.ratings")})
              </span>
            </p>
          </div>
        )}

        <div className="rounded-xl border border-default bg-surface p-4 space-y-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
            {t("contacts.sectionActivity")}
          </p>
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <div>
              <p className="text-secondary">{t("common.phone")}</p>
              <p className="font-mono text-primary">{contact.phoneNumber}</p>
            </div>
          </div>
          {contact.email && (
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <div>
                <p className="text-secondary">{t("common.email")}</p>
                <p className="text-primary">{contact.email}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <div>
              <p className="text-secondary">{t("contacts.source")}</p>
              <p className="text-primary">{t(sourceKey)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <History className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <div>
              <p className="text-secondary">{t("contacts.firstSeen")}</p>
              <p className="text-primary">{formatDate(contact.firstSeenAt)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Tag className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <div>
              <p className="text-secondary">{t("contacts.lastSeen")}</p>
              <p className="text-primary">
                {formatRelativeTime(contact.lastSeenAt)}
                <span className="ml-1 text-secondary">({formatDate(contact.lastSeenAt)})</span>
              </p>
            </div>
          </div>
          {contact.consentAt && (
            <div>
              <p className="text-secondary">{t("contacts.consentRecorded")}</p>
              <p className="text-primary">{formatDate(contact.consentAt)}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {contact.lastBotId && (
            <Link
              href={`/conversations?botId=${contact.lastBotId}&phone=${encodeURIComponent(contact.phoneNumber)}`}
              className="text-sm font-medium text-accent hover:underline"
            >
              {t("leads.openConversation")}
            </Link>
          )}
          {contact.leadId && (
            <Link href={`/leads?q=${encodeURIComponent(contact.phoneNumber)}`} className="text-sm font-medium text-accent hover:underline">
              {t("contacts.viewLead")}
            </Link>
          )}
        </div>

        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}
      </div>
    </SideDrawer>
  );
}
