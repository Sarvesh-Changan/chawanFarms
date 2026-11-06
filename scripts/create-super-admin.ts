import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { config as loadEnv } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";
import { validateAdminPassword } from "../src/lib/auth/password-policy";

loadEnv({ path: ".env.local" });
loadEnv();

async function readHidden(query: string): Promise<string> {
  process.stdout.write(query);

  if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
    return new Promise((resolve) => {
      let buffer = "";
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      const onData = (ch: string) => {
        const charCode = ch.charCodeAt(0);
        if (ch === "\r" || ch === "\n" || charCode === 4) {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(buffer);
        } else if (charCode === 3) {
          process.stdin.setRawMode(false);
          process.exit(1);
        } else if (charCode === 8 || charCode === 127) {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
          }
        } else {
          buffer += ch;
        }
      };

      process.stdin.on("data", onData);
    });
  }

  // Fallback for non-TTY or piped environment: muted readline
  let muted = false;
  const mutedStream = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) {
        process.stdout.write(chunk, encoding);
      }
      callback();
    },
  });

  const rl = createInterface({
    input: process.stdin,
    output: mutedStream,
    terminal: true,
  });

  try {
    muted = true;
    const answer = await rl.question("");
    process.stdout.write("\n");
    return answer;
  } finally {
    rl.close();
  }
}

async function withDbRetry<T>(fn: () => Promise<T>, maxRetries = 3, delayMs = 3000): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (err: unknown) {
      attempt++;
      const isReachableError =
        err instanceof Error &&
        (err.message.includes("Can't reach database server") ||
          err.message.includes("DatabaseNotReachable") ||
          (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P1001"));
      if (isReachableError && attempt < maxRetries) {
        console.log(
          `Database compute is waking up from idle sleep (attempt ${attempt}/${maxRetries}). Waiting ${delayMs / 1000}s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unable to connect to database after retries.");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("Error: DATABASE_URL not set in environment or .env.local.");
    process.exit(1);
  }

  const args = process.argv.slice(2);

  // Security check: Never accept password via arguments or env vars
  if (args.includes("--password") || process.env.SUPER_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD) {
    console.error("Security Error: Passwords must NEVER be provided as arguments or environment variables.");
    process.exit(1);
  }

  const isProduction = process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";
  const hasProductionFlag = args.includes("--i-know-this-is-production");
  if (isProduction && !hasProductionFlag) {
    console.error("Error: APP_ENV=production requires the explicit flag: --i-know-this-is-production");
    process.exit(1);
  }

  const isResetPasswordRequested = args.includes("--reset-password");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let email = "";
  let name = "";

  try {
    email = (await rl.question("Enter admin email: ")).trim().toLowerCase();
    name = (await rl.question("Enter admin name (default: Super Admin): ")).trim() || "Super Admin";
  } finally {
    rl.close();
  }

  if (!email || !email.includes("@")) {
    console.error("Error: A valid email address is required.");
    process.exit(1);
  }

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const superAdminRole = await withDbRetry(() =>
      db.role.findUnique({
        where: { name: "Super Admin" },
      }),
    );

    if (!superAdminRole) {
      console.error("Error: 'Super Admin' role not found in database. Please run `npm run db:seed` first.");
      process.exit(1);
    }

    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      if (!isResetPasswordRequested) {
        console.error(
          `Error: Account for ${email} already exists. To update credentials or promote, pass --reset-password and confirm interactively.`,
        );
        process.exit(1);
      }

      // Interactive confirmation before overwriting
      const confirmRl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      let confirmAnswer = "";
      try {
        confirmAnswer = (
          await confirmRl.question(
            `Account for ${email} already exists. Are you sure you want to reset credentials and promote? (yes/no): `,
          )
        ).trim().toLowerCase();
      } finally {
        confirmRl.close();
      }

      if (confirmAnswer !== "yes") {
        console.log("Operation aborted by user.");
        process.exit(0);
      }
    }

    // Prompt for password with hidden input and confirmation
    const password = await readHidden("Enter admin password (min 12 chars): ");
    const confirmPassword = await readHidden("Confirm admin password: ");

    if (!Object.is(password, confirmPassword)) {
      console.error("Error: Passwords do not match.");
      process.exit(1);
    }

    // Validate password policy: min 12, max 128, reject 1,000 common passwords, reject email local part
    const policyResult = validateAdminPassword(password, email);
    if (!policyResult.valid) {
      console.error(`Error: Password policy violation: ${policyResult.reason}`);
      process.exit(1);
    }

    // Hash password with Better Auth's scrypt hashing
    const hashedPassword = await hashPassword(password);

    let user;
    if (existingUser) {
      user = await db.user.update({
        where: { id: existingUser.id },
        data: {
          name,
          type: "STAFF",
          status: "ACTIVE",
          emailVerified: true,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      // Revoke all existing sessions for safety
      await db.session.deleteMany({ where: { userId: user.id } });
    } else {
      user = await db.user.create({
        data: {
          email,
          name,
          type: "STAFF",
          status: "ACTIVE",
          emailVerified: true,
          twoFactorEnabled: false,
        },
      });
    }

    // Upsert credential Account
    const existingAccount = await db.account.findFirst({
      where: {
        userId: user.id,
        providerId: "credential",
      },
    });

    if (existingAccount) {
      await db.account.update({
        where: { id: existingAccount.id },
        data: { password: hashedPassword },
      });
    } else {
      await db.account.create({
        data: {
          userId: user.id,
          providerId: "credential",
          accountId: user.id,
          password: hashedPassword,
        },
      });
    }

    // Assign Super Admin role
    await db.staffRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: superAdminRole.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: superAdminRole.id,
      },
    });

    // Write audit log entry
    await db.auditLog.create({
      data: {
        actorId: user.id,
        actorType: "SYSTEM",
        action: existingUser ? "admin.super_admin_reset" : "admin.super_admin_created",
        entityType: "User",
        entityId: user.id,
        after: {
          email: user.email,
          role: "Super Admin",
          status: "ACTIVE",
          emailVerified: true,
        },
      },
    });

    console.log("\n========================================");
    console.log(" Super Admin account configured!");
    console.log("========================================");
    console.log(` Email:    ${email}`);
    console.log(` Role:     Super Admin`);
    console.log(` Status:   ACTIVE`);
    console.log(` Verified: YES`);
    console.log("\nIMPORTANT SECURITY STEP:");
    console.log("Log in at /login and enrol TOTP two-factor authentication immediately at /admin/security/two-factor.\n");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
