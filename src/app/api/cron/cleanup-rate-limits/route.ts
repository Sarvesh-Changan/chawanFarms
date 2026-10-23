import { runCronJob } from "@/server/cron";
import { cleanupExpiredRateLimits } from "@/server/jobs/notification-jobs";

export const dynamic = "force-dynamic";
// auth: runCronJob verifies the CRON_SECRET bearer token before invoking the job.
export async function GET(request: Request) { return runCronJob(request, "cleanup-rate-limits", cleanupExpiredRateLimits); }
