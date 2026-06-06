"use client";

import type { ApiKeyUsageSummary } from "@/types";

interface ApiUsageChartProps {
  usage: ApiKeyUsageSummary[];
}

function BarChart({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.floor(560 / data.length) - 6;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 580 180`}
        className="w-full"
        aria-label="API usage bar chart"
        role="img"
      >
        {data.map((d, i) => {
          const barH = Math.max(4, Math.round((d.value / max) * 120));
          const x = i * (barWidth + 6) + 10;
          const y = 130 - barH;
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={4}
                className={d.color}
              />
              <text
                x={x + barWidth / 2}
                y={150}
                textAnchor="middle"
                className="fill-gray-500 text-[9px]"
                fontSize={9}
              >
                {d.label}
              </text>
              {d.value > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 4}
                  textAnchor="middle"
                  className="fill-gray-600 text-[9px]"
                  fontSize={9}
                >
                  {d.value}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function ApiUsageChart({ usage }: ApiUsageChartProps) {
  const totalMessages = usage.reduce((sum, u) => sum + u.messagesThisMonth, 0);
  const totalSuccess = usage.reduce((sum, u) => sum + u.successRequests, 0);
  const totalErrors = usage.reduce((sum, u) => sum + u.errorRequests, 0);
  const successRate =
    totalMessages > 0 ? Math.round((totalSuccess / totalMessages) * 100) : 100;

  const chartData = usage.slice(0, 12).map((u) => ({
    label: u.keyName.slice(0, 8),
    value: u.messagesThisMonth,
    color: "fill-indigo-400",
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
            Messages this month
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {totalMessages.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Success rate</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{successRate}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
            Successful requests
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalSuccess.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Errors</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{totalErrors.toLocaleString()}</p>
        </div>
      </div>

      {usage.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Messages this month by key
          </h3>
          {chartData.length > 0 ? (
            <BarChart data={chartData} />
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Usage by key</h3>
        </div>
        {usage.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No usage data yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-6 py-3 font-medium">Key</th>
                  <th className="px-6 py-3 font-medium text-right">Requests</th>
                  <th className="px-6 py-3 font-medium text-right">Success</th>
                  <th className="px-6 py-3 font-medium text-right">Errors</th>
                  <th className="px-6 py-3 font-medium">Last used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usage.map((u) => (
                  <tr key={u.keyId} className="hover:bg-gray-50/50">
                    <td className="px-6 py-3.5">
                      <div className="font-medium text-gray-900">{u.keyName}</div>
                      <code className="text-xs text-gray-400 font-mono">{u.prefix}…</code>
                    </td>
                    <td className="px-6 py-3.5 text-right text-gray-700 font-medium">
                      {u.totalRequests.toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-right text-green-700">
                      {u.successRequests.toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-right text-red-500">
                      {u.errorRequests.toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-gray-500">
                      {u.lastUsedAt
                        ? new Date(u.lastUsedAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
