"use client";

import { useState } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useOpenAIKeyStatus, useSaveOpenAIKey, useDeleteOpenAIKey } from "@/hooks/useOpenAIKey";
import { useT } from "@/i18n/context";

export function OpenAIKeyCard() {
  const t = useT();
  const { data: status, isLoading } = useOpenAIKeyStatus();
  const save = useSaveOpenAIKey();
  const remove = useDeleteOpenAIKey();

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");

  const isConfigured = status?.configured ?? false;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await save.mutateAsync(value.trim());
      setValue("");
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.openaiSaveError"));
    }
  }

  async function handleDelete() {
    setError("");
    try {
      await remove.mutateAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.openaiSaveError"));
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 animate-pulse">
        <div className="w-2 h-2 bg-gray-300 rounded-full" />
        <div className="flex-1 h-4 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 p-3 bg-gray-50">
        <div className={`w-2 h-2 rounded-full ${isConfigured ? "bg-indigo-500" : "bg-gray-300"}`} />
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-700">{t("settings.openaiKey")}</p>
          <p className="text-xs text-gray-400">
            {isConfigured ? t("settings.openaiKeyOwn") : t("settings.openaiKeyDesc")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isConfigured ? "info" : "default"}>
            {isConfigured ? t("settings.ownBadge") : t("settings.platformBadge")}
          </Badge>
          {isConfigured ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={remove.isPending}
              title={t("settings.openaiKeyRemove")}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setEditing((v) => !v); setError(""); setValue(""); }}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
            >
              {editing ? t("settings.cancel") : t("settings.openaiKeyAdd")}
            </button>
          )}
        </div>
      </div>

      {editing && !isConfigured && (
        <form onSubmit={handleSave} className="p-3 border-t border-gray-100 bg-white space-y-2">
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="sk-..."
              autoFocus
              className="w-full pr-9 px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setEditing(false); setValue(""); setError(""); }}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={save.isPending || value.trim().length < 10}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {save.isPending ? t("settings.openaiKeySaving") : t("common.save")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
