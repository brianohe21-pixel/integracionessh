export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div>
      {label ? (
        <p className="text-[11px] font-sans uppercase tracking-wide text-muted mb-1.5">{label}</p>
      ) : null}
      <pre className="text-xs bg-surface border border-default rounded-lg p-4 overflow-x-auto text-secondary font-mono whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  );
}
