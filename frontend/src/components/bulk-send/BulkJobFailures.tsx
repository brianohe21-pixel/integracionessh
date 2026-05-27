"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BulkSendFailureKind, BulkSendFailuresResponse } from "@/hooks/useBulkSend";

function kindLabel(kind: BulkSendFailureKind): string {
  return kind === "delivery" ? "Entrega" : "Envío";
}

function kindVariant(kind: BulkSendFailureKind): string {
  return kind === "delivery"
    ? "bg-orange-50 text-orange-700"
    : "bg-red-50 text-red-700";
}

interface BulkJobFailuresProps {
  jobId: string;
  enabled?: boolean;
}

export function BulkJobFailures({ jobId, enabled = true }: BulkJobFailuresProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["bulk-failures", jobId],
    queryFn: () => api.get<BulkSendFailuresResponse>(`/bulk-send/${jobId}/failures`),
    enabled,
  });

  if (isLoading) {
    return <p className="text-xs text-gray-400 px-5 py-3">Cargando detalle de fallos...</p>;
  }

  if (isError) {
    return <p className="text-xs text-red-600 px-5 py-3">No se pudo cargar el detalle de fallos.</p>;
  }

  if (!data || data.total === 0) {
    return (
      <p className="text-xs text-gray-400 px-5 py-3">
        No hay detalle de fallos guardado para esta campaña.
      </p>
    );
  }

  return (
    <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 space-y-4">
      {data.summary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.summary.map((row) => (
            <span
              key={`${row.kind}-${row.errorCode ?? "x"}-${row.errorTitle}`}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${kindVariant(row.kind)}`}
            >
              <span>{kindLabel(row.kind)}</span>
              {row.errorCode != null && <span className="opacity-70">#{row.errorCode}</span>}
              <span>{row.errorTitle}</span>
              <span className="font-semibold">×{row.count}</span>
            </span>
          ))}
        </div>
      )}

      <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-2">Teléfono</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-2">Tipo</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-2">Código</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-2">Causa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.items.map((item, i) => (
              <tr key={`${item.to}-${item.failedAt}-${i}`}>
                <td className="px-3 py-2 text-gray-900 font-mono text-xs">{item.to}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${kindVariant(item.kind)}`}>
                    {kindLabel(item.kind)}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">
                  {item.errorCode ?? "—"}
                </td>
                <td className="px-3 py-2 text-gray-700 text-xs">{item.errorMessage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.total >= 500 && (
        <p className="text-xs text-gray-400">Mostrando los primeros 500 registros.</p>
      )}
    </div>
  );
}
