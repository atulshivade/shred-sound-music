import type { Metadata } from "next";
import Link from "next/link";
import { InstallButton } from "@/components/install-button";

export const metadata: Metadata = {
  title: "Install Shred Sound Music",
  description: "Add Shred Sound Music to your iPhone or Android home screen in under a minute.",
};

const IPHONE_STEPS = [
  <>Open this page in <b>Safari</b>. If you tapped the link inside WhatsApp or Mail, tap <b>⋯</b> or the compass icon and choose <b>Open in Safari</b>.</>,
  <>Tap the <b>Share</b> button <span aria-hidden>(⬆️)</span> at the bottom of the screen.</>,
  <>Scroll down and tap <b>Add to Home Screen</b>.</>,
  <>Tap <b>Add</b>. The ⚡ Shred Sound icon appears on your home screen.</>,
];

const ANDROID_STEPS = [
  <>Open this page in <b>Chrome</b>.</>,
  <>Tap <b>Install the app</b> above, or open the <b>⋮</b> menu and tap <b>Install app</b> (or <b>Add to Home screen</b>).</>,
  <>Confirm with <b>Install</b>. The app opens full screen from your home screen.</>,
];

function Steps({ title, emoji, steps }: { title: string; emoji: string; steps: React.ReactNode[] }) {
  return (
    <section className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
      <h2 className="mb-4 text-xl font-black">
        <span aria-hidden>{emoji}</span> {title}
      </h2>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-snug text-white/85">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-600 text-sm font-black text-white">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function InstallPage() {
  return (
    <div className="student-app min-h-dvh">
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-5 pb-12 pt-10">
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt=""
            width={96}
            height={96}
            className="mb-4 rounded-[28px] shadow-xl shadow-orange-900/40"
          />
          <h1 className="text-3xl font-black">Get the Shred Sound app</h1>
          <p className="mt-2 text-white/70">
            Free, no app store needed. Installs in under a minute on iPhone and Android.
          </p>
        </div>

        <InstallButton />

        <Steps title="iPhone or iPad" emoji="🍎" steps={IPHONE_STEPS} />
        <Steps title="Android" emoji="🤖" steps={ANDROID_STEPS} />

        <Link
          href="/feed"
          className="rounded-2xl bg-white/10 py-4 text-center font-bold text-white ring-1 ring-white/15"
        >
          Continue in the browser →
        </Link>
      </main>
    </div>
  );
}
