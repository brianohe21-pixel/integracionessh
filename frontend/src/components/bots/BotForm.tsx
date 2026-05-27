"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCreateBot, useUpdateBot } from "@/hooks/useBots";
import type { Bot } from "@/types";

interface BotFormProps {
  bot?: Bot;
}

export function BotForm({ bot }: BotFormProps) {
  const router = useRouter();
  const isEditing = !!bot;

  const [form, setForm] = useState({
    name: bot?.name ?? "",
    responseMode: bot?.responseMode ?? "openai",
    systemPrompt: bot?.systemPrompt ?? "",
    model: bot?.model ?? "gpt-4o",
    temperature: bot?.temperature ?? 0.7,
    maxTokens: bot?.maxTokens ?? 1024,
    webhookUrl: bot?.webhookUrl ?? "",
    webhookSecret: "",
    phoneNumberId: bot?.phoneNumberId ?? "",
    whatsappBusinessAccountId: bot?.whatsappBusinessAccountId ?? "",
  });

  const [error, setError] = useState("");
  const createBot = useCreateBot();
  const updateBot = useUpdateBot(bot?.botId ?? "");

  const isPending = createBot.isPending || updateBot.isPending;
  const isWebhookMode = form.responseMode === "webhook";

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "temperature" || name === "maxTokens" ? Number(value) : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        responseMode: form.responseMode,
        phoneNumberId: form.phoneNumberId,
        whatsappBusinessAccountId: form.whatsappBusinessAccountId,
      };

      if (isWebhookMode) {
        payload.webhookUrl = form.webhookUrl;
        if (form.webhookSecret) payload.webhookSecret = form.webhookSecret;
      } else {
        payload.systemPrompt = form.systemPrompt;
        payload.model = form.model;
        payload.temperature = form.temperature;
        payload.maxTokens = form.maxTokens;
      }

      if (isEditing) {
        await updateBot.mutateAsync(payload as Parameters<typeof updateBot.mutateAsync>[0]);
      } else {
        await createBot.mutateAsync(payload as Parameters<typeof createBot.mutateAsync>[0]);
      }
      router.push("/bots");
    } catch (err) {
      setError((err as Error).message ?? "Error al guardar el bot");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del bot
          </label>
          <input
            name="name"
            type="text"
            required
            value={form.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Ej: Asistente de Ventas"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Modo de respuesta
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, responseMode: "openai" }))}
              className={cn(
                "flex flex-col items-start gap-1 px-4 py-3 rounded-lg border-2 text-left transition-colors",
                !isWebhookMode
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <span className="text-sm font-medium text-gray-900">OpenAI</span>
              <span className="text-xs text-gray-500">Respuestas generadas por GPT</span>
            </button>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, responseMode: "webhook" }))}
              className={cn(
                "flex flex-col items-start gap-1 px-4 py-3 rounded-lg border-2 text-left transition-colors",
                isWebhookMode
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <span className="text-sm font-medium text-gray-900">Webhook propio</span>
              <span className="text-xs text-gray-500">Tu servidor procesa los mensajes</span>
            </button>
          </div>
        </div>

        {!isWebhookMode && (
          <>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prompt del sistema
              </label>
              <textarea
                name="systemPrompt"
                required
                rows={5}
                value={form.systemPrompt}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Eres un asistente virtual de [empresa]. Tu función es..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
              <select
                name="model"
                value={form.model}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temperatura ({form.temperature})
              </label>
              <input
                name="temperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={form.temperature}
                onChange={handleChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-3"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Preciso (0)</span>
                <span>Creativo (2)</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Máximo de tokens
              </label>
              <input
                name="maxTokens"
                type="number"
                min="1"
                max="4096"
                value={form.maxTokens}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </>
        )}

        {isWebhookMode && (
          <>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL del webhook
              </label>
              <input
                name="webhookUrl"
                type="url"
                required
                value={form.webhookUrl}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                placeholder="https://mi-servidor.com/chatbot/webhook"
              />
              <p className="mt-1 text-xs text-gray-500">Solo se aceptan URLs con HTTPS.</p>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Secret del webhook{" "}
                <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <input
                name="webhookSecret"
                type="password"
                value={form.webhookSecret}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                placeholder={isEditing && bot?.webhookSecret ? "••••••••  (dejar vacío para no cambiar)" : "Mínimo 8 caracteres"}
              />
              <p className="mt-1 text-xs text-gray-500">
                Si lo configuras, cada request incluirá el header{" "}
                <code className="bg-gray-100 px-1 rounded">X-Webhook-Signature: sha256=…</code>{" "}
                que puedes verificar en tu servidor con HMAC-SHA256.
              </p>
            </div>

            <div className="col-span-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600 space-y-2">
              <p className="font-medium text-gray-700">Contrato del webhook</p>
              <p>Tu endpoint recibirá un <code className="bg-white border border-gray-200 px-1 rounded">POST</code> con:</p>
              <pre className="bg-white border border-gray-200 rounded p-2 overflow-x-auto text-xs">{`{
  "message": "texto del usuario",
  "from": "número de teléfono",
  "conversationId": "uuid",
  "botId": "uuid",
  "contact": { "name": "Nombre" }
}`}</pre>
              <p>Debe responder con (máximo 1.024 caracteres):</p>
              <pre className="bg-white border border-gray-200 rounded p-2 overflow-x-auto text-xs">{`{ "reply": "texto de respuesta" }`}</pre>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number ID (WhatsApp)
          </label>
          <input
            name="phoneNumberId"
            type="text"
            required
            value={form.phoneNumberId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            placeholder="1234567890"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            WhatsApp Business Account ID (WABA)
          </label>
          <input
            name="whatsappBusinessAccountId"
            type="text"
            required
            value={form.whatsappBusinessAccountId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            placeholder="No es el Phone Number ID"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            "px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors",
            isPending ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
          )}
        >
          {isPending ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear bot"}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
