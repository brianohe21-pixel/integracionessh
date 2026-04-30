"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { planLabel, formatDate } from "@/lib/utils";
import { Building2, Key, Webhook, CheckCircle } from "lucide-react";
import type { Tenant } from "@/types";

export default function SettingsPage() {
  const [webhookCopied, setWebhookCopied] = useState(false);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const webhookUrl = `${apiUrl}/webhook`;

  const { data: tenant } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
  });

  async function copyWebhook() {
    await navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">Gestiona tu cuenta y la integración con WhatsApp</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Información de la cuenta</h2>
          </div>

          {tenant ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Empresa</span>
                <span className="text-sm font-medium text-gray-900">{tenant.name}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Email</span>
                <span className="text-sm font-medium text-gray-900">{tenant.email}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Plan</span>
                <Badge variant="info">{planLabel(tenant.plan)}</Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Estado</span>
                <Badge variant={tenant.status === "active" ? "success" : "warning"}>
                  {tenant.status === "active" ? "Activo" : "Suspendido"}
                </Badge>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-500">Miembro desde</span>
                <span className="text-sm text-gray-700">{formatDate(tenant.createdAt)}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-gray-100">
                  <div className="h-4 w-24 bg-gray-200 rounded" />
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Webhook className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Webhook de WhatsApp</h2>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Configura esta URL en tu aplicación de Meta for Developers como webhook de WhatsApp.
          </p>

          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-700 truncate">
              {webhookUrl}
            </code>
            <button
              onClick={copyWebhook}
              className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              {webhookCopied ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  Copiado
                </>
              ) : (
                "Copiar"
              )}
            </button>
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="text-xs font-semibold text-blue-800 mb-2">Pasos para configurar en Meta:</p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>Accede a <strong>Meta for Developers</strong> → Tu aplicación</li>
              <li>Ve a <strong>WhatsApp → Configuración → Webhooks</strong></li>
              <li>Pega la URL del webhook y el <strong>Verify Token</strong> configurado en tu despliegue</li>
              <li>Suscríbete al campo <strong>messages</strong></li>
            </ol>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900 text-sm">API Keys</h2>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Las credenciales de WhatsApp y OpenAI se almacenan de forma segura en AWS Secrets Manager.
            Contacta al administrador para actualizarlas.
          </p>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-700">WhatsApp Access Token</p>
                <p className="text-xs text-gray-400">Almacenado en Secrets Manager</p>
              </div>
              <Badge variant="success">Configurado</Badge>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-700">OpenAI API Key</p>
                <p className="text-xs text-gray-400">Usa la clave de la plataforma si no tienes la propia</p>
              </div>
              <Badge variant="default">Plataforma</Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
