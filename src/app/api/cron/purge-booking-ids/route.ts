import { runCronJob } from "@/server/cron";
import { purgeBookingGuestIds } from "@/server/jobs/booking-id-purge";

export const dynamic = "force-dynamic";

// auth: runCronJob verifies the CRON_SECRET bearer token before invoking the job.
export async function GET(request: Request) {
  return runCronJob(request, "purge-booking-ids", purgeBookingGuestIds);
}

