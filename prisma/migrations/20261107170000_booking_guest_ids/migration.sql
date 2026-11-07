-- CreateEnum
CREATE TYPE "BookingGuestAgeGroup" AS ENUM ('ADULT', 'CHILD_4_10', 'INFANT_UNDER_4');

-- CreateEnum
CREATE TYPE "BookingGuestIdType" AS ENUM ('AADHAAR', 'PASSPORT', 'DRIVING_LICENCE', 'VOTER_ID', 'PAN', 'STUDENT_ID', 'BIRTH_CERTIFICATE');

-- CreateTable
CREATE TABLE "BookingGuest" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "ageGroup" "BookingGuestAgeGroup" NOT NULL,
    "idType" "BookingGuestIdType" NOT NULL,
    "idMediaId" TEXT,
    "idPurgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingGuest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingGuest_idMediaId_key" ON "BookingGuest"("idMediaId");

-- CreateIndex
CREATE INDEX "BookingGuest_bookingId_idx" ON "BookingGuest"("bookingId");

-- AddForeignKey
ALTER TABLE "BookingGuest" ADD CONSTRAINT "BookingGuest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingGuest" ADD CONSTRAINT "BookingGuest_idMediaId_fkey" FOREIGN KEY ("idMediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

