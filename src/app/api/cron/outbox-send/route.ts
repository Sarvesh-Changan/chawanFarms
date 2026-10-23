import { runCronJob } from "@/server/cron";
import { processNotificationOutbox } from "@/server/services/notification-outbox";

export const dynamic = "force-dynamic";
// auth: runCronJob verifies the CRON_SECRET bearer token before invoking the job.
export async function GET(request: Request) { return runCronJob(request, "outbox-send", () => processNotificationOutbox()); }
