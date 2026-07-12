"use client";

import { parseTags } from "@/lib/utils/tags";

export function TagInput({ value, onChange, placeholder = "study, health, writing" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const tags = parseTags(value);
  return (
    <div>
      <input className="life-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((tag) => <span key={tag} className="life-badge">#{tag}</span>)}
        </div>
      )}
    </div>
  );
}
