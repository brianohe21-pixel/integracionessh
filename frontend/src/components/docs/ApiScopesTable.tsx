import { API_SCOPES } from "@/lib/api-docs/constants";
import { useT } from "@/i18n/context";

export function ApiScopesTable() {
  const t = useT();

  return (
    <div className="overflow-x-auto rounded-lg border border-default">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-default bg-surface text-left text-secondary">
            <th className="py-2.5 px-4 font-medium">{t("apiDocs.scopes.colScope")}</th>
            <th className="py-2.5 px-4 font-medium">{t("apiDocs.scopes.colEndpoints")}</th>
          </tr>
        </thead>
        <tbody>
          {API_SCOPES.map((row) => (
            <tr key={row.scope} className="border-b border-subtle last:border-0">
              <td className="py-2.5 px-4 font-mono text-xs text-accent">{row.scope}</td>
              <td className="py-2.5 px-4 font-mono text-xs text-secondary">
                {row.endpoints.join(" · ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
