"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import { ArrowLeft, Edit3, FileText, Plus, Save, Trash2 } from "lucide-react";
import {
  useCreateMailrelayTemplate,
  useDeleteMailrelayTemplate,
  useMailrelayConfig,
  useMailrelayTemplates,
  useUpdateMailrelayTemplate,
} from "@/hooks/useMailrelay";
import { useT } from "@/i18n/context";
import type { MailrelayEmailTemplate } from "@/types";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { MailrelayHtmlEditor } from "./MailrelayHtmlEditor";

const emptyDraft = {
  name: "",
  subject: "",
  previewText: "",
  html: "",
};

function formatUpdatedAt(value: string, locale: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function stripPreview(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function MailrelayTemplatesTab({ connected }: { connected: boolean }) {
  const t = useT();
  const configQuery = useMailrelayConfig(connected);
  const isNrs360 = configQuery.data?.config.provider === "nrs360";
  const templatesQuery = useMailrelayTemplates(connected);
  const createTemplate = useCreateMailrelayTemplate();
  const updateTemplate = useUpdateMailrelayTemplate();
  const deleteTemplate = useDeleteMailrelayTemplate();
  const formRef = useRef<HTMLDivElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [baseline, setBaseline] = useState(emptyDraft);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState("");

  const sanitizedHtml = useMemo(
    () => DOMPurify.sanitize(draft.html, { USE_PROFILES: { html: true } }),
    [draft.html]
  );

  const isDirty = useMemo(
    () =>
      draft.name !== baseline.name ||
      draft.subject !== baseline.subject ||
      draft.previewText !== baseline.previewText ||
      draft.html !== baseline.html,
    [baseline, draft]
  );

  const canSave = Boolean(
    draft.name.trim() && draft.subject.trim() && draft.html.trim() && isDirty
  );

  useEffect(() => {
    if (!showForm) return;
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showForm, editingId]);

  if (!connected) {
    return (
      <EmptyState
        icon={<FileText className="h-6 w-6" />}
        title={t("mailrelay.states.connectionRequired")}
        description={t("mailrelay.states.connectionRequiredDescription")}
      />
    );
  }

  if (templatesQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (templatesQuery.isError) {
    return <Alert variant="danger">{templatesQuery.error.message}</Alert>;
  }

  const templates = templatesQuery.data?.templates ?? [];
  const filtered = templates.filter((template) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      template.name.toLowerCase().includes(query) ||
      template.subject.toLowerCase().includes(query)
    );
  });
  const saving = createTemplate.isPending || updateTemplate.isPending;
  const locale = typeof navigator !== "undefined" ? navigator.language : "es";

  function openCreate() {
    setDraft(emptyDraft);
    setBaseline(emptyDraft);
    setEditingId("");
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEdit(template: MailrelayEmailTemplate) {
    const next = {
      name: template.name,
      subject: template.subject,
      previewText: template.previewText ?? "",
      html: template.html,
    };
    setDraft(next);
    setBaseline(next);
    setEditingId(template.templateId);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId("");
    setDraft(emptyDraft);
    setBaseline(emptyDraft);
    setError("");
    setSuccess("");
  }

  async function handleSave() {
    if (!draft.name.trim() || !draft.subject.trim() || !draft.html.trim()) {
      setError(t("mailrelay.templates.required"));
      return;
    }
    const payload = {
      name: draft.name.trim(),
      subject: draft.subject.trim(),
      previewText: draft.previewText.trim(),
      html: draft.html,
    };
    try {
      setError("");
      if (editingId) {
        await updateTemplate.mutateAsync({ templateId: editingId, payload });
        setBaseline(payload);
        setSuccess(t("mailrelay.templates.updated"));
      } else {
        const result = await createTemplate.mutateAsync(payload);
        setEditingId(result.template.templateId);
        setBaseline(payload);
        setSuccess(t("mailrelay.templates.created"));
      }
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function handleDelete() {
    if (!confirmDeleteId) return;
    try {
      await deleteTemplate.mutateAsync(confirmDeleteId);
      if (editingId === confirmDeleteId) closeForm();
      setConfirmDeleteId("");
      setSuccess(t("mailrelay.templates.deleted"));
    } catch (cause) {
      setError((cause as Error).message);
      setConfirmDeleteId("");
    }
  }

  if (showForm) {
    return (
      <div ref={formRef} className="space-y-4">
        <div className="sticky top-0 z-10 -mx-1 border-b border-subtle bg-surface/95 px-1 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <button
                type="button"
                onClick={closeForm}
                className="mb-1 inline-flex items-center gap-1.5 text-sm text-secondary transition-colors hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("mailrelay.templates.backToList")}
              </button>
              <h2 className="truncate text-lg font-semibold text-primary">
                {editingId
                  ? t("mailrelay.templates.editTitle")
                  : t("mailrelay.templates.createTitle")}
              </h2>
              <p className="text-sm text-secondary">
                {isDirty
                  ? t("mailrelay.templates.unsavedChanges")
                  : t("mailrelay.templates.formDescription")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {editingId ? (
                <Button
                  variant="ghost"
                  onClick={() => setConfirmDeleteId(editingId)}
                  disabled={deleteTemplate.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("mailrelay.actions.delete")}
                </Button>
              ) : null}
              <Button variant="secondary" onClick={closeForm}>
                {t("mailrelay.actions.close")}
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving || !canSave}>
                <Save className="h-4 w-4" />
                {saving
                  ? t("mailrelay.actions.saving")
                  : editingId
                    ? t("mailrelay.templates.saveChanges")
                    : t("mailrelay.templates.createAction")}
              </Button>
            </div>
          </div>
        </div>

        {error ? <Alert variant="danger">{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        <Card padding="lg" className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-primary sm:col-span-2">
              <span>{t("mailrelay.templates.saveAs")}</span>
              <Input
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder={t("mailrelay.templates.namePlaceholder")}
                autoFocus
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-primary">
              <span>{t("mailrelay.campaigns.subject")}</span>
              <Input
                value={draft.subject}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, subject: event.target.value }))
                }
                placeholder={t("mailrelay.templates.subjectPlaceholder")}
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-primary">
              <span>{t("mailrelay.campaigns.previewText")}</span>
              <Input
                value={draft.previewText}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, previewText: event.target.value }))
                }
                placeholder={t("mailrelay.templates.previewPlaceholder")}
              />
            </label>
          </div>

          <div className="space-y-2 text-sm font-medium text-primary">
            <span>{t("mailrelay.campaigns.html")}</span>
            <MailrelayHtmlEditor
              value={draft.html}
              onChange={(html) => setDraft((current) => ({ ...current, html }))}
              placeholder={t("mailrelay.editor.htmlPlaceholder")}
            />
          </div>
        </Card>

        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-subtle bg-surface-muted px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {t("mailrelay.templates.inboxPreview")}
            </p>
          </div>
          <div className="space-y-3 border-b border-subtle px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-muted text-sm font-semibold text-accent">
                {(draft.name || t("mailrelay.templates.title")).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-primary">
                  {draft.subject.trim() || t("mailrelay.templates.subjectPlaceholder")}
                </p>
                <p className="truncate text-sm text-secondary">
                  {draft.name.trim() || t("mailrelay.templates.namePlaceholder")}
                </p>
                {draft.previewText.trim() ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{draft.previewText}</p>
                ) : null}
              </div>
            </div>
          </div>
          <div className="bg-[linear-gradient(180deg,var(--surface-muted),transparent_40%)] p-4">
            <div className="overflow-hidden rounded-xl border border-subtle bg-white shadow-sm">
              {sanitizedHtml.trim() ? (
                <div
                  className="rich-html-content emoji-text max-h-[28rem] overflow-auto p-5 text-sm text-gray-900"
                  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
              ) : (
                <div className="flex min-h-56 items-center justify-center px-6 text-center text-sm text-muted">
                  {t("mailrelay.templates.previewEmpty")}
                </div>
              )}
            </div>
          </div>
        </Card>

        <ConfirmDialog
          open={Boolean(confirmDeleteId)}
          title={t("mailrelay.templates.deleteTitle")}
          description={
            isNrs360
              ? t("mailrelay.templates.nrsDeleteDescription")
              : t("mailrelay.templates.deleteDescription")
          }
          confirmLabel={t("mailrelay.actions.delete")}
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmDeleteId("")}
          loading={deleteTemplate.isPending}
          tone="danger"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold text-primary">{t("mailrelay.templates.title")}</h2>
          <p className="mt-1 text-sm text-secondary">
            {isNrs360
              ? t("mailrelay.templates.nrsManageDescription")
              : t("mailrelay.templates.manageDescription")}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t("mailrelay.templates.new")}
        </Button>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      {templates.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title={t("mailrelay.templates.empty")}
            description={
              isNrs360
                ? t("mailrelay.templates.nrsEmptyManageDescription")
                : t("mailrelay.templates.emptyManageDescription")
            }
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                {t("mailrelay.templates.new")}
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            placeholder={t("mailrelay.templates.searchPlaceholder")}
            className="max-w-md"
          />

          {filtered.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={t("mailrelay.templates.searchEmpty")}
              description={t("mailrelay.templates.searchEmptyDescription")}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map((template) => {
                const snippet = stripPreview(template.html);
                return (
                  <div
                    key={template.templateId}
                    className="group rounded-2xl border border-default bg-surface-elevated p-4 transition-colors hover:border-accent/40 hover:bg-accent-muted/20"
                  >
                    <button
                      type="button"
                      onClick={() => openEdit(template)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-primary">{template.name}</p>
                          <p className="mt-1 truncate text-sm text-secondary">{template.subject}</p>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-surface-muted px-2 py-1 text-xs text-secondary opacity-80 group-hover:opacity-100">
                          <Edit3 className="h-3.5 w-3.5" />
                          {t("mailrelay.actions.edit")}
                        </span>
                      </div>
                      {snippet ? (
                        <p className="mt-3 line-clamp-2 text-sm text-muted">{snippet}</p>
                      ) : null}
                    </button>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <p className="text-xs text-muted">
                        {formatUpdatedAt(template.updatedAt || template.createdAt, locale)}
                      </p>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-danger"
                        onClick={() => setConfirmDeleteId(template.templateId)}
                        aria-label={t("mailrelay.actions.delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title={t("mailrelay.templates.deleteTitle")}
        description={
          isNrs360
            ? t("mailrelay.templates.nrsDeleteDescription")
            : t("mailrelay.templates.deleteDescription")
        }
        confirmLabel={t("mailrelay.actions.delete")}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDeleteId("")}
        loading={deleteTemplate.isPending}
        tone="danger"
      />
    </div>
  );
}
