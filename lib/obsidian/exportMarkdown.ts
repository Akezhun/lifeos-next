import { createAdminSupabase } from "@/lib/supabase/admin";

function safeSlug(input: string) {
  return String(input || "untitled")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ\-_\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80) || "untitled";
}
function mdEscape(v: any) { return String(v ?? "").replace(/\r\n/g, "\n"); }
function yaml(v: any) { return String(v ?? "").replace(/"/g, "'"); }
function link(path: string, label: string) { return `[[${path}|${label}]]`; }
function dateOnly(v: any) { return v ? String(v).slice(0,10) : ""; }
function timeOnly(v: any) { return v ? String(v).slice(11,16) : ""; }

type FileItem = { path: string; content: string; object_type: string; object_id?: string | null };

export async function buildObsidianFiles(userId: string): Promise<FileItem[]> {
  const sb = createAdminSupabase();
  const [trackersRes, eventsRes, notesRes, journalsRes, entriesRes, sectionsRes, tokensRes, rulesRes, tagsRes, objectTagsRes, mediaRes] = await Promise.all([
    sb.from("trackers").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    sb.from("tracker_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    sb.from("tracker_notes").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
    sb.from("journals").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    sb.from("journal_entries").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
    sb.from("journal_sections").select("*").eq("user_id", userId).order("sort_order"),
    sb.from("schedule_tokens").select("*").eq("user_id", userId).order("start_at", { ascending: true }),
    sb.from("schedule_rules").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
    sb.from("tags").select("*").eq("user_id", userId).order("name"),
    sb.from("object_tags").select("*").eq("user_id", userId),
    sb.from("media_items").select("*").eq("user_id", userId).order("created_at", { ascending: false })
  ]);

  const trackers = trackersRes.data || [];
  const events = eventsRes.data || [];
  const notes = notesRes.data || [];
  const journals = journalsRes.data || [];
  const entries = entriesRes.data || [];
  const sections = sectionsRes.data || [];
  const tokens = tokensRes.data || [];
  const rules = rulesRes.data || [];
  const tags = tagsRes.data || [];
  const objectTags = objectTagsRes.data || [];
  const media = mediaRes.data || [];

  const tagById = new Map(tags.map((t: any) => [t.id, t.name]));
  const tagsFor = (object_type: string, object_id: string) => objectTags.filter((x: any) => x.object_type === object_type && x.object_id === object_id).map((x: any) => tagById.get(x.tag_id)).filter(Boolean) as string[];
  const trackerById = new Map(trackers.map((t: any) => [t.id, t]));
  const journalById = new Map(journals.map((j: any) => [j.id, j]));
  const entryById = new Map(entries.map((e: any) => [e.id, e]));
  const journalPath = (j: any) => `Journals/${safeSlug(j?.title || "Journal")}/index`;
  const entryPath = (e: any) => `Journals/${safeSlug(journalById.get(e.journal_id)?.title || "Journal")}/entries/${safeSlug(e.title)}`;
  const trackerPath = (t: any) => `Trackers/${safeSlug(t.title)}--${String(t.id).slice(0,8)}`;
  const tagPath = (name: string) => `Tags/${safeSlug(name)}`;

  const files: FileItem[] = [];
  files.push({ path: "LifeOS_Index.md", object_type: "index", content: `# LifeOS Index\n\nGenerated from Supabase. GitHub Vault is a Markdown mirror, not the main database.\n\n## Counts\n\n- Trackers: ${trackers.length}\n- Journal entries: ${entries.length}\n- Schedule tokens: ${tokens.length + rules.length}\n- Tags: ${tags.length}\n\n## Sections\n\n- [[Trackers/index|Trackers]]\n- [[Journals/index|Journals]]\n- [[Schedule/index|Schedule]]\n- [[Analytics/index|Analytics]]\n- [[Tags/index|Tags]]\n\n_Last export: ${new Date().toISOString()}_\n` });

  files.push({ path: "Trackers/index.md", object_type: "tracker_index", content: `# Trackers\n\n${trackers.map((t: any) => `- ${link(trackerPath(t), t.title)} — ${t.type} / ${t.priority}${t.archived_at ? " / archived" : ""}`).join("\n") || "No trackers."}\n` });

  for (const t of trackers) {
    const ev = events.filter((e: any) => e.tracker_id === t.id).slice(0, 60);
    const n = notes.filter((x: any) => x.tracker_id === t.id);
    const tg = tagsFor("tracker", t.id);
    const content = `---\ntype: tracker\nid: "${t.id}"\ntags: [${tg.map((x) => `"${yaml(x)}"`).join(", ")}]\n---\n# ${mdEscape(t.title)}\n\n## Status\n\n- Type: ${t.type}\n- Priority: ${t.priority}\n- Status: ${t.status}\n- Deadline: ${t.deadline_at || ""}\n- Cycle: ${t.cycle_type || ""}\n- Countdown days: ${t.countdown_days || ""}\n- Archived: ${t.archived_at ? "yes" : "no"}\n\n## Tags\n\n${tg.map((x) => `- ${link(tagPath(x), "#" + x)}`).join("\n") || "No tags."}\n\n## Notes\n\n${n.map((x: any) => `### ${x.title || dateOnly(x.updated_at)}\n\n${mdEscape(x.body)}`).join("\n\n") || "No notes."}\n\n## History\n\n${ev.map((e: any) => `- ${e.created_at}: **${e.event_type}** ${e.amount ? `(${e.amount})` : ""}`).join("\n") || "No history."}\n\n## Obsidian Workspace\n\n<!-- LIFEOS:OBSIDIAN_WORKSPACE_START -->\nWrite personal notes here. LifeOS will preserve this block in future sync versions.\n<!-- LIFEOS:OBSIDIAN_WORKSPACE_END -->\n`;
    files.push({ path: `${trackerPath(t)}.md`, content, object_type: "tracker", object_id: t.id });
  }

  files.push({ path: "Journals/index.md", object_type: "journal_index", content: `# Journals\n\n${journals.map((j: any) => `- ${link(journalPath(j), j.title)}`).join("\n") || "No journals."}\n` });
  for (const j of journals) {
    const jEntries = entries.filter((e: any) => e.journal_id === j.id);
    files.push({ path: `${journalPath(j)}.md`, object_type: "journal", object_id: j.id, content: `# ${mdEscape(j.title)}\n\n${mdEscape(j.description || "")}\n\n## Entries\n\n${jEntries.map((e: any) => `- ${link(entryPath(e), e.title)} — ${e.entry_type}, ${e.word_count || 0} words`).join("\n") || "No entries."}\n` });
  }
  for (const e of entries) {
    const tg = tagsFor("journal_entry", e.id);
    const sec = sections.filter((s: any) => s.entry_id === e.id);
    const mediaItems = media.filter((m: any) => m.object_type === "journal_entry" && m.object_id === e.id);
    const body = sec.length ? sec.map((s: any) => `## ${mdEscape(s.name)}\n\n${mdEscape(s.body)}`).join("\n\n") : mdEscape(e.body || "");
    const content = `---\ntype: journal_entry\nid: "${e.id}"\njournal: "${yaml(journalById.get(e.journal_id)?.title || "")}"\nentry_type: "${yaml(e.entry_type)}"\nstatus: "${yaml(e.status)}"\ntags: [${tg.map((x) => `"${yaml(x)}"`).join(", ")}]\n---\n# ${mdEscape(e.title)}\n\n- Words: ${e.word_count || 0}\n- Mood: ${e.mood ?? ""}\n- Energy: ${e.energy ?? ""}\n- Updated: ${e.updated_at}\n\n## Tags\n\n${tg.map((x) => `- ${link(tagPath(x), "#" + x)}`).join("\n") || "No tags."}\n\n${body}\n\n## Media\n\n${mediaItems.map((m: any) => `- [${m.title || m.url}](${m.url})`).join("\n") || "No media."}\n\n## Obsidian Workspace\n\n<!-- LIFEOS:OBSIDIAN_WORKSPACE_START -->\nFree Obsidian-only notes here.\n<!-- LIFEOS:OBSIDIAN_WORKSPACE_END -->\n`;
    files.push({ path: `${entryPath(e)}.md`, content, object_type: "journal_entry", object_id: e.id });
  }

  files.push({ path: "Schedule/index.md", object_type: "schedule_index", content: `# Schedule\n\n## One-time tokens\n\n${tokens.map((x: any) => `- ${dateOnly(x.start_at)} ${timeOnly(x.start_at)}–${timeOnly(x.end_at)} — ${mdEscape(x.title)} (${x.source_type})`).join("\n") || "No tokens."}\n\n## Rules\n\n${rules.map((x: any) => `- ${mdEscape(x.title)} — ${x.recurrence_kind || x.rule_type || "rule"}`).join("\n") || "No rules."}\n` });

  files.push({ path: "Analytics/index.md", object_type: "analytics", content: `# Analytics Snapshot\n\nGenerated: ${new Date().toISOString()}\n\n## Tracker status\n\n- Done events: ${events.filter((e: any) => e.event_type === "done").length}\n- Fail events: ${events.filter((e: any) => e.event_type === "fail").length}\n- Partial events: ${events.filter((e: any) => e.event_type === "partial").length}\n\n## Journal\n\n- Entries: ${entries.length}\n- Words: ${entries.reduce((s: number, e: any) => s + (e.word_count || 0), 0)}\n\n## Schedule\n\n- Tokens: ${tokens.length}\n- Rules: ${rules.length}\n` });

  files.push({ path: "Tags/index.md", object_type: "tag_index", content: `# Tags\n\n${tags.map((t: any) => `- ${link(tagPath(t.name), "#" + t.name)}`).join("\n") || "No tags."}\n` });
  for (const tag of tags) {
    const refs = objectTags.filter((ot: any) => ot.tag_id === tag.id);
    const lines = refs.map((ot: any) => {
      if (ot.object_type === "tracker" && trackerById.has(ot.object_id)) return `- Tracker: ${link(trackerPath(trackerById.get(ot.object_id)), trackerById.get(ot.object_id).title)}`;
      if (ot.object_type === "journal_entry" && entryById.has(ot.object_id)) return `- Journal: ${link(entryPath(entryById.get(ot.object_id)), entryById.get(ot.object_id).title)}`;
      return `- ${ot.object_type}: ${ot.object_id}`;
    });
    files.push({ path: `${tagPath(tag.name)}.md`, object_type: "tag", object_id: tag.id, content: `# #${mdEscape(tag.name)}\n\n${lines.join("\n") || "No linked objects."}\n` });
  }

  return files;
}
