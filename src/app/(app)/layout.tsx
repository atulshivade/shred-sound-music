import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Authenticated area. Anonymous visitors are bounced to /sign-in. The two
 * audiences get deliberately different shells: the dark, phone-style student
 * app lives in `(student)/layout.tsx`, the teacher studio in
 * `admin/layout.tsx`.
 */
export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in?callbackUrl=/feed");
  }
  return <>{children}</>;
}
