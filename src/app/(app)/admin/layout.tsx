import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { ServiceNoticeBanner } from "@/components/service-notice-banner";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defence in depth — middleware also blocks, but server components must
  // never trust the URL alone.
  const session = await auth();
  if (!session?.user) redirect("/sign-in?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/feed");
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <ServiceNoticeBanner role={session.user.role} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
