/**
 * Where the server code runs relative to the database.
 *
 * On a serverless host every query is a network call, so a function that
 * lives on a different continent from its database pays that distance on
 * every single round trip. It is by far the easiest performance problem to
 * create (the platform default region rarely matches where the database was
 * provisioned) and the easiest to miss, because nothing errors — the app is
 * simply slow. The Test Agent surfaces it as a first-class check.
 */

/** Vercel region code → the cloud region it is hosted in. */
const VERCEL_REGION_TO_CLOUD: Record<string, string> = {
  arn1: "eu-north-1",
  bom1: "ap-south-1",
  cdg1: "eu-west-3",
  cle1: "us-east-2",
  cpt1: "af-south-1",
  dub1: "eu-west-1",
  fra1: "eu-central-1",
  gru1: "sa-east-1",
  hkg1: "ap-east-1",
  hnd1: "ap-northeast-1",
  iad1: "us-east-1",
  icn1: "ap-northeast-2",
  kix1: "ap-northeast-3",
  lhr1: "eu-west-2",
  pdx1: "us-west-2",
  sfo1: "us-west-1",
  sin1: "ap-southeast-1",
  syd1: "ap-southeast-2",
};

/** Matches a cloud region token such as `eu-central-1` or `ap-south-2`. */
const CLOUD_REGION_PATTERN = /\b([a-z]{2}(?:-[a-z]+)+-\d)\b/;

export type RuntimePlacement = {
  /** Platform region code the function runs in, when the host exposes one. */
  functionRegion?: string;
  /** Cloud region the function runs in, derived from `functionRegion`. */
  functionCloudRegion?: string;
  /** Cloud region parsed out of the database hostname, when recognisable. */
  databaseCloudRegion?: string;
  /**
   * True only when both regions are known *and* differ — an unknown region
   * is never reported as a mismatch, so unfamiliar hosts stay silent rather
   * than raising a false alarm.
   */
  isCrossRegion: boolean;
};

/** The only two variables placement detection reads. */
export type PlacementEnv = {
  VERCEL_REGION?: string;
  DATABASE_URL?: string;
  // Keeps `process.env` assignable: without an index signature TypeScript
  // treats an all-optional type as a weak type and rejects it.
  [key: string]: string | undefined;
};

export function getRuntimePlacement(
  env: PlacementEnv = process.env,
): RuntimePlacement {
  const functionRegion = env.VERCEL_REGION || undefined;
  const functionCloudRegion = functionRegion
    ? VERCEL_REGION_TO_CLOUD[functionRegion]
    : undefined;

  let databaseCloudRegion: string | undefined;
  try {
    const host = new URL(env.DATABASE_URL ?? "").hostname;
    databaseCloudRegion = CLOUD_REGION_PATTERN.exec(host)?.[1];
  } catch {
    databaseCloudRegion = undefined;
  }

  return {
    functionRegion,
    functionCloudRegion,
    databaseCloudRegion,
    isCrossRegion: Boolean(
      functionCloudRegion &&
        databaseCloudRegion &&
        functionCloudRegion !== databaseCloudRegion,
    ),
  };
}

/** Human-readable placement summary for the admin-only diagnostics panel. */
export function describePlacement(placement: RuntimePlacement): string {
  const fn = placement.functionRegion
    ? `${placement.functionRegion}${placement.functionCloudRegion ? ` (${placement.functionCloudRegion})` : ""}`
    : "unknown";
  const database = placement.databaseCloudRegion ?? "unknown";
  return `Server region: ${fn}. Database region: ${database}.`;
}

/** The Vercel region code to deploy into so the functions sit beside the DB. */
export function suggestedFunctionRegion(
  placement: RuntimePlacement,
): string | undefined {
  if (!placement.databaseCloudRegion) return undefined;
  return Object.entries(VERCEL_REGION_TO_CLOUD).find(
    ([, cloudRegion]) => cloudRegion === placement.databaseCloudRegion,
  )?.[0];
}
