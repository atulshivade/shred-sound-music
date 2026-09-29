import { AlertTriangle } from "lucide-react";
import { type UserRole } from "@/db/schema";
import { getActiveServiceNotice } from "@/lib/queries";

export async function ServiceNoticeBanner({ role }: { role: UserRole }) {
  const notice = await getActiveServiceNotice(role);
  if (!notice) return null;
  return (
    <aside
      role="status"
      className="flex items-center justify-center gap-2 border-b border-warning/40 bg-warning/15 px-4 py-2 text-center text-sm"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{notice.publicMessage}</span>
    </aside>
  );
}
