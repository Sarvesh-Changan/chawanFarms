import { runCronJob } from "@/server/cron";
import { processExpiredCoupons } from "@/server/jobs/expire-coupons";

export const dynamic = "force-dynamic";
// auth: runCronJob verifies the CRON_SECRET bearer token before invoking the job.
export async function GET(request: Request) { return runCronJob(request, "expire-coupons", () => processExpiredCoupons()); }
