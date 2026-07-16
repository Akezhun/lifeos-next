import { createAdminSupabase } from "@/lib/supabase/admin";

export type NotificationCandidate = {
  user_id: string;
  dedupe_key: string;
  channel_type: "email" | "telegram";
  target: string;
  title: string;
  body: string;
  source_type: string;
  source_id: string | null;
};

type Rule = { rule_type: string; enabled: boolean; lead_minutes: number | null; time_of_day: string | null; weekdays?: number[] | null };

function addMinutes(d: Date, mins: number) { const x = new Date(d); x.setMinutes(x.getMinutes() + mins); return x; }
function addDays(d: Date, days: number) { const x = new Date(d); x.setDate(x.getDate() + days); return x; }

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const out: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") out[p.type] = p.value;
  const hour = out.hour === "24" ? "00" : out.hour;
  return { year: Number(out.year), month: Number(out.month), day: Number(out.day), hour: Number(hour), minute: Number(out.minute), second: Number(out.second) };
}

function localDateKey(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2,"0")}-${String(p.day).padStart(2,"0")}`;
}

function localMinutes(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  return p.hour * 60 + p.minute;
}

function timezoneOffsetMinutes(utcGuess: Date, timeZone: string) {
  const p = zonedParts(utcGuess, timeZone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second || 0);
  return (asUTC - utcGuess.getTime()) / 60000;
}

function zonedDateTimeToUtc(dateKey: string, timeString: string, timeZone: string) {
  const [y,m,d] = dateKey.split("-").map(Number);
  const [hh,mm] = String(timeString).slice(0,5).split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0, 0));
  const offset = timezoneOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offset * 60000);
}

function weekdayMon0(dateKey: string, timeZone: string) {
  const utc = zonedDateTimeToUtc(dateKey, "12:00", timeZone);
  return (utc.getUTCDay() + 6) % 7;
}

function getRules(rules: Rule[], ruleType: string) {
  return rules.filter((r) => r.rule_type === ruleType && r.enabled !== false);
}

function defaultRules(ruleType: string, lead: number): Rule[] {
  return [{ rule_type: ruleType, enabled: true, lead_minutes: lead, time_of_day: null }];
}

function notifyOn(row: any) { return !!row?.metadata?.notify_enabled; }
function reminderMinutes(row: any, fallback: number) { return Number(row?.metadata?.reminder_minutes || fallback); }
function cycleActiveToday(row: any, now: Date, timeZone: string) {
  const meta = row?.metadata || {};
  const key = localDateKey(now, timeZone);
  const wd = weekdayMon0(key, timeZone);
  if (row.cycle_type === "daily") {
    const days = Array.isArray(meta.cycle_weekdays) ? meta.cycle_weekdays.map(Number) : [];
    return days.length ? days.includes(wd) : true;
  }
  if (row.cycle_type === "monthly") {
    const day = Number(key.slice(8,10));
    const days = Array.isArray(meta.cycle_month_days) ? meta.cycle_month_days.map(Number) : [];
    return days.length ? days.includes(day) : true;
  }
  return true;
}

function maxLead(rules: Rule[], fallback: number) {
  return Math.max(fallback, ...rules.map((r) => Number(r.lead_minutes || 0)).filter(Boolean));
}

function inLeadWindow(target: Date, now: Date, lead: number) {
  return target >= now && target <= addMinutes(now, lead);
}

function localCycleBounds(now: Date, cycleType: string | null, timeZone: string) {
  const p = zonedParts(now, timeZone);
  let startKey = `${p.year}-${String(p.month).padStart(2,"0")}-${String(p.day).padStart(2,"0")}`;
  let endKey = startKey;

  if (cycleType === "weekly") {
    const todayNoon = zonedDateTimeToUtc(startKey, "12:00", timeZone);
    const wd = (todayNoon.getUTCDay() + 6) % 7;
    const monday = addDays(todayNoon, -wd);
    const sundayNext = addDays(monday, 7);
    startKey = localDateKey(monday, timeZone);
    endKey = localDateKey(sundayNext, timeZone);
  } else if (cycleType === "monthly") {
    startKey = `${p.year}-${String(p.month).padStart(2,"0")}-01`;
    const nextMonth = p.month === 12 ? { y: p.year + 1, m: 1 } : { y: p.year, m: p.month + 1 };
    endKey = `${nextMonth.y}-${String(nextMonth.m).padStart(2,"0")}-01`;
  } else {
    const tomorrow = addDays(zonedDateTimeToUtc(startKey, "12:00", timeZone), 1);
    endKey = localDateKey(tomorrow, timeZone);
  }
  return { start: zonedDateTimeToUtc(startKey, "00:00", timeZone), end: zonedDateTimeToUtc(endKey, "00:00", timeZone), startKey, endKey };
}

async function hasDoneEvent(sb: any, userId: string, trackerId: string, start?: Date, end?: Date) {
  let q = sb.from("tracker_events").select("id").eq("user_id", userId).eq("tracker_id", trackerId).in("event_type", ["done", "partial_done"]).limit(1);
  if (start) q = q.gte("occurred_at", start.toISOString());
  if (end) q = q.lt("occurred_at", end.toISOString());
  const { data } = await q;
  return Boolean(data?.length);
}

async function latestDoneOrCreated(sb: any, userId: string, tracker: any) {
  const { data } = await sb.from("tracker_events").select("occurred_at").eq("user_id", userId).eq("tracker_id", tracker.id).in("event_type", ["done", "partial_done"]).order("occurred_at", { ascending: false }).limit(1);
  return data?.[0]?.occurred_at ? new Date(data[0].occurred_at) : new Date(tracker.created_at);
}

function scheduleRuleOccurrences(rule: any, exceptions: any[], now: Date, windowEnd: Date, timeZone: string) {
  const occurrences: { start: Date; end: Date; dateKey: string }[] = [];
  const cursor = new Date(now);
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  for (let i = 0; i < 4; i++) {
    const day = addDays(cursor, i);
    const dateKey = localDateKey(day, timeZone);
    if (dateKey < rule.start_date) continue;
    if (rule.end_date && dateKey > rule.end_date) continue;
    const wd = weekdayMon0(dateKey, timeZone);
    if (!Array.isArray(rule.weekdays) || !rule.weekdays.includes(wd)) continue;
    const ex = exceptions.find((x: any) => x.rule_id === rule.id && x.original_date === dateKey);
    if (ex?.action === "delete") continue;
    const start = ex?.moved_start_at ? new Date(ex.moved_start_at) : zonedDateTimeToUtc(dateKey, String(rule.start_time).slice(0,5), timeZone);
    const end = ex?.moved_end_at ? new Date(ex.moved_end_at) : zonedDateTimeToUtc(dateKey, String(rule.end_time).slice(0,5), timeZone);
    if (start >= now && start <= windowEnd) occurrences.push({ start, end, dateKey });
  }
  return occurrences;
}

async function buildDailyBriefBody(sb: any, userId: string, now: Date, timeZone: string) {
  const todayKey = localDateKey(now, timeZone);
  const tomorrowKey = localDateKey(addDays(now, 1), timeZone);
  const todayStart = zonedDateTimeToUtc(todayKey, "00:00", timeZone);
  const tomorrowStart = zonedDateTimeToUtc(tomorrowKey, "00:00", timeZone);
  const { data: tokens } = await sb.from("schedule_tokens").select("title,start_at,end_at").eq("user_id", userId).gte("start_at", todayStart.toISOString()).lt("start_at", tomorrowStart.toISOString()).order("start_at");
  const { data: deadlines } = await sb.from("trackers").select("id,title,deadline_at").eq("user_id", userId).eq("type", "deadline").is("archived_at", null).gte("deadline_at", now.toISOString()).lt("deadline_at", tomorrowStart.toISOString()).order("deadline_at");

  const tokenLines = (tokens ?? []).slice(0, 8).map((t: any) => `- ${new Date(t.start_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone })} ${t.title}`);
  const deadlineLines = (deadlines ?? []).slice(0, 8).map((t: any) => `- ${new Date(t.deadline_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone })} ${t.title}`);
  return [
    `LifeOS daily brief · ${todayKey}`,
    "",
    `Schedule today: ${(tokens ?? []).length}`,
    tokenLines.length ? tokenLines.join("\n") : "- no one-time tokens today",
    "",
    `Deadlines today: ${(deadlines ?? []).length}`,
    deadlineLines.length ? deadlineLines.join("\n") : "- no deadlines today",
    "",
    "Open LifeOS to review Trackers, Schedule, and Analytics."
  ].join("\n");
}


async function buildReviewBody(sb: any, userId: string, now: Date, timeZone: string, mode: "evening" | "weekly") {
  const todayKey = localDateKey(now, timeZone);
  const start = mode === "weekly" ? localCycleBounds(now, "weekly", timeZone).start : zonedDateTimeToUtc(todayKey, "00:00", timeZone);
  const end = mode === "weekly" ? localCycleBounds(now, "weekly", timeZone).end : addDays(start, 1);
  const [{ data: events }, { data: entries }, { data: tokens }] = await Promise.all([
    sb.from("tracker_events").select("event_type,occurred_at").eq("user_id", userId).gte("occurred_at", start.toISOString()).lt("occurred_at", end.toISOString()),
    sb.from("journal_entries").select("word_count,created_at").eq("user_id", userId).gte("created_at", start.toISOString()).lt("created_at", end.toISOString()),
    sb.from("schedule_tokens").select("start_at,end_at").eq("user_id", userId).gte("start_at", start.toISOString()).lt("start_at", end.toISOString())
  ]);
  const done = (events ?? []).filter((e:any)=>e.event_type === "done").length;
  const fail = (events ?? []).filter((e:any)=>e.event_type === "fail").length;
  const partial = (events ?? []).filter((e:any)=>e.event_type === "partial_done").length;
  const words = (entries ?? []).reduce((a:number,e:any)=>a + Number(e.word_count || 0), 0);
  const hours = (tokens ?? []).reduce((a:number,t:any)=>a + Math.max(0, (new Date(t.end_at).getTime()-new Date(t.start_at).getTime())/3600000), 0);
  return [
    `LifeOS ${mode === "weekly" ? "weekly" : "evening"} review · ${todayKey}`,
    "",
    `Done: ${done}`,
    `Partial: ${partial}`,
    `Fail: ${fail}`,
    `Journal words: ${words}`,
    `Planned hours: ${Math.round(hours * 10) / 10}`,
    "",
    "Open LifeOS Analytics for progress maps and details."
  ].join("\n");
}

export async function buildNotificationCandidates(now = new Date()): Promise<NotificationCandidate[]> {
  const sb = createAdminSupabase();
  const candidates: NotificationCandidate[] = [];

  const { data: channels } = await sb.from("notification_channels").select("*").eq("enabled", true);
  let activeChannels = (channels ?? []).filter((c: any) => ["email", "telegram"].includes(c.channel_type) && c.target);

  if (!activeChannels.length) {
    const { data: settingsRows } = await sb.from("settings").select("user_id,notification_prefs");
    activeChannels = (settingsRows ?? []).flatMap((row: any) => {
      const prefs = row.notification_prefs || {};
      const out: any[] = [];
      if (prefs.email !== false && process.env.LIFEOS_OWNER_EMAIL) out.push({ user_id: row.user_id, channel_type: "email", target: process.env.LIFEOS_OWNER_EMAIL });
      if (prefs.telegram && process.env.TELEGRAM_CHAT_ID) out.push({ user_id: row.user_id, channel_type: "telegram", target: process.env.TELEGRAM_CHAT_ID });
      return out;
    });
  }

  for (const channel of activeChannels as any[]) {
    const userId = channel.user_id;
    const { data: settings } = await sb.from("settings").select("timezone").eq("user_id", userId).maybeSingle();
    const timeZone = settings?.timezone || "Asia/Almaty";
    const { data: rawRules } = await sb.from("notification_rules").select("*").eq("user_id", userId).eq("enabled", true);
    const rules = (rawRules ?? []) as Rule[];

    const deadlineRules = getRules(rules, "deadline_reminder").length ? getRules(rules, "deadline_reminder") : defaultRules("deadline_reminder", 60);
    const scheduleRules = getRules(rules, "schedule_reminder").length ? getRules(rules, "schedule_reminder") : defaultRules("schedule_reminder", 15);
    const cycleRules = getRules(rules, "cycle_reminder").length ? getRules(rules, "cycle_reminder") : defaultRules("cycle_reminder", 180);
    const countdownRules = getRules(rules, "countdown_reminder").length ? getRules(rules, "countdown_reminder") : defaultRules("countdown_reminder", 60);
    const dailyRules = getRules(rules, "daily_brief");
    const eveningRules = getRules(rules, "evening_review");
    const weeklyRules = getRules(rules, "weekly_review");

    if (deadlineRules.length) {
      const windowEnd = addMinutes(now, maxLead(deadlineRules, 60));
      const { data: trackers } = await sb.from("trackers").select("id,title,deadline_at,created_at,metadata").eq("user_id", userId).eq("type", "deadline").is("archived_at", null).lte("deadline_at", windowEnd.toISOString());
      for (const tracker of trackers ?? []) {
        if (!notifyOn(tracker)) continue;
        const due = new Date((tracker as any).deadline_at);
        const completed = await hasDoneEvent(sb, userId, (tracker as any).id);
        if (completed) continue;
        for (const rule of deadlineRules) {
          const lead = reminderMinutes(tracker, Number(rule.lead_minutes ?? 60));
          if (inLeadWindow(due, now, lead)) {
            candidates.push({
              user_id: userId,
              dedupe_key: `deadline:${(tracker as any).id}:${lead}:${due.toISOString().slice(0,16)}`,
              channel_type: channel.channel_type,
              target: channel.target,
              title: `LifeOS deadline: ${(tracker as any).title}`,
              body: `Deadline is coming.\n\nTracker: ${(tracker as any).title}\nDue: ${due.toLocaleString("ru-RU", { timeZone })}\nLead: ${lead} minutes`,
              source_type: "tracker",
              source_id: (tracker as any).id
            });
          } else if (due < now && due > addDays(now, -1)) {
            candidates.push({
              user_id: userId,
              dedupe_key: `deadline_missed:${(tracker as any).id}:${localDateKey(due, timeZone)}`,
              channel_type: channel.channel_type,
              target: channel.target,
              title: `LifeOS missed deadline: ${(tracker as any).title}`,
              body: `Deadline is overdue.\n\nTracker: ${(tracker as any).title}\nWas due: ${due.toLocaleString("ru-RU", { timeZone })}`,
              source_type: "tracker",
              source_id: (tracker as any).id
            });
          }
        }
      }
    }

    if (scheduleRules.length) {
      const windowEnd = addMinutes(now, maxLead(scheduleRules, 15));
      const { data: tokens } = await sb.from("schedule_tokens").select("id,title,start_at,end_at,metadata").eq("user_id", userId).gte("start_at", now.toISOString()).lte("start_at", windowEnd.toISOString());
      for (const token of tokens ?? []) {
        if (!notifyOn(token)) continue;
        const start = new Date((token as any).start_at);
        for (const rule of scheduleRules) {
          const lead = reminderMinutes(token, Number(rule.lead_minutes ?? 15));
          if (!inLeadWindow(start, now, lead)) continue;
          candidates.push({
            user_id: userId,
            dedupe_key: `schedule_token:${(token as any).id}:${lead}:${start.toISOString().slice(0,16)}`,
            channel_type: channel.channel_type,
            target: channel.target,
            title: `LifeOS schedule: ${(token as any).title}`,
            body: `Soon: ${(token as any).title}\nStarts: ${start.toLocaleString("ru-RU", { timeZone })}\nLead: ${lead} minutes`,
            source_type: "schedule_token",
            source_id: (token as any).id
          });
        }
      }

      const { data: scheduleRulesRows } = await sb.from("schedule_rules").select("*").eq("user_id", userId);
      const { data: exceptions } = await sb.from("schedule_exceptions").select("*").eq("user_id", userId);
      for (const scheduleRule of scheduleRulesRows ?? []) {
        if (!notifyOn(scheduleRule)) continue;
        const occs = scheduleRuleOccurrences(scheduleRule, exceptions ?? [], now, windowEnd, timeZone);
        for (const occ of occs) {
          for (const rule of scheduleRules) {
            const lead = reminderMinutes(scheduleRule, Number(rule.lead_minutes ?? 15));
            if (!inLeadWindow(occ.start, now, lead)) continue;
            candidates.push({
              user_id: userId,
              dedupe_key: `schedule_rule:${(scheduleRule as any).id}:${occ.dateKey}:${lead}`,
              channel_type: channel.channel_type,
              target: channel.target,
              title: `LifeOS schedule: ${(scheduleRule as any).title}`,
              body: `Soon: ${(scheduleRule as any).title}\nStarts: ${occ.start.toLocaleString("ru-RU", { timeZone })}\nLead: ${lead} minutes`,
              source_type: "schedule_rule",
              source_id: (scheduleRule as any).id
            });
          }
        }
      }
    }

    if (cycleRules.length) {
      const { data: trackers } = await sb.from("trackers").select("id,title,cycle_type,metadata").eq("user_id", userId).eq("type", "cycle").is("archived_at", null);
      for (const tracker of trackers ?? []) {
        if (!notifyOn(tracker) || !cycleActiveToday(tracker, now, timeZone)) continue;
        const bounds = localCycleBounds(now, (tracker as any).cycle_type, timeZone);
        const completed = await hasDoneEvent(sb, userId, (tracker as any).id, bounds.start, bounds.end);
        if (completed) continue;
        for (const rule of cycleRules) {
          const lead = reminderMinutes(tracker, Number(rule.lead_minutes ?? 180));
          if (!inLeadWindow(bounds.end, now, lead)) continue;
          candidates.push({
            user_id: userId,
            dedupe_key: `cycle:${(tracker as any).id}:${bounds.startKey}:${lead}`,
            channel_type: channel.channel_type,
            target: channel.target,
            title: `LifeOS cycle ending: ${(tracker as any).title}`,
            body: `Cycle is ending soon.\n\nTracker: ${(tracker as any).title}\nCycle ends: ${bounds.end.toLocaleString("ru-RU", { timeZone })}`,
            source_type: "tracker",
            source_id: (tracker as any).id
          });
        }
      }
    }

    if (countdownRules.length) {
      const { data: trackers } = await sb.from("trackers").select("id,title,countdown_days,created_at,metadata").eq("user_id", userId).eq("type", "countdown").is("archived_at", null);
      for (const tracker of trackers ?? []) {
        if (!notifyOn(tracker)) continue;
        const base = await latestDoneOrCreated(sb, userId, tracker);
        const due = addDays(base, Number((tracker as any).countdown_days || 1));
        for (const rule of countdownRules) {
          const lead = reminderMinutes(tracker, Number(rule.lead_minutes ?? 60));
          if (!inLeadWindow(due, now, lead)) continue;
          candidates.push({
            user_id: userId,
            dedupe_key: `countdown:${(tracker as any).id}:${lead}:${due.toISOString().slice(0,16)}`,
            channel_type: channel.channel_type,
            target: channel.target,
            title: `LifeOS countdown: ${(tracker as any).title}`,
            body: `Countdown is ending soon.\n\nTracker: ${(tracker as any).title}\nDue: ${due.toLocaleString("ru-RU", { timeZone })}\nLead: ${lead} minutes`,
            source_type: "tracker",
            source_id: (tracker as any).id
          });
        }
      }
    }

    for (const rule of dailyRules) {
      const timeOfDay = String(rule.time_of_day ?? "08:00").slice(0,5);
      const [hh, mm] = timeOfDay.split(":").map(Number);
      const diffMin = Math.abs(localMinutes(now, timeZone) - ((hh || 8) * 60 + (mm || 0)));
      if (diffMin <= 10) {
        candidates.push({
          user_id: userId,
          dedupe_key: `daily:${userId}:${localDateKey(now, timeZone)}:${timeOfDay}`,
          channel_type: channel.channel_type,
          target: channel.target,
          title: "LifeOS daily brief",
          body: await buildDailyBriefBody(sb, userId, now, timeZone),
          source_type: "daily_brief",
          source_id: null
        });
      }
    }


    for (const rule of eveningRules) {
      const timeOfDay = String(rule.time_of_day ?? "22:00").slice(0,5);
      const [hh, mm] = timeOfDay.split(":").map(Number);
      const diffMin = Math.abs(localMinutes(now, timeZone) - ((hh || 22) * 60 + (mm || 0)));
      if (diffMin <= 10) {
        candidates.push({
          user_id: userId,
          dedupe_key: `evening:${userId}:${localDateKey(now, timeZone)}:${timeOfDay}`,
          channel_type: channel.channel_type,
          target: channel.target,
          title: "LifeOS evening review",
          body: await buildReviewBody(sb, userId, now, timeZone, "evening"),
          source_type: "evening_review",
          source_id: null
        });
      }
    }

    for (const rule of weeklyRules) {
      const timeOfDay = String(rule.time_of_day ?? "20:00").slice(0,5);
      const [hh, mm] = timeOfDay.split(":").map(Number);
      const diffMin = Math.abs(localMinutes(now, timeZone) - ((hh || 20) * 60 + (mm || 0)));
      const dateKey = localDateKey(now, timeZone);
      const wd = weekdayMon0(dateKey, timeZone);
      const allowed = !Array.isArray(rule.weekdays) || !rule.weekdays.length || rule.weekdays.includes(wd);
      if (allowed && diffMin <= 10) {
        candidates.push({
          user_id: userId,
          dedupe_key: `weekly:${userId}:${localCycleBounds(now, "weekly", timeZone).startKey}:${timeOfDay}`,
          channel_type: channel.channel_type,
          target: channel.target,
          title: "LifeOS weekly review",
          body: await buildReviewBody(sb, userId, now, timeZone, "weekly"),
          source_type: "weekly_review",
          source_id: null
        });
      }
    }
  }

  return candidates;
}
