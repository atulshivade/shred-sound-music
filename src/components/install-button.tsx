"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * One-tap install where the browser supports it (Chrome and Edge on
 * Android). Safari on iPhone never fires `beforeinstallprompt`, so the
 * button stays hidden there and the written steps take over.
 */
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return <p className="text-center font-bold text-lime-400">✅ Installed! Find Shred Sound on your home screen.</p>;
  }
  if (!prompt) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === "accepted") setInstalled(true);
        setPrompt(null);
      }}
      className="grad-fab w-full rounded-2xl py-4 text-lg font-black text-white shadow-lg shadow-rose-900/40"
    >
      📲 Install the app
    </button>
  );
}
