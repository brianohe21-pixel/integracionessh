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
      className="w-full font-mono text-xs border border-gray-300 rounded-lg p-3 bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      spellCheck={false}
    />
  );
}
