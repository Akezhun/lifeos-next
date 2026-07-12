export function parseTags(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[#,\s]+/g)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
        .map((x) => x.replace(/^#/, ""))
    )
  );
}

export function normalizeTag(raw: string) {
  return raw.trim().toLowerCase().replace(/^#/, "");
}

export function wordCount(text: string | null | undefined) {
  if (!text) return 0;
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}
