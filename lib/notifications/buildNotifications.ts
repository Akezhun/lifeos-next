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

export async function buildNotificationCandidates(now = new Date()): Promise<NotificationCandidate[]> {
  const sb = createAdminSupabase();
  const candidates: NotificationCandidate[] = [];

  const { data: channels } = await sb.from("notification_channels").select("*").eq("enabled", true);
  const emailChannels = (channels ?? []).filter((c: any) => c.channel_type === "email" && c.target);

  for (const channel of emailChannels as any[]) {
    const userId = channel.user_id;

    const { data: rules } = await sb.from("notification_rules").select("*").eq("user_id", userId).eq("enabled", true);
    const deadlineRules = (rules ?? []).filter((r: any) => r.rule_type === "deadline_reminder");
    const scheduleRules = (rules ?? []).filter((r: any) => r.rule_type === "schedule_reminder");
    const dailyRules = (rules ?? []).filter((r: any) => r.rule_type === "daily_brief");

    for (const rule of deadlineRules as any[]) {
      const lead = Number(rule.lead_minutes ?? 60);
      const windowEnd = new Date(now.getTime() + lead * 60_000);
      const { data: trackers } = await sb.from("trackers").select("id,title,deadline_at").eq("user_id", userId).is("archived_at", null).gte("deadline_at", now.toISOString()).lte("deadline_at", windowEnd.toISOString());
      for (const tracker of trackers ?? []) {
        const due = new Date((tracker as any).deadline_at);
        candidates.push({
          user_id: userId,
          dedupe_key: `deadline:${(tracker as any).id}:${lead}:${due.toISOString().slice(0,16)}`,
          channel_type: "email",
          target: channel.target,
          title: `LifeOS deadline: ${(tracker as any).title}`,
          body: `Deadline is coming in about ${lead} minutes: ${(tracker as any).title}\nDue: ${due.toLocaleString("ru-RU")}`,
          source_type: "tracker",
          source_id: (tracker as any).id
        });
      }
    }

    for (const rule of scheduleRules as any[]) {
      const lead = Number(rule.lead_minutes ?? 15);
      const windowEnd = new Date(now.getTime() + lead * 60_000);
      const { data: tokens } = await sb.from("schedule_tokens").select("id,title,start_at,end_at").eq("user_id", userId).gte("start_at", now.toISOString()).lte("start_at", windowEnd.toISOString());
      for (const token of tokens ?? []) {
        const start = new Date((token as any).start_at);
        candidates.push({
          user_id: userId,
          dedupe_key: `schedule:${(token as any).id}:${lead}:${start.toISOString().slice(0,16)}`,
          channel_type: "email",
          target: channel.target,
          title: `LifeOS schedule: ${(token as any).title}`,
          body: `Soon: ${(token as any).title}\nStarts: ${start.toLocaleString("ru-RU")}`,
          source_type: "schedule_token",
          source_id: (token as any).id
        });
      }
    }

    for (const rule of dailyRules as any[]) {
      const timeOfDay = String(rule.time_of_day ?? "08:00");
      const [hh, mm] = timeOfDay.split(":").map(Number);
      const target = new Date(now); target.setHours(hh || 8, mm || 0, 0, 0);
      const diffMin = Math.abs(now.getTime() - target.getTime()) / 60_000;
      if (diffMin <= 10) {
        candidates.push({
          user_id: userId,
          dedupe_key: `daily:${userId}:${now.toISOString().slice(0,10)}:${timeOfDay}`,
          channel_type: "email",
          target: channel.target,
          title: "LifeOS daily brief",
          body: "Open LifeOS today and check Trackers, Schedule, and Analytics.",
          source_type: "daily_brief",
          source_id: null
        });
      }
    }
  }

  return candidates;
}
