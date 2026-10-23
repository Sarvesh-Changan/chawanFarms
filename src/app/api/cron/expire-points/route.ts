import { runCronJob } from "@/server/cron";
import { processExpiredPointsLots } from "@/server/jobs/expire-points";

export const dynamic = "force-dynamic";
// auth: runCronJob verifies the CRON_SECRET bearer token before invoking the job.
export async function GET(request: Request) { return runCronJob(request, "expire-points", () => processExpiredPointsLots()); }
