import { createInterface } from "node:readline/promises";
import { config as loadEnv } from "dotenv";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("Error: DATABASE_URL not set in environment or .env.local.");
    process.exit(1);
  }

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  const args = process.argv.slice(2);
  let email = "";
  let name = "";
  let password = "";

  for (let i = 0; i < args.length; i += 1) {
    const val = args[i + 1];
    if (args[i] === "--email" && typeof val === "string") {
      email = val;
      i += 1;
    } else if (args[i] === "--name" && typeof val === "string") {
      name = val;
      i += 1;
    } else if (args[i] === "--password" && typeof val === "string") {
      password = val;
      i += 1;
    }
  }

  if (!email || !password) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      if (!email) {
        email = (await rl.question("Enter admin email: ")).trim();
      }
      if (!name) {
        name = (await rl.question("Enter admin name (default: Super Admin): ")).trim() || "Super Admin";
      }
      if (!password) {
        password = (await rl.question("Enter admin password (min 10 chars): ")).trim();
      }
    } finally {
      rl.close();
    }
  }

  if (!email || !email.includes("@")) {
    console.error("Error: A valid email address is required.");
    process.exit(1);
  }
  if (!password || password.length < 10) {
    console.error("Error: Password must be at least 10 characters long.");
    process.exit(1);
  }
  if (!name) {
    name = "Super Admin";
  }

  email = email.toLowerCase().trim();

  console.log(`\nSetting up Super Admin account for: ${email}...`);

  const superAdminRole = await db.role.findUnique({
    where: { name: "Super Admin" },
  });

  if (!superAdminRole) {
    console.error("Error: 'Super Admin' role not found in database. Please run `npm run db:seed` first.");
    process.exit(1);
  }

  const hashedPassword = await hashPassword(password);

  let user = await db.user.findUnique({
    where: { email },
  });

  if (user) {
    console.log(`Found existing user account for ${email}. Updating credentials and permissions...`);
    user = await db.user.update({
      where: { id: user.id },
      data: {
        name,
        type: "STAFF",
        status: "ACTIVE",
        emailVerified: true,
      },
    });
  } else {
    user = await db.user.create({
      data: {
        email,
        name,
        type: "STAFF",
        status: "ACTIVE",
        emailVerified: true,
      },
    });
    console.log(`Created staff user record (${user.id}).`);
  }

  // Create or update credential Account
  const existingAccount = await db.account.findFirst({
    where: {
      userId: user.id,
      providerId: "credential",
    },
  });

  if (existingAccount) {
    await db.account.update({
      where: { id: existingAccount.id },
      data: {
        password: hashedPassword,
      },
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

  console.log("\n========================================");
  console.log(" Super Admin account successfully setup!");
  console.log("========================================");
  console.log(` Email:    ${email}`);
  console.log(` Role:     Super Admin`);
  console.log(` Status:   ACTIVE`);
  console.log(` Verified: YES`);
  console.log("\nYou can now sign in at http://localhost:3000/login to access http://localhost:3000/admin\n");

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
