"use client";

import { useState } from "react";
import { X, Copy, CheckCircle, Eye, EyeOff } from "lucide-react";
import { useCreateApiKey } from "@/hooks/useApiKeys";
import type { ApiKeyWithSecret } from "@/types";

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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {step === "form" ? "Create API Key" : "Your new API Key"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === "form" && (
          <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Key name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production key"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bot</label>
              <select
                value={botId}
                onChange={(e) => setBotId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
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
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createKey.isPending || bots.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
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
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                API Key
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    readOnly
                    type={showKey ? "text" : "password"}
                    value={createdKey.key}
                    className="w-full px-3 py-2 pr-9 border border-gray-300 rounded-lg text-sm font-mono bg-gray-50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => void handleCopy()}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-xs font-mono text-gray-600 space-y-1">
              <p className="text-gray-400 font-sans mb-2 text-[11px] uppercase tracking-wide">
                Example usage
              </p>
              <p>curl -X POST \</p>
              <p className="pl-4">
                {(process.env.NEXT_PUBLIC_API_URL ?? "https://api.integracionessh.lat").replace(
                  /\/$/,
                  ""
                )}
                /v1/messages \
              </p>
              <p className="pl-4">{`-H "X-API-Key: ${createdKey.key.slice(0, 20)}…" \\`}</p>
              <p className="pl-4">{`-H "Content-Type: application/json" \\`}</p>
              <p className="pl-4">{`-d '{"to":"521234567890","type":"text","text":"Hello!"}'`}</p>
              <p className="text-gray-400 font-sans mt-3 mb-1 text-[11px] uppercase tracking-wide">
                Calls (WebRTC signaling)
              </p>
              <p>POST /v1/calls · GET /v1/calls/permission/{"{userWaId}"} · POST /v1/calls/{"{callId}"}</p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
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
