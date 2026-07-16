"use client";

import { useEffect, useState } from "react";
import { Download, Wifi, WifiOff } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [online, setOnline] = useState(true);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    setInstalled(window.matchMedia?.("(display-mode: standalone)")?.matches || (navigator as any).standalone === true);
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallEvent);
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => null);
    setDeferred(null);
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`life-badge ${online ? "" : "border-amber-300/30 text-amber-100"}`}>{online ? <Wifi size={14}/> : <WifiOff size={14}/>} {online ? "Online" : "Offline"}</span>
      {!installed && deferred && <button onClick={install} className="life-button secondary mobile-install"><Download size={15} className="inline"/> Install</button>}
    </div>
  );
}
