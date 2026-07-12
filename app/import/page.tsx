"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { importJournals, importSchedule, importTasks } from "@/lib/lifeos/importOldData";

export default function ImportPage() {
  return (
    <AppShell title="Import" subtitle="Перенос из LifeOS Classic: tasks.json, journals.json, schedule.json → Supabase Postgres.">
      <AuthGate>{(user) => <ImportTool userId={user.id} />}</AuthGate>
    </AppShell>
  );
}

function ImportTool({ userId }: { userId: string }) {
  const sb = useMemo(() => createBrowserSupabase(), []);
  const [tasks, setTasks] = useState("");
  const [journals, setJournals] = useState("");
  const [schedule, setSchedule] = useState("");
  const [message, setMessage] = useState("");

  async function loadFile(file: File, setter: (value: string) => void) {
    setter(await file.text());
  }

  async function runImport() {
    setMessage("Importing...");
    try {
      const taskCount = tasks.trim() ? await importTasks(sb, userId, JSON.parse(tasks)) : 0;
      const journalCount = journals.trim() ? await importJournals(sb, userId, JSON.parse(journals)) : 0;
      const scheduleCount = schedule.trim() ? await importSchedule(sb, userId, JSON.parse(schedule)) : 0;
      setMessage(`Imported: ${taskCount} trackers, ${journalCount} journals, ${scheduleCount} schedule tokens.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed");
    }
  }

  return (
    <div className="space-y-5">
      <div className="life-card p-5">
        <h2 className="text-xl font-black">Upload old JSON files</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="block rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-white/60">tasks.json<input className="mt-3 block w-full" type="file" accept=".json" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0], setTasks)} /></label>
          <label className="block rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-white/60">journals.json<input className="mt-3 block w-full" type="file" accept=".json" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0], setJournals)} /></label>
          <label className="block rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-white/60">schedule.json<input className="mt-3 block w-full" type="file" accept=".json" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0], setSchedule)} /></label>
        </div>
        <button className="life-button mt-5" onClick={runImport}>Run import</button>
        {message && <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/65">{message}</div>}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <textarea className="life-input min-h-80 font-mono text-xs" value={tasks} onChange={(e) => setTasks(e.target.value)} placeholder="Paste tasks.json here" />
        <textarea className="life-input min-h-80 font-mono text-xs" value={journals} onChange={(e) => setJournals(e.target.value)} placeholder="Paste journals.json here" />
        <textarea className="life-input min-h-80 font-mono text-xs" value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="Paste schedule.json here" />
      </div>
    </div>
  );
}
