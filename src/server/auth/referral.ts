import "server-only";

import { randomBytes } from "node:crypto";

import { db } from "@/server/db";

function referralCode(): string {
  return randomBytes(6).toString("hex").toUpperCase();
}

export async function ensureCustomerProfile(userId: string): Promise<void> {
  const existing = await db.customerProfile.findUnique({ where: { userId } });
  if (existing) return;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await db.customerProfile.create({
        data: { userId, referralCode: referralCode() },
      });
      return;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code !== "P2002" || attempt === 4) throw error;
    }
  }
}
