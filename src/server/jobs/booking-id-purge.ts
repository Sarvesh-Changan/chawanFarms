import "server-only";

import {
  ID_RETENTION_DAYS_AFTER_CHECKOUT,
  ID_RETENTION_DAYS_AFTER_CANCEL_OR_REJECT,
} from "@/config/booking-id";
import { db } from "@/server/db";
import { deleteCloudinaryAsset } from "@/server/integrations/cloudinary";
import { audit } from "@/server/services/audit";

export type PurgeBookingGuestIdsResult = {
  examined: number;
  purged: number;
  errors: number;
};

/**
 * Automatically purges identity documents for completed, cancelled or rejected bookings
 * past their retention window.
 * - Completed stays: purged after ID_RETENTION_DAYS_AFTER_CHECKOUT (default 30 days) past check-out.
 * - Cancelled or Rejected bookings: purged after ID_RETENTION_DAYS_AFTER_CANCEL_OR_REJECT (7 days).
 *
 * For each eligible guest record:
 * 1. Deletes the private authenticated asset from Cloudinary.
 * 2. Deletes the Media record.
 * 3. Clears `idMediaId` and sets `idPurgedAt = new Date()` on the BookingGuest.
 * 4. Writes an audit entry for each purge action.
 *
 * Idempotent: re-running skips already-purged records (where idPurgedAt is not null or idMediaId is null).
 */
export async function purgeBookingGuestIds(
  asOf = new Date(),
): Promise<PurgeBookingGuestIdsResult> {
  const completedCutoff = new Date(
    asOf.getTime() - ID_RETENTION_DAYS_AFTER_CHECKOUT * 86_400_000,
  );
  const cancelledCutoff = new Date(
    asOf.getTime() - ID_RETENTION_DAYS_AFTER_CANCEL_OR_REJECT * 86_400_000,
  );

  // Find all guests whose ID document is still unpurged and linked to an eligible booking
  const candidates = await db.bookingGuest.findMany({
    where: {
      idPurgedAt: null,
      idMediaId: { not: null },
      booking: {
        OR: [
          {
            status: "COMPLETED",
            checkOut: { lt: completedCutoff },
          },
          {
            status: { in: ["CANCELLED", "REJECTED"] },
            OR: [
              { cancelledAt: { lt: cancelledCutoff } },
              { cancelledAt: null, updatedAt: { lt: cancelledCutoff } },
            ],
          },
        ],
      },
    },
    include: {
      idMedia: true,
      booking: {
        select: {
          id: true,
          reference: true,
          status: true,
          checkOut: true,
          cancelledAt: true,
        },
      },
    },
    take: 200, // Batch limit per cron tick
  });

  let purged = 0;
  let errors = 0;

  for (const guest of candidates) {
    try {
      if (guest.idMedia?.publicId) {
        // 1. Delete authenticated Cloudinary asset
        await deleteCloudinaryAsset({
          publicId: guest.idMedia.publicId,
          resourceType: "image",
          deliveryType: "authenticated",
        });

        // 2. Delete Media row from database
        await db.media.delete({ where: { id: guest.idMedia.id } }).catch(() => undefined);
      }

      // 3. Clear link and set purged timestamp
      const now = new Date();
      await db.bookingGuest.update({
        where: { id: guest.id },
        data: {
          idMediaId: null,
          idPurgedAt: now,
        },
      });

      // 4. Audit the purge
      await audit({
        actor: { id: "system", type: "CRON" },
        action: "booking.guest_id.purge",
        entityType: "BookingGuest",
        entityId: guest.id,
        after: {
          bookingId: guest.booking.id,
          bookingReference: guest.booking.reference,
          bookingStatus: guest.booking.status,
          purgedAt: now.toISOString(),
        },
      });

      purged += 1;
    } catch {
      errors += 1;
    }
  }

  return {
    examined: candidates.length,
    purged,
    errors,
  };
}

