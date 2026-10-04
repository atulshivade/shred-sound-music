import { cn, getInitials } from "@/lib/utils";
import { gradientFor } from "@/components/student/visuals";

/** Initials on a colourful disc; student photos are never shown to other students. */
export function StudentAvatar({
  id,
  name,
  size = "md",
  ring = false,
}: {
  id: string;
  name: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  ring?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-black text-white",
        gradientFor(id),
        size === "sm" && "h-8 w-8 text-xs",
        size === "md" && "h-10 w-10 text-sm",
        size === "lg" && "h-14 w-14 text-lg",
        size === "xl" && "h-20 w-20 text-2xl",
        ring && "ring-4 ring-white/70 ring-offset-2 ring-offset-transparent",
      )}
    >
      {getInitials(name ?? "?")}
    </span>
  );
}
