"use client";

import { useState } from "react";
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useSendTemplate,
} from "@/hooks/useTemplates";
import { useBots } from "@/hooks/useBots";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";
import type { WhatsAppTemplate, TemplateComponent } from "@/types";
import {
  LayoutTemplate,
  Plus,
  Send,
  Pencil,
  Trash2,
  X,
  Languages,
  Tag,
  Clock,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";

type DialogMode = "create" | "edit" | null;

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "warning" | "danger" }> = {
  APPROVED: { label: "Aprobado", variant: "success" },
  PENDING: { label: "Pendiente", variant: "warning" },
  REJECTED: { label: "Rechazado", variant: "danger" },
};

const CATEGORY_LABELS: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidad",
  AUTHENTICATION: "Autenticacion",
};

const LANGUAGES = [
  { code: "es", label: "Espanol" },
  { code: "en", label: "Ingles" },
  { code: "en_US", label: "Ingles (US)" },
  { code: "es_AR", label: "Espanol (AR)" },
  { code: "es_MX", label: "Espanol (MX)" },
  { code: "pt_BR", label: "Portugues (BR)" },
];

function extractBodyVariables(text: string): string[] {
  const matches = text.match(/\{\{\d+\}\}/g);
  return matches ? [...new Set(matches)] : [];
}

