import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { challenges } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import {
  createChallengeSchema,
  INSTRUMENT_VALUES,
  SKILL_LEVEL_VALUES,
} from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatInstrument, formatSkillLevel } from "@/lib/utils";

export default async function NewChallengePage() {
  await requireAdmin();

  async function createChallenge(formData: FormData) {
    "use server";
    const session = await requireAdmin();

    const parsed = createChallengeSchema.safeParse({
      title: formData.get("title"),
      description: formData.get("description"),
      deadline: formData.get("deadline"),
      points: formData.get("points"),
      coverImageUrl: formData.get("coverImageUrl") || undefined,
      instrumentFocus: formData.get("instrumentFocus") || undefined,
      skillLevelTarget: formData.get("skillLevelTarget") || undefined,
    });

    if (!parsed.success) {
      throw new Error(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      );
    }

    await db.insert(challenges).values({
      title: parsed.data.title,
      description: parsed.data.description,
      deadline: parsed.data.deadline,
      points: parsed.data.points,
      coverImageUrl: parsed.data.coverImageUrl || null,
      instrumentFocus: parsed.data.instrumentFocus ?? null,
      skillLevelTarget: parsed.data.skillLevelTarget ?? null,
      createdById: session.user.id,
      status: "ACTIVE",
    });

    revalidatePath("/admin");
    revalidatePath("/challenges");
    redirect("/admin");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Create a new challenge</CardTitle>
          <CardDescription>
            Define the brief: what to play, who it&apos;s for, and when it&apos;s due.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createChallenge} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                required
                placeholder={`e.g. "Cover the riff in Sweet Child O' Mine"`}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Brief</Label>
              <Textarea
                id="description"
                name="description"
                required
                rows={6}
                placeholder="What should students play? Tempo? Section? Evaluation criteria?"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline</Label>
                <Input id="deadline" name="deadline" type="datetime-local" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  name="points"
                  type="number"
                  min={1}
                  defaultValue={100}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="instrumentFocus">Instrument focus (optional)</Label>
                <select
                  id="instrumentFocus"
                  name="instrumentFocus"
                  defaultValue=""
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Any instrument</option>
                  {INSTRUMENT_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {formatInstrument(v)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="skillLevelTarget">Skill target (optional)</Label>
                <select
                  id="skillLevelTarget"
                  name="skillLevelTarget"
                  defaultValue=""
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Any level</option>
                  {SKILL_LEVEL_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {formatSkillLevel(v)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="coverImageUrl">Cover image URL (optional)</Label>
              <Input
                id="coverImageUrl"
                name="coverImageUrl"
                type="url"
                placeholder="https://…"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit">Publish challenge</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
