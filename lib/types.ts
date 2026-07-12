export type Priority = "low" | "mid" | "high";
export type TrackerType = "deadline" | "cycle" | "countdown" | "gray";

export type Tracker = {
  id: string;
  user_id: string;
  legacy_id: string | null;
  title: string;
  type: TrackerType;
  priority: Priority;
  status: string;
  deadline_at: string | null;
  cycle_type: string | null;
  countdown_days: number | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type Journal = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  created_at: string;
};

export type JournalEntry = {
  id: string;
  user_id: string;
  journal_id: string;
  title: string;
  entry_type: string;
  status: string;
  body: string | null;
  mood: number | null;
  energy: number | null;
  word_count: number;
  created_at: string;
  updated_at: string;
};

export type ScheduleToken = {
  id: string;
  user_id: string;
  title: string;
  source_type: "free" | "tracker" | "journal" | "hybrid";
  linked_tracker_id: string | null;
  linked_journal_entry_id: string | null;
  start_at: string;
  end_at: string;
  recurrence_kind: "one_time" | "recurring" | "permanent";
  created_at: string;
};

export type Tag = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
};
