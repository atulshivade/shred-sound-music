import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getActiveChallenges } from "@/lib/queries";
import { isChallengeOpen } from "@/lib/gamification";
import { ServiceNoticeBanner } from "@/components/service-notice-banner";
import { BottomNav } from "@/components/student/bottom-nav";
import { UploadSheetProvider } from "@/components/student/upload-sheet";

/**
 * Student app shell: dark, phone-first, a single centred column with the
 * emoji tab bar and the floating upload button on every screen.
 */
export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();
  const [active, [profile]] = await Promise.all([
    getActiveChallenges(),
    db
      .select({ instrument: users.primaryInstrument, skillLevel: users.skillLevel })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1),
  ]);
  const open = active
    .filter((c) => isChallengeOpen(c))
    .map((c) => ({ id: c.id, title: c.title }));

  return (
    <div className="student-app min-h-dvh">
      <ServiceNoticeBanner role={user.role} />
      <UploadSheetProvider
        challenges={open}
        defaultInstrument={profile?.instrument ?? null}
        skillLevel={profile?.skillLevel ?? null}
      >
        <main className="mx-auto w-full max-w-lg pb-[calc(7rem+env(safe-area-inset-bottom))]">
          {children}
        </main>
        <BottomNav />
      </UploadSheetProvider>
    </div>
  );
}
