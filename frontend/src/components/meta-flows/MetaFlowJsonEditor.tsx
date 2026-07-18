"use client";

interface MetaFlowJsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function MetaFlowJsonEditor({ value, onChange, readOnly }: MetaFlowJsonEditorProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      rows={18}
      className="w-full font-mono text-xs border border-default rounded-lg p-3 bg-surface focus:ring-2 focus:ring-accent focus:border-accent/30"
      spellCheck={false}
    />
  );
}
