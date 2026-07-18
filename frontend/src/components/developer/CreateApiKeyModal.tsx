"use client";

import { useState } from "react";
import { X, Copy, CheckCircle, Eye, EyeOff } from "lucide-react";
import { useCreateApiKey } from "@/hooks/useApiKeys";
import type { ApiKeyWithSecret } from "@/types";
import { buildSendMessageCurlExample, CALLS_ENDPOINT_HINT } from "@/lib/api-docs/curl";

interface CreateApiKeyModalProps {
  bots: Array<{ botId: string; name: string }>;
  onClose: () => void;
}

export function CreateApiKeyModal({ bots, onClose }: CreateApiKeyModalProps) {
  const [step, setStep] = useState<"form" | "reveal">("form");
  const [createdKey, setCreatedKey] = useState<ApiKeyWithSecret | null>(null);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [name, setName] = useState("");
  const [botId, setBotId] = useState(bots[0]?.botId ?? "");

  const createKey = useCreateApiKey();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await createKey.mutateAsync({ name, botId });
    setCreatedKey(result);
    setStep("reveal");
  }

  async function handleCopy() {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-surface-elevated rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-subtle">
          <h2 className="text-base font-semibold text-primary">
            {step === "form" ? "Create API Key" : "Your new API Key"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-secondary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === "form" && (
          <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Key name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production key"
                className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Bot</label>
              <select
                value={botId}
                onChange={(e) => setBotId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-surface-elevated"
              >
                {bots.map((b) => (
                  <option key={b.botId} value={b.botId}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {createKey.isError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                {createKey.error?.message ?? "Failed to create key"}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-secondary bg-surface-muted rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createKey.isPending || bots.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50"
              >
                {createKey.isPending ? "Creating…" : "Create key"}
              </button>
            </div>
          </form>
        )}

        {step === "reveal" && createdKey && (
          <div className="p-6 space-y-5">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-800">
                Copy your API key now — it will not be shown again.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5 uppercase tracking-wide">
                API Key
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    readOnly
                    type={showKey ? "text" : "password"}
                    value={createdKey.key}
                    className="w-full px-3 py-2 pr-9 border border-default rounded-lg text-sm font-mono bg-surface focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-secondary"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => void handleCopy()}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent-muted transition-colors"
                >
                  {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="bg-surface rounded-lg p-4 text-xs font-mono text-secondary space-y-1">
              <p className="text-muted font-sans mb-2 text-[11px] uppercase tracking-wide">
                Example usage
              </p>
              <pre className="whitespace-pre-wrap break-all">
                {buildSendMessageCurlExample(`${createdKey.key.slice(0, 20)}…`)}
              </pre>
              <p className="text-muted font-sans mt-3 mb-1 text-[11px] uppercase tracking-wide">
                Calls (WebRTC signaling)
              </p>
              <p>{CALLS_ENDPOINT_HINT}</p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
