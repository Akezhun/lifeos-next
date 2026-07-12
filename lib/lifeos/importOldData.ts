import { SupabaseClient } from "@supabase/supabase-js";
import { parseTags, wordCount } from "@/lib/utils/tags";

async function attachTags(sb: SupabaseClient, userId: string, objectType: string, objectId: string, tags: string[] | string | undefined) {
  const tagNames = Array.isArray(tags) ? tags : parseTags(tags ?? "");
  for (const raw of tagNames) {
    const name = String(raw).trim().toLowerCase().replace(/^#/, "");
    if (!name) continue;
    const { data: tag } = await sb.from("tags").upsert({ user_id: userId, name }, { onConflict: "user_id,name" }).select("id").single();
    if (tag?.id) await sb.from("object_tags").upsert({ user_id: userId, tag_id: tag.id, object_type: objectType, object_id: objectId }, { onConflict: "user_id,tag_id,object_type,object_id" });
  }
}

export async function importTasks(sb: SupabaseClient, userId: string, raw: unknown) {
  const tasks = Array.isArray(raw) ? raw : [];
  let count = 0;
  for (const task of tasks as any[]) {
    const { data, error } = await sb.from("trackers").insert({
      user_id: userId,
      legacy_id: String(task.id ?? ""),
      title: String(task.title ?? task.name ?? "Untitled tracker"),
      type: task.type ?? "gray",
      priority: task.priority ?? "mid",
      deadline_at: task.deadline ? new Date(task.deadline).toISOString() : null,
      cycle_type: task.cycle ?? null,
      countdown_days: task.days ?? null,
      archived_at: task.archived ? new Date().toISOString() : null
    }).select("id").single();
    if (!error && data?.id) {
      count++;
      await attachTags(sb, userId, "tracker", data.id, task.tags);
      const history = Array.isArray(task.history) ? task.history : [];
      for (const h of history) {
        await sb.from("tracker_events").insert({
          user_id: userId,
          tracker_id: data.id,
          event_type: h.action ?? h.type ?? "legacy",
          occurred_at: h.timestamp ? new Date(h.timestamp).toISOString() : new Date().toISOString(),
          note: h.note ?? null,
          metadata: h
        });
      }
      if (task.notes) {
        await sb.from("tracker_notes").insert({ user_id: userId, tracker_id: data.id, body: String(task.notes), created_at: new Date().toISOString() });
      }
    }
  }
  return count;
}

export async function importJournals(sb: SupabaseClient, userId: string, raw: unknown) {
  const journals = Array.isArray(raw) ? raw : [];
  let count = 0;
  for (const j of journals as any[]) {
    const { data: journal } = await sb.from("journals").insert({
      user_id: userId,
      legacy_id: String(j.id ?? ""),
      title: String(j.title ?? j.name ?? "Imported Journal"),
      description: j.description ?? null
    }).select("id").single();
    if (!journal?.id) continue;
    count++;
    const entries = Array.isArray(j.entries) ? j.entries : [];
    for (const e of entries) {
      const body = String(e.body ?? e.text ?? e.content ?? "");
      const { data: entry } = await sb.from("journal_entries").insert({
        user_id: userId,
        journal_id: journal.id,
        legacy_id: String(e.id ?? ""),
        title: String(e.title ?? "Untitled entry"),
        entry_type: e.entry_type ?? e.type ?? "Diary",
        status: e.status ?? "draft",
        body,
        mood: e.mood ?? null,
        energy: e.energy ?? null,
        word_count: wordCount(body),
        created_at: e.created_at ? new Date(e.created_at).toISOString() : new Date().toISOString()
      }).select("id").single();
      if (entry?.id) await attachTags(sb, userId, "journal_entry", entry.id, e.tags);
    }
  }
  return count;
}

export async function importSchedule(sb: SupabaseClient, userId: string, raw: unknown) {
  const data = raw as any;
  const tokens = Array.isArray(data) ? data : Array.isArray(data?.tokens) ? data.tokens : [];
  let count = 0;
  for (const t of tokens) {
    const start = t.start_at ?? t.start ?? t.start_time;
    const end = t.end_at ?? t.end ?? t.end_time;
    if (!start || !end) continue;
    const { data: token } = await sb.from("schedule_tokens").insert({
      user_id: userId,
      legacy_id: String(t.id ?? ""),
      title: String(t.title ?? "Imported token"),
      source_type: t.source_type ?? t.kind ?? "free",
      start_at: new Date(start).toISOString(),
      end_at: new Date(end).toISOString(),
      recurrence_kind: t.recurrence_kind ?? t.recurrence ?? "one_time"
    }).select("id").single();
    if (token?.id) {
      count++;
      await attachTags(sb, userId, "schedule_token", token.id, t.tags);
    }
  }
  return count;
}
