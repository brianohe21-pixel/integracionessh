export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div>
      {label ? (
        <p className="text-[11px] font-sans uppercase tracking-wide text-gray-400 mb-1.5">{label}</p>
      ) : null}
      <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto text-gray-700 font-mono whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  );
}
