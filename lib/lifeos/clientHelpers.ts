import { SupabaseClient } from "@supabase/supabase-js";

export type Priority = "low" | "mid" | "high";
export type TrackerType = "deadline" | "cycle" | "countdown" | "gray";

export function parseTags(value: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value || "");
  return Array.from(new Set(raw.split(/[#,\n]/g).map((x) => x.trim().toLowerCase()).filter(Boolean)));
}

export function tagsToText(tags: string[]) { return tags.join(", "); }

export function countWords(text?: string | null) {
  return (text || "").trim().split(/\s+/).filter(Boolean).length;
}

export function fmtDateTime(value?: string | Date | null) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function fmtDate(value?: string | Date | null) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" });
}

export function isoLocalDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isoLocalDateTime(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function startOfWeek(d = new Date()) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}

export function addDays(d: Date, days: number) { const x = new Date(d); x.setDate(x.getDate() + days); return x; }
export function addMinutes(d: Date, mins: number) { const x = new Date(d); x.setMinutes(x.getMinutes() + mins); return x; }
export function minutesBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 60000); }

export function priorityRank(p?: string | null) { return p === "high" ? 3 : p === "mid" ? 2 : 1; }

export function weekdayMon0(d = new Date()) { return (d.getDay() + 6) % 7; }

export function cycleIsActiveToday(tracker: any, now = new Date()) {
  const meta = tracker?.metadata || {};
  if (tracker?.type !== "cycle") return true;
  if (tracker.cycle_type === "daily") {
    const days = Array.isArray(meta.cycle_weekdays) ? meta.cycle_weekdays.map(Number) : [];
    return days.length ? days.includes(weekdayMon0(now)) : true;
  }
  if (tracker.cycle_type === "monthly") {
    const days = Array.isArray(meta.cycle_month_days) ? meta.cycle_month_days.map(Number) : [];
    return days.length ? days.includes(now.getDate()) : true;
  }
  return true;
}

export function cycleStart(cycle: string | null | undefined, now = new Date()) {
  const d = new Date(now);
  if (cycle === "weekly") {
    return startOfWeek(d);
  }
  if (cycle === "monthly") {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export type TrackerStatus = { key: "green"|"yellow"|"orange"|"red"|"black"|"gray"; label: string; order: number; urgency: number; };

export function trackerVisualStatus(tracker: any, events: any[] = [], now = new Date()): TrackerStatus {
  const latestDone = events.filter((e) => ["done", "partial_done"].includes(e.event_type)).sort((a,b) => +new Date(b.occurred_at)-+new Date(a.occurred_at))[0];
  if (tracker.archived_at || tracker.status === "archived") return { key: "gray", label: "Archived", order: 6, urgency: 999999 };
  if (tracker.type === "deadline") {
    if (latestDone) return { key: "green", label: "Done", order: 5, urgency: 999999 };
    if (!tracker.deadline_at) return { key: "yellow", label: "No deadline", order: 3, urgency: 999999 };
    const ms = +new Date(tracker.deadline_at) - +now;
    if (ms < 0) return { key: "black", label: "Missed", order: 1, urgency: ms };
    if (ms < 3600000) return { key: "red", label: "< 1 hour", order: 2, urgency: ms };
    if (ms < 86400000) return { key: "orange", label: "Today", order: 3, urgency: ms };
    return { key: "green", label: "Planned", order: 5, urgency: ms };
  }
  if (tracker.type === "cycle") {
    if (!cycleIsActiveToday(tracker, now)) return { key: "gray", label: "Not required today", order: 6, urgency: 999999 };
    const start = cycleStart(tracker.cycle_type, now);
    const cycleDone = events.some((e) => ["done", "partial_done"].includes(e.event_type) && new Date(e.occurred_at) >= start);
    if (cycleDone) return { key: "green", label: "Done this cycle", order: 5, urgency: 999999 };
    let end = addDays(start, 1);
    if (tracker.cycle_type === "weekly") end = addDays(start, 7);
    if (tracker.cycle_type === "monthly") end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const left = +end - +now;
    const total = +end - +start;
    const ratio = left / Math.max(total, 1);
    if (left < 0) return { key: "black", label: "Cycle missed", order: 1, urgency: left };
    if (ratio < .12) return { key: "red", label: "Cycle ending", order: 2, urgency: left };
    if (ratio < .35) return { key: "orange", label: "Soon", order: 3, urgency: left };
    return { key: "yellow", label: "Waiting", order: 4, urgency: left };
  }
  if (tracker.type === "countdown") {
    if (!latestDone) return { key: "red", label: "Start countdown", order: 2, urgency: 0 };
    const days = Number(tracker.countdown_days || 1);
    const next = addDays(new Date(latestDone.occurred_at), days);
    const ms = +next - +now;
    if (ms < 0) return { key: "black", label: "Countdown missed", order: 1, urgency: ms };
    if (ms < 3600000) return { key: "red", label: "< 1 hour", order: 2, urgency: ms };
    if (ms < 86400000) return { key: "orange", label: "Today", order: 3, urgency: ms };
    return { key: "green", label: `Next ${fmtDate(next)}`, order: 5, urgency: ms };
  }
  if (latestDone) return { key: "green", label: "Done", order: 5, urgency: 999999 };
  return { key: "gray", label: "Open", order: 4, urgency: 999999 };
}

export function successRate(done: number, fail: number) {
  const total = done + fail;
  return total ? Math.round((done / total) * 100) : 0;
}

export async function loadObjectTags(sb: SupabaseClient, userId: string, objectType: string, ids: string[]) {
  if (!ids.length) return new Map<string, string[]>();
  const { data } = await sb
    .from("object_tags")
    .select("object_id,tags(name)")
    .eq("user_id", userId)
    .eq("object_type", objectType)
    .in("object_id", ids);
  const map = new Map<string, string[]>();
  for (const id of ids) map.set(id, []);
  for (const row of data || []) {
    const obj = row as any;
    const name = obj.tags?.name;
    if (name) map.set(obj.object_id, [...(map.get(obj.object_id) || []), name]);
  }
  return map;
}

export async function saveObjectTags(sb: SupabaseClient, userId: string, objectType: string, objectId: string, tagNames: string[]) {
  const names = parseTags(tagNames);
  await sb.from("object_tags").delete().eq("user_id", userId).eq("object_type", objectType).eq("object_id", objectId);
  if (!names.length) return;
  const tagIds: string[] = [];
  for (const name of names) {
    const { data: existing } = await sb.from("tags").select("id").eq("user_id", userId).eq("name", name).maybeSingle();
    if (existing?.id) tagIds.push(existing.id);
    else {
      const { data: inserted } = await sb.from("tags").insert({ user_id: userId, name }).select("id").single();
      if (inserted?.id) tagIds.push(inserted.id);
    }
  }
  if (tagIds.length) {
    await sb.from("object_tags").insert(tagIds.map((tag_id) => ({ user_id: userId, tag_id, object_type: objectType, object_id: objectId })));
  }
}

export function defaultSectionsForType(type: string) {
  if (type === "Essay/Academic") return ["Draft", "Outline", "Sources", "Final Version"];
  if (type === "Project") return ["Problem", "What I did", "Next Step", "Notes"];
  if (type === "Learning") return ["What I learned", "Still unclear", "Questions", "Free Notes"];
  return ["Text"];
}
