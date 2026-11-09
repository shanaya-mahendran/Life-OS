/**
 * Seed script.
 *
 * Creates (or refreshes) the demo account with all 18 domains and a realistic
 * starter week. Safe to re-run: it never duplicates the calendar.
 *
 * Run with: npm run db:seed
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { DOMAINS } from "../src/lib/domains/catalog";

function loadEnv() {
  const candidates = [".env", ".env.local"];
  for (const file of candidates) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const prisma = new PrismaClient();

const DEMO_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: process.env.DEMO_EMAIL ?? "demo@lifeos.app",
  name: "Shanaya Mahendran",
  timezone: process.env.DEMO_TIMEZONE ?? "Asia/Kolkata",
};

async function main() {
  const user = await prisma.user.upsert({
    where: { id: DEMO_USER.id },
    update: { email: DEMO_USER.email, name: DEMO_USER.name, timezone: DEMO_USER.timezone },
    create: {
      id: DEMO_USER.id,
      email: DEMO_USER.email,
      name: DEMO_USER.name,
      timezone: DEMO_USER.timezone,
      onboardedAt: new Date(),
    },
  });

  for (const [index, domain] of DOMAINS.entries()) {
    await prisma.domain.upsert({
      where: { userId_slug: { userId: user.id, slug: domain.slug } },
      update: { accent: domain.accent, name: domain.name, icon: domain.icon, isProtected: domain.protectedByDefault },
      create: {
        userId: user.id,
        slug: domain.slug,
        name: domain.name,
        accent: domain.accent,
        icon: domain.icon,
        isProtected: domain.protectedByDefault,
        sortOrder: index,
      },
    });
  }

  const eventCount = await prisma.event.count({ where: { userId: user.id } });
  if (eventCount === 0) {
    console.log("No events yet — open the app and sign in to generate the starter week.");
  }

  console.log(`Seeded account ${user.email} with ${DOMAINS.length} domains.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
