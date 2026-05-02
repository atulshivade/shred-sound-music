/**
 * Seed script — creates a demo teacher, a couple of music students, sample
 * music challenges, and a few sample performances so the feed is non-empty
 * out of the box.
 *
 * Run with:  npm run db:seed
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, dbKind } from "../src/db";
import { applyMigrations } from "../src/db/migrate";
import { users, challenges, performances } from "../src/db/schema";
import type { Instrument, SkillLevel } from "../src/db/schema";

const DEMO_PASSWORD = "Password123";

async function upsertUser(args: {
  name: string;
  email: string;
  role: "ADMIN" | "STUDENT";
  primaryInstrument?: Instrument;
  skillLevel?: SkillLevel;
}) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, args.email))
    .limit(1);
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const [created] = await db
    .insert(users)
    .values({
      name: args.name,
      email: args.email,
      role: args.role,
      passwordHash,
      primaryInstrument: args.primaryInstrument ?? null,
      skillLevel: args.skillLevel ?? null,
    })
    .returning();
  return created!;
}

async function main() {
  console.log(`→ Database backend: ${dbKind}`);
  console.log("→ Applying migrations…");
  await applyMigrations();

  console.log("→ Seeding demo users…");
  const teacher = await upsertUser({
    name: "Ms. Maya Rao",
    email: "admin@portal.dev",
    role: "ADMIN",
  });
  const alex = await upsertUser({
    name: "Alex Singh",
    email: "alex@portal.dev",
    role: "STUDENT",
    primaryInstrument: "ACOUSTIC_GUITAR",
    skillLevel: "INTERMEDIATE",
  });
  const riya = await upsertUser({
    name: "Riya Patel",
    email: "riya@portal.dev",
    role: "STUDENT",
    primaryInstrument: "PIANO",
    skillLevel: "ADVANCED",
  });

  console.log("→ Seeding sample challenges…");
  const existing = await db.select({ id: challenges.id }).from(challenges);
  if (existing.length === 0) {
    const inserted = await db
      .insert(challenges)
      .values([
        {
          title: "Cover the riff: Sweet Child O' Mine (intro)",
          description:
            "Play the iconic opening riff. Focus on alternate picking and let each note ring. 30–60 seconds is enough.",
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          points: 200,
          instrumentFocus: "ELECTRIC_GUITAR",
          skillLevelTarget: "INTERMEDIATE",
          createdById: teacher.id,
          status: "ACTIVE",
        },
        {
          title: "Chopin Prelude in E minor — first 16 bars",
          description:
            "Bring out the melodic line over the descending chords. Watch the dynamics. 60–90 seconds.",
          deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          points: 250,
          instrumentFocus: "PIANO",
          skillLevelTarget: "ADVANCED",
          createdById: teacher.id,
          status: "ACTIVE",
        },
        {
          title: "Synth pad + lead — original 30-second loop",
          description:
            "Build a 30-second loop with one pad and one lead. Any synth, any DAW. Show your patch and play live on top.",
          deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          points: 150,
          instrumentFocus: "SYNTHESIZER",
          skillLevelTarget: "BEGINNER",
          createdById: teacher.id,
          status: "ACTIVE",
        },
      ])
      .returning();

    // A handful of sample performances so the feed isn't empty. We use
    // EMBED links to public Vimeo trailers / royalty-free demos so the seed
    // works without an actual video upload.
    const guitarChallenge = inserted[0]!;
    const pianoChallenge = inserted[1]!;
    await db.insert(performances).values([
      {
        challengeId: guitarChallenge.id,
        studentId: alex.id,
        title: "First take — opening riff",
        caption: "A bit nervous on the bend, would love feedback.",
        instrument: "ELECTRIC_GUITAR",
        skillLevel: "INTERMEDIATE",
        videoProvider: "EMBED",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        status: "PUBLISHED",
      },
      {
        challengeId: pianoChallenge.id,
        studentId: riya.id,
        title: "Chopin — slow tempo",
        caption: "Working the dynamics. Take 3.",
        instrument: "PIANO",
        skillLevel: "ADVANCED",
        videoProvider: "EMBED",
        videoUrl: "https://player.vimeo.com/video/76979871",
        status: "PUBLISHED",
        isVerified: true,
        isBestPerformer: true, // featured on the Best Performer spotlight
      },
    ]);
  }

  console.log("\nDone.");
  console.log(`Login as teacher  → admin@portal.dev / ${DEMO_PASSWORD}`);
  console.log(`Login as student  → alex@portal.dev  / ${DEMO_PASSWORD}`);
  console.log(`Login as student  → riya@portal.dev  / ${DEMO_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
