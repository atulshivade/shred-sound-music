import { desc, eq } from "drizzle-orm";
import { Award, Flame, Music2, Trophy } from "lucide-react";
import { db } from "@/db";
import { performances, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatInstrument, formatSkillLevel } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getInitials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireUser();
  const [[profile], submissions] = await Promise.all([
    db.select().from(users).where(eq(users.id, session.user.id)).limit(1),
    db
      .select()
      .from(performances)
      .where(eq(performances.studentId, session.user.id))
      .orderBy(desc(performances.submittedAt)),
  ]);

  if (!profile) return null;
  const approved = submissions.filter((item) => item.status === "PUBLISHED").length;
  const pending = submissions.filter((item) => item.status === "PENDING").length;

  return (
    <>
      <section className="band band-cream">
        <div className="band-inner text-center">
          <Avatar className="mx-auto h-24 w-24 border-4 border-card shadow-lg">
            {profile.image && <AvatarImage src={profile.image} alt={profile.name ?? ""} />}
            <AvatarFallback className="text-2xl">{getInitials(profile.name)}</AvatarFallback>
          </Avatar>
          <h1 className="mt-4 text-3xl font-semibold">{profile.name ?? "Musician"}</h1>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {profile.primaryInstrument && (
              <Badge variant="outline">{formatInstrument(profile.primaryInstrument)}</Badge>
            )}
            {profile.skillLevel && (
              <Badge variant="secondary">{formatSkillLevel(profile.skillLevel)}</Badge>
            )}
          </div>
          {profile.bio && <p className="mx-auto mt-4 max-w-md text-sm">{profile.bio}</p>}
        </div>
      </section>
      <section className="band band-white pt-6">
        <div className="band-inner-wide">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={Trophy} label="XP" value={profile.points} />
            <Stat icon={Flame} label="Streak" value="Coming soon" />
            <Stat icon={Award} label="Approved" value={approved} />
            <Stat icon={Music2} label="Pending" value={pending} />
          </div>
          <Card className="mt-6 rounded-2xl">
            <CardContent className="p-6">
              <h2 className="font-semibold">Your progress</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {submissions.length} total performances · {approved} shared with
                the community · {pending} awaiting teacher review.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: number | string;
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 text-center">
        <Icon className="mx-auto h-5 w-5 text-primary" />
        <div className="mt-2 text-lg font-semibold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
