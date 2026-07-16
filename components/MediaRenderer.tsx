"use client";

import { inferMediaType, mediaHostname } from "@/lib/media/inferMedia";

export const urlRegex = /(data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+|https?:\/\/[^\s<>()\]]+)/g;

function youtubeEmbed(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${u.pathname.replace("/", "")}`;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (u.pathname.startsWith("/shorts/")) return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
    }
  } catch {}
  return null;
}

function spotifyEmbed(url: string) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("spotify.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) return `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`;
  } catch {}
  return null;
}

function appleMusic(url: string) {
  try { return new URL(url).hostname.includes("music.apple.com"); } catch { return false; }
}

export function extractMediaUrls(text?: string | null) {
  return Array.from(new Set((text || "").match(urlRegex) || []));
}

export function stripMediaTokens(text?: string | null) {
  return (text || "")
    .replace(urlRegex, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function MediaCard({ url, title, compact = false }: { url: string; title?: string | null; compact?: boolean }) {
  const type = inferMediaType(url);
  const isDataImage = url.startsWith("data:image/");
  const host = isDataImage ? "embedded image" : mediaHostname(url);
  const yt = !isDataImage ? youtubeEmbed(url) : null;
  const sp = !isDataImage ? spotifyEmbed(url) : null;

  if (isDataImage || type === "image") {
    return (
      <figure className="my-3 overflow-hidden rounded-3xl border border-white/10 bg-black/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={title || "media"} className={`${compact ? "max-h-[260px]" : "max-h-[620px]"} w-full object-contain`} />
        {(title || (!isDataImage && host)) && <figcaption className="border-t border-white/10 px-4 py-2 text-xs text-white/55">{title || host}</figcaption>}
      </figure>
    );
  }

  if (yt) {
    return <div className="my-3 overflow-hidden rounded-3xl border border-white/10 bg-black/20"><iframe src={yt} title={title || "YouTube"} className="aspect-video w-full" allowFullScreen /></div>;
  }

  if (sp) {
    return <div className="my-3 overflow-hidden rounded-3xl border border-white/10 bg-black/20"><iframe src={sp} title={title || "Spotify"} className="h-[152px] w-full" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" /></div>;
  }

  if (appleMusic(url)) {
    return <a href={url} target="_blank" rel="noreferrer" className="my-3 block rounded-3xl border border-white/10 bg-white/[0.04] p-4 hover:border-violet-300/25"><div className="text-xs uppercase tracking-[.18em] text-white/35">Apple Music</div><div className="mt-1 font-black">{title || url}</div><div className="mt-1 text-sm text-white/50">{host}</div></a>;
  }

  return <a href={url} target="_blank" rel="noreferrer" className="my-3 block rounded-3xl border border-white/10 bg-white/[0.04] p-4 hover:border-violet-300/25"><div className="text-xs uppercase tracking-[.18em] text-white/35">Link preview</div><div className="mt-1 break-words font-black">{title || url}</div><div className="mt-1 text-sm text-white/50">{host}</div></a>;
}

function renderTextWithInlineMedia(text: string, compact: boolean) {
  const out: any[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const rx = new RegExp(urlRegex.source, "g");

  while ((match = rx.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) out.push(...renderPlainText(before, `text-${lastIndex}`));
    out.push(<MediaCard key={`media-${match.index}`} url={match[0]} compact={compact} />);
    lastIndex = match.index + match[0].length;
  }

  const after = text.slice(lastIndex);
  if (after) out.push(...renderPlainText(after, `text-${lastIndex}`));
  return out;
}

function renderPlainText(text: string, keyPrefix: string) {
  const blocks = text.split(/\n{2,}/g);
  return blocks.map((block, idx) => {
    const clean = block.trim();
    if (!clean) return null;
    return <p key={`${keyPrefix}-${idx}`} className="my-2 whitespace-pre-wrap leading-7 text-white/72">{clean}</p>;
  }).filter(Boolean);
}

export function InlineMediaText({ text, items = [], compact = false }: { text?: string | null; items?: any[]; compact?: boolean }) {
  const content = text || "";
  const itemRows = (items || []).filter((m) => m?.url);
  const alreadyInText = new Set(extractMediaUrls(content));
  const attachedOnly = itemRows.filter((m) => !alreadyInText.has(m.url));

  if (!content.trim() && !attachedOnly.length) return <div className="text-sm text-white/38">No text yet.</div>;

  return (
    <div className="life-rich-text">
      {renderTextWithInlineMedia(content, compact)}
      {attachedOnly.map((m) => <MediaCard key={m.url} url={m.url} title={m.title} compact={compact} />)}
    </div>
  );
}

// Backward-compatible wrapper, now renders media inline instead of collecting it below the text.
export function MediaRenderer({ text, items = [] }: { text?: string | null; items?: any[]; title?: string }) {
  return <InlineMediaText text={text} items={items} />;
}
