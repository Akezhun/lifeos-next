"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudOff, Loader2, RefreshCw } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { getOfflineQueue } from "@/lib/offlineQueue";
import { syncOfflineQueue } from "@/lib/offlineSync";

export function OfflineSyncStatus() {
  const [online, setOnline] = useState(true);
  const [count, setCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    refresh();
    const refreshAll = () => { setOnline(navigator.onLine); refresh(); };
    const onOnline = () => { refreshAll(); void syncNow(true); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", refreshAll);
    window.addEventListener("lifeos-offline-queue-changed", refresh);
    const timer = window.setInterval(refresh, 8000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", refreshAll);
      window.removeEventListener("lifeos-offline-queue-changed", refresh);
      window.clearInterval(timer);
    };
  }, []);

  async function getUserId() {
    const sb = createBrowserSupabase();
    const { data } = await sb.auth.getSession();
    return { sb, userId: data.session?.user?.id || null };
  }

  async function refresh() {
    try {
      const { userId } = await getUserId();
      if (!userId) return setCount(0);
      setCount(getOfflineQueue(userId).length);
    } catch {}
  }

  async function syncNow(silent = false) {
    if (syncing) return;
    setSyncing(true);
    try {
      const { sb, userId } = await getUserId();
      if (!userId) return;
      const res = await syncOfflineQueue(sb, userId);
      setMessage(res.offline ? "Offline" : res.synced ? `Synced ${res.synced}` : "Up to date");
      await refresh();
      if (!silent) window.setTimeout(() => setMessage(""), 2500);
    } catch {
      setMessage("Sync retry later");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button className={`offline-status ${online ? "online" : "offline"} ${count > 0 ? "pending" : ""}`} onClick={() => syncNow(false)} title="Offline & Sync">
      {syncing ? <Loader2 size={15} className="animate-spin"/> : online ? <Cloud size={15}/> : <CloudOff size={15}/>}<span>{online ? (count ? `${count} pending` : "Synced") : `${count} offline`}</span>{message && <em>{message}</em>}<RefreshCw size={13}/>
    </button>
  );
}
