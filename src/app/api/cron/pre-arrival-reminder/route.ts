import { runCronJob } from "@/server/cron";
import { processPreArrivalReminders } from "@/server/jobs/notification-jobs";

export const dynamic = "force-dynamic";
// auth: runCronJob verifies the CRON_SECRET bearer token before invoking the job.
export async function GET(request: Request) { return runCronJob(request, "pre-arrival-reminder", () => processPreArrivalReminders()); }