export default function TemplatesPage() {
  const [botFilter, setBotFilter] = useState<string>("");
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [sendTarget, setSendTarget] = useState<WhatsAppTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<WhatsAppTemplate | null>(null);

  const { data: bots } = useBots();
  const { data: templates, isLoading, error, refetch } = useTemplates(botFilter || undefined);
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();
  const sendMutation = useSendTemplate();

  const [formName, setFormName] = useState("");
  const [formLanguage, setFormLanguage] = useState("es");
  const [formCategory, setFormCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">("UTILITY");
  const [formHeaderText, setFormHeaderText] = useState("");
  const [formBodyText, setFormBodyText] = useState("");
  const [formFooterText, setFormFooterText] = useState("");
  const [formBodyExamples, setFormBodyExamples] = useState<Record<string, string>>({});

  const [sendTo, setSendTo] = useState("");
  const [sendParams, setSendParams] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  function openCreate() {
    setFormError("");
    setFormName("");
    setFormLanguage("es");
    setFormCategory("UTILITY");
    setFormHeaderText("");
    setFormBodyText("");
    setFormFooterText("");
    setFormBodyExamples({});
    setEditingTemplate(null);
    setDialogMode("create");
  }

  function openEdit(t: WhatsAppTemplate) {
    if (t.status !== "REJECTED") return;
    setFormError("");
    setFormName(t.name);
    setFormLanguage(t.language);
    setFormCategory(t.category);
    setFormHeaderText(t.components.find((c) => c.type === "HEADER")?.text ?? "");
    const bodyComp = t.components.find((c) => c.type === "BODY");
    const bodyText = bodyComp?.text ?? "";
    setFormBodyText(bodyText);
    setFormFooterText(t.components.find((c) => c.type === "FOOTER")?.text ?? "");
    const vars = extractBodyVariables(bodyText).sort(
      (a, b) => parseInt(a.replace(/\D/g, "")) - parseInt(b.replace(/\D/g, ""))
    );
    const examples: Record<string, string> = {};
    if (bodyComp?.example?.body_text?.[0]) {
      vars.forEach((v, i) => { examples[v] = bodyComp.example!.body_text![0][i] ?? ""; });
    }
    setFormBodyExamples(examples);
    setEditingTemplate(t);
    setDialogMode("edit");
  }

  function openSend(t: WhatsAppTemplate) {
    setSendTo("");
    const bodyText = t.components.find((c) => c.type === "BODY")?.text ?? "";
    const vars = extractBodyVariables(bodyText);
    const initial: Record<string, string> = {};
    vars.forEach((v) => { initial[v] = ""; });
    setSendParams(initial);
    setSendTarget(t);
  }

  function buildComponents(): TemplateComponent[] {
    const components: TemplateComponent[] = [];
    if (formHeaderText.trim()) {
      components.push({ type: "HEADER", format: "TEXT", text: formHeaderText.trim() });
    }
    const bodyVars = extractBodyVariables(formBodyText).sort(
      (a, b) => parseInt(a.replace(/\D/g, "")) - parseInt(b.replace(/\D/g, ""))
    );
    const bodyComp: TemplateComponent = { type: "BODY", text: formBodyText.trim() };
    if (bodyVars.length > 0) {
      bodyComp.example = {
        body_text: [bodyVars.map((v) => formBodyExamples[v]?.trim() || v)],
      };
    }
    components.push(bodyComp);
    if (formFooterText.trim()) {
      components.push({ type: "FOOTER", text: formFooterText.trim() });
    }
    return components;
  }

  async function handleCreateOrUpdate() {
    if (!botFilter || !formBodyText.trim()) return;

    setFormError("");
    try {
      if (dialogMode === "create") {
        await createMutation.mutateAsync({
          botId: botFilter,
          name: formName,
          language: formLanguage,
          category: formCategory,
          components: buildComponents(),
        });
      } else if (dialogMode === "edit" && editingTemplate) {
        await updateMutation.mutateAsync({
          name: editingTemplate.name,
          botId: botFilter,
          language: editingTemplate.language,
          components: buildComponents(),
        });
      }

      setDialogMode(null);
      refetch();
    } catch (err) {
      setFormError((err as Error).message ?? "Error al guardar el template");
    }
  }

  async function handleDelete() {
    if (!deleteConfirm || !botFilter) return;
    await deleteMutation.mutateAsync({ name: deleteConfirm.name, botId: botFilter });
    setDeleteConfirm(null);
    refetch();
  }

  async function handleSend() {
    if (!sendTarget || !sendTo.trim() || !botFilter) return;

    const bodyVarKeys = Object.keys(sendParams);
    const bodyParams = bodyVarKeys.length
      ? [{
          type: "body",
          parameters: bodyVarKeys.map((k) => ({ type: "text" as const, text: sendParams[k] })),
        }]
      : undefined;

    await sendMutation.mutateAsync({
      name: sendTarget.name,
      botId: botFilter,
      to: sendTo,
      language: sendTarget.language,
      components: bodyParams,
    });

    setSendTarget(null);
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona las plantillas de mensaje de WhatsApp Business
          </p>
        </div>
        <button
          onClick={openCreate}
          disabled={!botFilter}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Crear template
        </button>
      </div>

      <div className="mb-6">
        <select
          value={botFilter}
          onChange={(e) => setBotFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-72"
        >
          <option value="">Selecciona un bot</option>
          {bots?.map((bot) => (
            <option key={bot.botId} value={bot.botId}>
              {bot.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800 mb-2">Ciclo de vida de un template</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-blue-700">
              <div className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-lg px-2.5 py-1.5">
                <Clock className="w-3.5 h-3.5 text-yellow-500" />
                <span className="font-medium">Pendiente</span>
                <span className="text-blue-500">— Meta lo está revisando (minutos a 24 h)</span>
              </div>
              <span className="text-blue-400">→</span>
              <div className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-lg px-2.5 py-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                <span className="font-medium">Aprobado</span>
                <span className="text-blue-500">— Listo para enviar (no editable)</span>
              </div>
              <span className="text-blue-400">o</span>
              <div className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-lg px-2.5 py-1.5">
                <XCircle className="w-3.5 h-3.5 text-red-500" />
                <span className="font-medium">Rechazado</span>
                <span className="text-blue-500">— Unico estado que permite editar</span>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              Meta no permite editar plantillas aprobadas ni pendientes. Si necesitas cambios, elimina la plantilla y crea una nueva con otro nombre.
            </p>
          </div>
        </div>
      </div>

      {!botFilter && (
        <EmptyState
          icon={<LayoutTemplate className="w-6 h-6" />}
          title="Selecciona un bot"
          description="Elige un bot para ver y gestionar sus templates de WhatsApp."
        />
      )}

      {botFilter && isLoading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="h-4 w-40 bg-gray-200 rounded" />
                <div className="h-4 w-16 bg-gray-200 rounded-full" />
                <div className="h-4 w-16 bg-gray-200 rounded-full" />
                <div className="flex-1" />
                <div className="h-8 w-20 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {botFilter && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600">Error al cargar los templates. Intenta de nuevo.</p>
        </div>
      )}

      {botFilter && !isLoading && !error && templates?.length === 0 && (
        <EmptyState
          icon={<LayoutTemplate className="w-6 h-6" />}
          title="Sin templates"
          description="No se encontraron plantillas. Crea una o sincroniza desde Meta."
          action={
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear template
            </button>
          }
        />
      )}

      {botFilter && !isLoading && templates && templates.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                  Nombre
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                  Idioma
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                  Categoria
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                  Estado
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                  Sincronizado
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((t) => {
                const statusInfo = STATUS_BADGE[t.status] ?? STATUS_BADGE.PENDING;
                return (
                  <tr key={`${t.name}-${t.language}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <LayoutTemplate className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">{t.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Languages className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-600">{t.language}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {CATEGORY_LABELS[t.category] ?? t.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div
                        title={
                          t.status === "PENDING"
                            ? "Meta está revisando este template. Puede tardar minutos o hasta 24 h."
                            : t.status === "REJECTED"
                            ? "Meta rechazó este template. Edítalo para corregirlo y volver a enviarlo."
                            : "Aprobado por Meta. Listo para enviar."
                        }
                      >
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">
                      {formatDate(t.syncedAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {t.status === "APPROVED" && (
                          <button
                            onClick={() => openSend(t)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Enviar"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        {t.status === "REJECTED" ? (
                          <button
                            onClick={() => openEdit(t)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            title="Editar y reenviar a Meta"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        ) : (
                          <span
                            className="p-1.5 rounded-md text-gray-300 cursor-not-allowed"
                            title={
                              t.status === "APPROVED"
                                ? "Las plantillas aprobadas no se pueden editar en Meta"
                                : "Espera la revision de Meta; solo se editan si son rechazadas"
                            }
                          >
                            <Pencil className="w-4 h-4" />
                          </span>
                        )}
                        <button
                          onClick={() => setDeleteConfirm(t)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialogMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {dialogMode === "create" ? "Crear Template" : "Editar Template"}
              </h2>
              <button
                onClick={() => setDialogMode(null)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{formError}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                  disabled={dialogMode === "edit"}
                  placeholder="mi_plantilla"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
                <p className="text-xs text-gray-400 mt-1">Solo letras minusculas, numeros y guion bajo</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Idioma</label>
                  <select
                    value={formLanguage}
                    onChange={(e) => setFormLanguage(e.target.value)}
                    disabled={dialogMode === "edit"}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as typeof formCategory)}
                    disabled={dialogMode === "edit"}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
                  >
                    <option value="UTILITY">Utilidad</option>
                    <option value="MARKETING">Marketing</option>
                    <option value="AUTHENTICATION">Autenticacion</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Header <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={formHeaderText}
                  onChange={(e) => setFormHeaderText(e.target.value)}
                  placeholder="Titulo del mensaje"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                <textarea
                  value={formBodyText}
                  onChange={(e) => {
                    setFormBodyText(e.target.value);
                    const newVars = extractBodyVariables(e.target.value);
                    setFormBodyExamples((prev) => {
                      const next: Record<string, string> = {};
                      newVars.forEach((v) => { next[v] = prev[v] ?? ""; });
                      return next;
                    });
                  }}
                  rows={4}
                  placeholder={"Hola {{1}}, tu pedido {{2}} esta listo."}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">{"Usa {{1}}, {{2}}, etc. para variables dinamicas"}</p>
              </div>

              {extractBodyVariables(formBodyText).length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-amber-800">Ejemplos de variables</p>
                    <p className="text-xs text-amber-600 mt-0.5">Meta requiere un valor de ejemplo por cada variable</p>
                  </div>
                  {extractBodyVariables(formBodyText)
                    .sort((a, b) => parseInt(a.replace(/\D/g, "")) - parseInt(b.replace(/\D/g, "")))
                    .map((v) => (
                      <div key={v} className="flex items-center gap-3">
                        <span className="text-xs font-mono bg-amber-100 text-amber-700 px-2 py-1 rounded w-12 text-center shrink-0">{v}</span>
                        <input
                          type="text"
                          value={formBodyExamples[v] ?? ""}
                          onChange={(e) => setFormBodyExamples((prev) => ({ ...prev, [v]: e.target.value }))}
                          placeholder={`Ej: Juan`}
                          className="flex-1 px-3 py-1.5 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                        />
                      </div>
                    ))}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Footer <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={formFooterText}
                  onChange={(e) => setFormFooterText(e.target.value)}
                  placeholder="Texto al pie del mensaje"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setDialogMode(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateOrUpdate}
                disabled={
                  isSubmitting ||
                  !formBodyText.trim() ||
                  (dialogMode === "create" && !formName.trim()) ||
                  extractBodyVariables(formBodyText).some((v) => !formBodyExamples[v]?.trim())
                }
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Guardando..." : dialogMode === "create" ? "Crear" : "Actualizar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {sendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Enviar: {sendTarget.name}
              </h2>
              <button
                onClick={() => setSendTarget(null)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Numero de destino
                </label>
                <input
                  type="tel"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value.replace(/\D/g, ""))}
                  placeholder="573001234567"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-400 mt-1">Codigo de pais + numero sin espacios</p>
              </div>

              {Object.keys(sendParams).length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Variables del template</p>
                  {Object.keys(sendParams).map((key) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-1">{key}</label>
                      <input
                        type="text"
                        value={sendParams[key]}
                        onChange={(e) =>
                          setSendParams((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        placeholder={`Valor para ${key}`}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Preview</p>
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  {sendTarget.components.find((c) => c.type === "HEADER")?.text && (
                    <p className="text-sm font-semibold text-gray-900 mb-1">
                      {sendTarget.components.find((c) => c.type === "HEADER")!.text}
                    </p>
                  )}
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {(() => {
                      let body = sendTarget.components.find((c) => c.type === "BODY")?.text ?? "";
                      Object.entries(sendParams).forEach(([key, val]) => {
                        if (val) body = body.replace(key, val);
                      });
                      return body;
                    })()}
                  </p>
                  {sendTarget.components.find((c) => c.type === "FOOTER")?.text && (
                    <p className="text-xs text-gray-400 mt-2">
                      {sendTarget.components.find((c) => c.type === "FOOTER")!.text}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setSendTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSend}
                disabled={sendMutation.isPending || !sendTo.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {sendMutation.isPending ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
            <div className="px-6 py-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Eliminar template</h2>
              <p className="text-sm text-gray-500">
                Estas seguro de eliminar <span className="font-medium text-gray-900">{deleteConfirm.name}</span>?
                Se eliminara de Meta y no se puede deshacer.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
