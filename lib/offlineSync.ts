import { OfflineQueueItem, getOfflineQueue, removeOfflineItem, updateOfflineItem } from "@/lib/offlineQueue";

function nowDate() {
  return new Date().toISOString().slice(0, 10);
}

async function getOrCreateQuickJournal(sb: any, userId: string) {
  const { data: existing } = await sb.from("journals").select("id").eq("user_id", userId).eq("title", "Quick Notes").maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await sb.from("journals").insert({ user_id: userId, title: "Quick Notes", description: "Fast notes created from mobile quick capture and offline mode." }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function syncOfflineItem(sb: any, userId: string, item: OfflineQueueItem) {
  if (item.kind === "tracker") {
    const { error } = await sb.from("trackers").insert({
      user_id: userId,
      title: item.payload.title || "Quick tracker",
      type: item.payload.type || "gray",
      priority: item.payload.priority || "mid",
      status: "active",
      deadline_at: item.payload.deadline_at || null,
      metadata: { quick_capture: true, offline_created_at: item.createdAt, ...(item.payload.metadata || {}) }
    });
    if (error) throw error;
    return;
  }

  if (item.kind === "tracker_event") {
    const { error } = await sb.from("tracker_events").insert({
      user_id: userId,
      tracker_id: item.payload.tracker_id,
      event_type: item.payload.event_type,
      note: item.payload.note || null,
      occurred_at: item.payload.occurred_at || item.createdAt,
      metadata: { offline_created_at: item.createdAt, ...(item.payload.metadata || {}) }
    });
    if (error) throw error;
    return;
  }

  if (item.kind === "journal_note") {
    const journalId = item.payload.journal_id || await getOrCreateQuickJournal(sb, userId);
    const body = item.payload.body || item.payload.title || "";
    const { error } = await sb.from("journal_entries").insert({
      user_id: userId,
      journal_id: journalId,
      title: item.payload.title || "Quick note",
      entry_type: item.payload.entry_type || "Draft",
      status: item.payload.status || "draft",
      body,
      word_count: String(body).trim().split(/\s+/).filter(Boolean).length
    });
    if (error) throw error;
    return;
  }

  if (item.kind === "schedule_token") {
    const date = item.payload.date || nowDate();
    const start = item.payload.start || "09:00";
    const end = item.payload.end || "10:00";
    const { error } = await sb.from("schedule_tokens").insert({
      user_id: userId,
      title: item.payload.title || "Quick token",
      source_type: item.payload.source_type || "free",
      linked_tracker_id: item.payload.linked_tracker_id || null,
      linked_journal_entry_id: item.payload.linked_journal_entry_id || null,
      start_at: item.payload.start_at || new Date(`${date}T${start}`).toISOString(),
      end_at: item.payload.end_at || new Date(`${date}T${end}`).toISOString(),
      recurrence_kind: "one_time",
      metadata: { quick_capture: true, offline_created_at: item.createdAt, ...(item.payload.metadata || {}) }
    });
    if (error) throw error;
  }
}

export async function syncOfflineQueue(sb: any, userId: string) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, remaining: getOfflineQueue(userId).length, offline: true };
  }
  const items = getOfflineQueue(userId).slice().reverse();
  let synced = 0;
  for (const item of items) {
    try {
      await syncOfflineItem(sb, userId, item);
      removeOfflineItem(userId, item.id);
      synced += 1;
    } catch (e) {
      updateOfflineItem(userId, item.id, { attempts: (item.attempts || 0) + 1, lastError: e instanceof Error ? e.message : "sync failed" });
    }
  }
  return { synced, remaining: getOfflineQueue(userId).length, offline: false };
}
