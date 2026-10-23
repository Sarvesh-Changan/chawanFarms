import type { Prisma } from "@/generated/prisma/client";

export type AccountOwnershipIdentity = {
  id: string;
  email: string;
  emailVerified: boolean;
};

export function bookingOwnership(identity: AccountOwnershipIdentity): Prisma.BookingWhereInput {
  const ownership: Prisma.BookingWhereInput[] = [{ userId: identity.id }];
  if (identity.emailVerified) ownership.push({ lead: { email: { equals: identity.email, mode: "insensitive" } } });
  return { OR: ownership };
}

export function enquiryOwnership(identity: AccountOwnershipIdentity): Prisma.EnquiryWhereInput {
  const ownership: Prisma.LeadWhereInput[] = [{ userId: identity.id }];
  if (identity.emailVerified) ownership.push({ email: { equals: identity.email, mode: "insensitive" } });
  return { lead: { OR: ownership } };
}
