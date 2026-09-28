import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { AlertTriangle } from "lucide-react";
import { db } from "@/db";
import { serviceNotices, type UserRole } from "@/db/schema";

export async function ServiceNoticeBanner({ role }: { role: UserRole }) {
  const audiences =
    role === "ADMIN" ? (["ALL", "ADMIN"] as const) : (["ALL", "STUDENT"] as const);
  const notices = await db
    .select({
      id: serviceNotices.id,
      publicMessage: serviceNotices.publicMessage,
    })
    .from(serviceNotices)
    .where(
      and(
        eq(serviceNotices.isActive, true),
        inArray(serviceNotices.audience, audiences),
        or(isNull(serviceNotices.endsAt), gt(serviceNotices.endsAt, new Date())),
      ),
    )
    .orderBy(desc(serviceNotices.createdAt))
    .limit(1);

  if (!notices[0]) return null;
  return (
    <aside
      role="status"
      className="flex items-center justify-center gap-2 border-b border-warning/40 bg-warning/15 px-4 py-2 text-center text-sm"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{notices[0].publicMessage}</span>
    </aside>
  );
}
