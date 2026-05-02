import Link from "next/link";
import {
  AudioLines,
  Music2,
  BadgeCheck,
  Crown,
  ArrowRight,
  Headphones,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";

export default async function LandingPage() {
  const session = await auth();
  const ctaHref = session?.user
    ? session.user.role === "ADMIN"
      ? "/admin"
      : "/challenges"
    : "/sign-in";

  return (
    <div className="surface-gradient min-h-screen">
      {/* Top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/30">
            <AudioLines className="h-5 w-5" />
          </span>
          <span className="text-lg tracking-tight">Encore</span>
        </Link>
        <nav className="flex items-center gap-2">
          {session?.user ? (
            <Button asChild>
              <Link href={ctaHref}>
                Open studio <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-up">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-12 text-center">
        <Badge variant="accent" className="mb-5">
          <Music2 className="mr-1 h-3 w-3" />
          New season just dropped
        </Badge>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          Play it.{" "}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Post it. Get heard.
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          A music performance portal where teachers post challenges, students
          upload their best takes, and the community discovers what&apos;s next.
          Timestamped feedback. Verified badges. Best Performer crown.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href={ctaHref}>
              {session?.user ? "Continue" : "Join the stage"}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/feed">Browse performances</Link>
          </Button>
        </div>

        {/* Decorative equalizer */}
        <div className="mx-auto mt-10 flex h-16 max-w-md items-end justify-center gap-1.5">
          {[0.4, 0.7, 1, 0.55, 0.85, 0.35, 0.95, 0.6, 0.45, 0.75, 1, 0.5].map((h, i) => (
            <span
              key={i}
              className="eq-bar inline-block w-2 rounded-t bg-gradient-to-t from-primary to-accent"
              style={{
                height: `${h * 100}%`,
                animationDelay: `${i * 80}ms`,
              }}
            />
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 sm:grid-cols-3">
        <FeatureCard
          icon={<Music2 className="h-5 w-5" />}
          title="Tagged performances"
          desc="Upload short videos, tag your instrument and skill level. Teachers and peers can filter to exactly what they want to hear."
        />
        <FeatureCard
          icon={<BadgeCheck className="h-5 w-5" />}
          title="Timestamped feedback"
          desc="Teachers leave notes pinned to specific moments — rhythm, technique, musicality, scored 0–10."
        />
        <FeatureCard
          icon={<Crown className="h-5 w-5" />}
          title="Best Performer crown"
          desc="Curated picks per challenge with audit trail, plus a public spotlight on the feed."
        />
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Headphones className="h-4 w-4" />© {new Date().getFullYear()} Encore
          </span>
          <span className="flex items-center gap-1">
            Built with <Zap className="h-3 w-3 text-accent" /> Next.js · Drizzle · shadcn/ui · Bunny.net
          </span>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border bg-card/60 p-6 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/10">
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 text-primary">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
