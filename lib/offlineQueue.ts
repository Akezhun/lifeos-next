export type OfflineQueueKind = "tracker" | "tracker_event" | "journal_note" | "schedule_token";

export type OfflineQueueItem = {
  id: string;
  kind: OfflineQueueKind;
  createdAt: string;
  payload: Record<string, any>;
  attempts?: number;
  lastError?: string;
  syncedAt?: string;
};

const KEY_PREFIX = "lifeos.offlineQueue.";
const DRAFT_PREFIX = "lifeos.journalDraft.";

function key(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

export function getOfflineQueue(userId: string): OfflineQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setOfflineQueue(userId: string, items: OfflineQueueItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(userId), JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("lifeos-offline-queue-changed"));
}

export function enqueueOfflineItem(userId: string, item: Omit<OfflineQueueItem, "id" | "createdAt">) {
  const next: OfflineQueueItem = {
    ...item,
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    createdAt: new Date().toISOString(),
    attempts: 0
  };
  const items = getOfflineQueue(userId);
  setOfflineQueue(userId, [next, ...items].slice(0, 500));
  return next;
}

export function updateOfflineItem(userId: string, itemId: string, patch: Partial<OfflineQueueItem>) {
  setOfflineQueue(userId, getOfflineQueue(userId).map((item) => item.id === itemId ? { ...item, ...patch } : item));
}

export function removeOfflineItem(userId: string, itemId: string) {
  setOfflineQueue(userId, getOfflineQueue(userId).filter((item) => item.id !== itemId));
}

export function clearOfflineQueue(userId: string) {
  setOfflineQueue(userId, []);
}

export function exportOfflineQueue(userId: string) {
  return JSON.stringify({ version: "V14", exported_at: new Date().toISOString(), queue: getOfflineQueue(userId) }, null, 2);
}

export function getJournalDraft(userId: string, keyName = "default") {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${DRAFT_PREFIX}${userId}.${keyName}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveJournalDraft(userId: string, keyName: string, draft: any) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${DRAFT_PREFIX}${userId}.${keyName}`, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
  window.dispatchEvent(new CustomEvent("lifeos-offline-queue-changed"));
}

export function removeJournalDraft(userId: string, keyName = "default") {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${DRAFT_PREFIX}${userId}.${keyName}`);
}

export function listJournalDraftKeys(userId: string) {
  if (typeof window === "undefined") return [];
  const prefix = `${DRAFT_PREFIX}${userId}.`;
  return Object.keys(window.localStorage).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
}
