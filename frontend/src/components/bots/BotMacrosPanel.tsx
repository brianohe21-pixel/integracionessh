"use client";

import { useState } from "react";
import { MessageSquarePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMacros, useCreateMacro, useUpdateMacro, useDeleteMacro } from "@/hooks/useMacros";
import { useT } from "@/i18n/context";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import type { Bot, Macro } from "@/types";

type DialogMode = "create" | "edit" | null;

type FormState = {
  title: string;
  content: string;
  shortcut: string;
};

const EMPTY_FORM: FormState = { title: "", content: "", shortcut: "" };

export function BotMacrosPanel({ bot }: { bot: Bot }) {
  const t = useT();
  const { data: macros, isLoading } = useMacros(bot.botId);
  const createMacro = useCreateMacro(bot.botId);
  const updateMacro = useUpdateMacro(bot.botId);
  const removeMacro = useDeleteMacro(bot.botId);

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingMacro, setEditingMacro] = useState<Macro | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Macro | null>(null);
  const [deleteError, setDeleteError] = useState("");

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError("");
    setEditingMacro(null);
    setDialogMode("create");
  }

  function openEdit(macro: Macro) {
    setForm({
      title: macro.title,
      content: macro.content,
      shortcut: macro.shortcut ?? "",
    });
    setFormError("");
    setEditingMacro(macro);
    setDialogMode("edit");
  }

  function closeDialog() {
    setDialogMode(null);
    setEditingMacro(null);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    const title = form.title.trim();
    const content = form.content.trim();
    const shortcut = form.shortcut.trim();

    if (!title || !content) {
      setFormError(t("macros.formRequired"));
      return;
    }

    try {
      if (dialogMode === "create") {
        await createMacro.mutateAsync({
          title,
          content,
          ...(shortcut ? { shortcut } : {}),
        });
      } else if (dialogMode === "edit" && editingMacro) {
        await updateMacro.mutateAsync({
          macroId: editingMacro.macroId,
          title,
          content,
          shortcut: shortcut || null,
        });
      }
      closeDialog();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("macros.saveError"));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError("");
    try {
      await removeMacro.mutateAsync(deleteTarget.macroId);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t("macros.deleteError"));
    }
  }

  const isSaving = createMacro.isPending || updateMacro.isPending;

  return (
    <div className="bg-surface-elevated rounded-xl border border-default p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-primary">{t("macros.title")}</h2>
          <p className="text-sm text-secondary">{t("macros.subtitle")}</p>
        </div>
        <Button type="button" onClick={openCreate} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t("macros.create")}
        </Button>
      </div>

      <p className="text-xs text-muted">{t("macros.placeholdersHelp")}</p>

      {isLoading ? (
        <div className="h-20 animate-pulse bg-surface rounded-lg" />
      ) : !macros?.length ? (
        <EmptyState
          icon={<MessageSquarePlus className="w-6 h-6" />}
          title={t("macros.emptyTitle")}
          description={t("macros.emptyDescription")}
        />
      ) : (
        <ul className="divide-y divide-default">
          {macros.map((macro) => (
            <li key={macro.macroId} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-primary">{macro.title}</p>
                  {macro.shortcut && (
                    <span className="rounded bg-surface px-1.5 py-0.5 text-xs text-muted">
                      /{macro.shortcut}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-secondary line-clamp-2 whitespace-pre-wrap">
                  {macro.content}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(macro)}
                  className="p-2 text-muted hover:text-primary"
                  aria-label={t("macros.edit")}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(macro)}
                  className="p-2 text-muted hover:text-red-600"
                  aria-label={t("macros.delete")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {dialogMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-default bg-surface-elevated p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-primary">
                {dialogMode === "create" ? t("macros.create") : t("macros.edit")}
              </h2>
              <button
                type="button"
                onClick={closeDialog}
                className="p-1 text-muted hover:text-primary"
                aria-label={t("metaFlows.close")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-secondary">{t("macros.fieldTitle")}</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  maxLength={128}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-secondary">{t("macros.fieldContent")}</label>
                <Textarea
                  value={form.content}
                  onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                  rows={5}
                  maxLength={1024}
                  className="resize-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-secondary">{t("macros.fieldShortcut")}</label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted">/</span>
                  <Input
                    value={form.shortcut}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        shortcut: e.target.value.replace(/[^a-zA-Z0-9-]/g, ""),
                      }))
                    }
                    maxLength={32}
                    placeholder={t("macros.shortcutPlaceholder")}
                  />
                </div>
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={closeDialog}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? t("bots.saving") : t("common.save")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-default bg-surface-elevated p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-primary">{t("macros.deleteTitle")}</h2>
            <p className="text-sm text-secondary">
              {t("macros.deleteConfirm", { name: deleteTarget.title })}
            </p>
            {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => void handleDelete()}
                disabled={removeMacro.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {t("macros.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
