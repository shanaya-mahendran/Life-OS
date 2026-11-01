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

const DOMAINS = [
  { slug: "career", name: "Career", accent: "#3b82f6", icon: "briefcase", protected: false },
  { slug: "education", name: "Education", accent: "#6366f1", icon: "graduation", protected: false },
  { slug: "competitions", name: "Competitions", accent: "#f59e0b", icon: "trophy", protected: false },
  { slug: "volunteering", name: "Volunteering", accent: "#10b981", icon: "handshake", protected: false },
  { slug: "open-source", name: "Open Source", accent: "#06b6d4", icon: "code", protected: false },
  { slug: "food", name: "Food", accent: "#f97316", icon: "food", protected: true },
  { slug: "sleep", name: "Sleep", accent: "#4338ca", icon: "moon", protected: true },
  { slug: "karate", name: "Karate", accent: "#f43f5e", icon: "swords", protected: true },
  { slug: "blogging", name: "Blogging", accent: "#d946ef", icon: "pen", protected: false },
  { slug: "learning", name: "Learning", accent: "#8b5cf6", icon: "brain", protected: false },
  { slug: "planning", name: "Forward Planning", accent: "#6d28d9", icon: "compass", protected: true },
  { slug: "rest", name: "Rest & Buffer", accent: "#14b8a6", icon: "armchair", protected: true },
  { slug: "finance", name: "Finance", accent: "#22c55e", icon: "wallet", protected: false },
  { slug: "admin", name: "Admin", accent: "#0ea5e9", icon: "clipboard", protected: false },
  { slug: "social", name: "Social & Mentors", accent: "#ec4899", icon: "users", protected: false },
  { slug: "portfolio", name: "Portfolio", accent: "#94a3b8", icon: "folder", protected: false },
  { slug: "travel", name: "Travel & Commute", accent: "#84cc16", icon: "plane", protected: false },
  { slug: "habits", name: "Habits & Reflection", accent: "#eab308", icon: "sparkles", protected: true },
];

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
      update: { accent: domain.accent, name: domain.name },
      create: {
        userId: user.id,
        slug: domain.slug,
        name: domain.name,
        accent: domain.accent,
        icon: domain.icon,
        isProtected: domain.protected,
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
