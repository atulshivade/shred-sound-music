import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStorage, classifySubmissionType } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — enough for short videos and images
const ALLOWED_PREFIXES = ["image/", "video/"];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File exceeds ${MAX_BYTES / (1024 * 1024)} MB limit` },
      { status: 413 },
    );
  }

  if (!ALLOWED_PREFIXES.some((p) => file.type.startsWith(p))) {
    return NextResponse.json(
      { error: `Unsupported content-type: ${file.type}` },
      { status: 415 },
    );
  }

  try {
    const stored = await getStorage().upload({
      file,
      filename: file.name,
      contentType: file.type,
      scope: "submissions",
    });

    return NextResponse.json({
      url: stored.url,
      type: classifySubmissionType(file.type),
      contentType: stored.contentType,
      size: stored.size,
    });
  } catch (err) {
    console.error("[upload] failed", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  }
}
