import Link from "next/link";
import {
  BookOpen,
  CircleCheckBig,
  ClipboardList,
  Music,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const modules = [
  {
    title: "Practice tasks",
    description: "Build consistency with short daily instrument exercises.",
    icon: CircleCheckBig,
  },
  {
    title: "Lesson videos",
    description: "Watch teacher-approved technique and song walkthroughs.",
    icon: PlayCircle,
  },
  {
    title: "My songs",
    description: "Track the songs you are learning and ready to perform.",
    icon: Music,
  },
  {
    title: "Quick quizzes",
    description: "Test music knowledge and earn XP with instant feedback.",
    icon: ClipboardList,
  },
] as const;

export default function LearnPage() {
  return (
    <>
      <section className="band band-cream">
        <div className="band-inner text-center">
          <span className="section-eyebrow">
            <Sparkles className="h-3 w-3" /> Learn and level up
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
            Your learning space
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
            Homework, songs, lessons and practice goals—all matched to your
            instrument and level.
          </p>
        </div>
      </section>
      <section className="band band-white pt-6">
        <div className="band-inner-wide">
          <div className="grid gap-4 sm:grid-cols-2">
            {modules.map(({ title, description, icon: Icon }) => (
              <Card key={title} className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" /> {title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-dashed bg-secondary/40 p-6 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 font-medium">Your teacher is preparing learning content.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep your streak alive by joining an active challenge.
            </p>
            <Button asChild className="mt-4">
              <Link href="/challenges">View challenges</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
