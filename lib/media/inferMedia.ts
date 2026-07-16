export type MediaType = "image" | "youtube" | "spotify" | "apple_music" | "video" | "link";

export function inferMediaType(url: string): MediaType {
  const u = url.toLowerCase();
  if (u.startsWith("data:image/")) return "image";
  if (/\.(png|jpg|jpeg|gif|webp|avif|svg)(\?|#|$)/.test(u)) return "image";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("open.spotify.com")) return "spotify";
  if (u.includes("music.apple.com")) return "apple_music";
  if (/\.(mp4|webm|mov)(\?|#|$)/.test(u)) return "video";
  return "link";
}

export function youtubeEmbedUrl(url: string) {
  try {
    const u = new URL(url);
    let id = "";
    if (u.hostname.includes("youtu.be")) id = u.pathname.replace("/", "");
    else id = u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).pop() || "";
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch { return null; }
}

export function mediaHostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "link"; }
}
