type PushResult = { path: string; sha?: string; status: "created" | "updated" | "skipped" | "failed"; message?: string };

function env(name: string) { return process.env[name] || ""; }
function b64(content: string) { return Buffer.from(content, "utf8").toString("base64"); }
function fromB64(content: string) { return Buffer.from(String(content || "").replace(/\n/g, ""), "base64").toString("utf8"); }

function preserveBlock(nextContent: string, previousContent: string) {
  const start = "<!-- LIFEOS:OBSIDIAN_WORKSPACE_START -->";
  const end = "<!-- LIFEOS:OBSIDIAN_WORKSPACE_END -->";
  const prevStart = previousContent.indexOf(start);
  const prevEnd = previousContent.indexOf(end);
  const nextStart = nextContent.indexOf(start);
  const nextEnd = nextContent.indexOf(end);
  if (prevStart === -1 || prevEnd === -1 || nextStart === -1 || nextEnd === -1) return nextContent;
  const prevBlock = previousContent.slice(prevStart, prevEnd + end.length);
  return nextContent.slice(0, nextStart) + prevBlock + nextContent.slice(nextEnd + end.length);
}

async function githubJson(url: string, init: RequestInit = {}) {
  const token = env("GITHUB_TOKEN");
  const res = await fetch(url, {
    ...init,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {})
    }
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok && res.status !== 404) throw new Error(json?.message || `GitHub HTTP ${res.status}`);
  return { res, json };
}

export async function pushMarkdownFile(path: string, content: string, message = "LifeOS Obsidian sync"): Promise<PushResult> {
  const repo = env("GITHUB_VAULT_REPO");
  const branch = env("GITHUB_VAULT_BRANCH") || "main";
  const root = (env("GITHUB_VAULT_ROOT") || "LifeOS").replace(/^\/+|\/+$/g, "");
  if (!env("GITHUB_TOKEN") || !repo) return { path, status: "skipped", message: "Missing GITHUB_TOKEN or GITHUB_VAULT_REPO" };
  const fullPath = `${root}/${path}`.replace(/\/+/g, "/");
  const api = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(fullPath).replace(/%2F/g, "/")}`;
  try {
    let sha: string | undefined;
    let previousContent = "";
    const existing = await githubJson(`${api}?ref=${encodeURIComponent(branch)}`);
    if (existing.res.status !== 404) {
      sha = existing.json?.sha;
      if (existing.json?.content) previousContent = fromB64(existing.json.content);
    }
    const mergedContent = previousContent ? preserveBlock(content, previousContent) : content;
    const put = await githubJson(api, {
      method: "PUT",
      body: JSON.stringify({ message, content: b64(mergedContent), branch, ...(sha ? { sha } : {}) })
    });
    const newSha = put.json?.content?.sha;
    return { path: fullPath, sha: newSha, status: sha ? "updated" : "created" };
  } catch (e: any) {
    return { path: fullPath, status: "failed", message: e?.message || String(e) };
  }
}
