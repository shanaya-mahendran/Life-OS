/**
 * Diary Mode engine.
 *
 * Every read and write is scoped to the signed-in user here, and the ambient
 * layer is the only place entry text ever reaches a model. When it is off,
 * unavailable or paused by the safety guard, entries still save — the diary is
 * never blocked by the AI.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ServiceUser } from "@/lib/calendar/service";
import { addZonedDays, dayKey, startOfZonedDay } from "@/lib/time";
import { diaryAiEnabled } from "./flags";
import {
  advocatePass,
  burnTakeaway,
  collaboratorSeeds,
  diaryAiConfigured,
  monthlyStory,
  personaReply,
  runAmbient,
  trendCards,
  type AdvocatePattern,
  type CollaboratorSeed,
} from "./ai";
import {
  MAX_ENTRY_CHARS,
  MAX_SESSION_TURNS,
  MAX_TAGS,
  MODE_META,
  NEUTRAL_GRADIENT,
  SUPPORT_MESSAGE,
  fallbackGradient,
  type DiaryMode,
} from "./constants";
import {
  bestEcho,
  buildTrendDigest,
  detectDistress,
  parsePalette,
  pickSpark,
  readingMinutes,
  type DiaryMetaRow,
} from "./text";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface DiarySettingsView {
  ambientOn: boolean;
  trendsOn: boolean;
  sparkOn: boolean;
  sendTextToAi: boolean;
  encryptionOn: boolean;
  encryptionSalt: string;
  recoveryHint: string;
  pausedUntil: string | null;
  aiConfigured: boolean;
  aiEnabled: boolean;
}

export interface DiaryEntryView {
  id: string;
  body: string;
  encrypted: boolean;
  entryDate: string;
  tags: string[];
  colors: [string, string];
  stamps: string[];
  silverLining: string;
  silverLiningDeleted: boolean;
  spark: string;
  ambientStatus: string;
  ambientAt: string | null;
  createdAt: string;
  updatedAt: string;
  words: number;
  minutes: number;
}

export interface SessionTurn {
  role: "user" | "coach";
  content: string;
  at: string;
}

export interface DiarySessionView {
  id: string;
  entryId: string;
  mode: DiaryMode;
  persona: string;
  maxTurns: number;
  status: string;
  turns: SessionTurn[];
  createdAt: string;
}

export interface ArtifactView {
  id: string;
  kind: string;
  body: string;
  meta: Record<string, unknown>;
  status: string;
  periodKey: string;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Parsing helpers                                                            */
/* -------------------------------------------------------------------------- */

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, 12);
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function wordsIn(body: string): number {
  const trimmed = body.trim();
  if (!trimmed || trimmed.startsWith("env:v1:")) return 0;
  return trimmed.split(/\s+/).length;
}

type EntryRow = {
  id: string;
  body: string;
  encrypted: boolean;
  entryDate: string;
  tags: unknown;
  moodColors: unknown;
  stamps: unknown;
  silverLining: string;
  silverLiningDeleted: boolean;
  spark: string;
  ambientStatus: string;
  ambientAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toEntryView(row: EntryRow): DiaryEntryView {
  const words = wordsIn(row.body);
  return {
    id: row.id,
    body: row.body,
    encrypted: row.encrypted,
    entryDate: row.entryDate,
    tags: toStringArray(row.tags),
    colors: parsePalette(row.moodColors, NEUTRAL_GRADIENT),
    stamps: toStringArray(row.stamps).slice(0, 3),
    silverLining: row.silverLining,
    silverLiningDeleted: row.silverLiningDeleted,
    spark: row.spark,
    ambientStatus: row.ambientStatus,
    ambientAt: row.ambientAt ? row.ambientAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    words,
    minutes: readingMinutes(row.body.length),
  };
}

function toSessionView(row: {
  id: string;
  entryId: string;
  mode: string;
  persona: string;
  maxTurns: number;
  status: string;
  turns: unknown;
  createdAt: Date;
}): DiarySessionView {
  const turns = Array.isArray(row.turns)
    ? row.turns
        .map((item) => {
          const record = toRecord(item);
          const role = record.role === "coach" ? "coach" : "user";
          const content = typeof record.content === "string" ? record.content : "";
          const at = typeof record.at === "string" ? record.at : new Date().toISOString();
          return content ? { role, content, at } : null;
        })
        .filter((item): item is SessionTurn => Boolean(item))
    : [];

  return {
    id: row.id,
    entryId: row.entryId,
    mode: (row.mode as DiaryMode) ?? "alter_ego",
    persona: row.persona,
    maxTurns: row.maxTurns,
    status: row.status,
    turns,
    createdAt: row.createdAt.toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Settings are created lazily on first use, and several page loads can hit that
 * first use at the same time. Prisma's `upsert` reads then inserts, so two
 * concurrent calls race on the `userId` primary key; losing that race is fine
 * as long as we then read the row the other request created.
 */
async function ensureSettingsRow(userId: string) {
  const existing = await prisma.diarySettings.findUnique({ where: { userId } });
  if (existing) return existing;

  try {
    return await prisma.diarySettings.create({ data: { userId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const created = await prisma.diarySettings.findUnique({ where: { userId } });
      if (created) return created;
    }
    throw error;
  }
}

export async function getDiarySettings(userId: string): Promise<DiarySettingsView> {
  const row = await ensureSettingsRow(userId);

  return {
    ambientOn: row.ambientOn,
    trendsOn: row.trendsOn,
    sparkOn: row.sparkOn,
    sendTextToAi: row.sendTextToAi,
    encryptionOn: row.encryptionOn,
    encryptionSalt: row.encryptionSalt,
    recoveryHint: row.recoveryHint,
    pausedUntil: row.pausedUntil ? row.pausedUntil.toISOString() : null,
    aiConfigured: diaryAiConfigured(),
    aiEnabled: diaryAiEnabled(),
  };
}

export async function updateDiarySettings(
  userId: string,
  patch: Partial<{
    ambientOn: boolean;
    trendsOn: boolean;
    sparkOn: boolean;
    sendTextToAi: boolean;
    encryptionOn: boolean;
    encryptionSalt: string;
    recoveryHint: string;
  }>,
): Promise<DiarySettingsView> {
  await ensureSettingsRow(userId);
  await prisma.diarySettings.update({ where: { userId }, data: patch });
  return getDiarySettings(userId);
}

async function settingsRow(userId: string) {
  return ensureSettingsRow(userId);
}

function aiPausedNow(pausedUntil: Date | null, now: Date): boolean {
  return Boolean(pausedUntil && pausedUntil.getTime() > now.getTime());
}

/** Pauses diary AI until the end of the user's current day. */
export async function pauseDiaryAi(userId: string, user: ServiceUser, now = new Date()): Promise<void> {
  const tomorrowStart = addZonedDays(startOfZonedDay(now, user.timezone), 1, user.timezone);
  await ensureSettingsRow(userId);
  await prisma.diarySettings.update({ where: { userId }, data: { pausedUntil: tomorrowStart } });
}

/* -------------------------------------------------------------------------- */
/* Entries                                                                    */
/* -------------------------------------------------------------------------- */

export async function listEntries(userId: string, limit = 40): Promise<DiaryEntryView[]> {
  const rows = await prisma.diaryEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toEntryView);
}

export async function getEntry(userId: string, id: string): Promise<DiaryEntryView | null> {
  const row = await prisma.diaryEntry.findFirst({ where: { id, userId } });
  return row ? toEntryView(row) : null;
}

export async function getTodayEntry(userId: string, timeZone: string, now = new Date()): Promise<DiaryEntryView | null> {
  const row = await prisma.diaryEntry.findFirst({
    where: { userId, entryDate: dayKey(now, timeZone) },
    orderBy: { createdAt: "desc" },
  });
  return row ? toEntryView(row) : null;
}

export async function createEntry(
  user: ServiceUser,
  input: { body: string; tags?: string[]; encrypted?: boolean },
  now = new Date(),
): Promise<DiaryEntryView> {
  const settings = await settingsRow(user.id);
  const encrypted = Boolean(input.encrypted);
  const body = encrypted ? input.body : input.body.slice(0, MAX_ENTRY_CHARS);
  const tags = (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean).slice(0, MAX_TAGS);

  const row = await prisma.diaryEntry.create({
    data: {
      userId: user.id,
      body,
      // Locking needs both the switch and a salt to derive a key from.
      encrypted: encrypted || (settings.encryptionOn && Boolean(settings.encryptionSalt)),
      entryDate: dayKey(now, user.timezone),
      tags,
      ambientStatus: "pending",
    },
  });

  return toEntryView(row);
}

export async function updateEntry(
  userId: string,
  id: string,
  patch: { body?: string; tags?: string[]; silverLining?: string; silverLiningDeleted?: boolean; spark?: string },
): Promise<DiaryEntryView | null> {
  const existing = await prisma.diaryEntry.findFirst({ where: { id, userId } });
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  if (typeof patch.body === "string") {
    data.body = existing.encrypted ? patch.body : patch.body.slice(0, MAX_ENTRY_CHARS);
    // Editing an entry invalidates its cached ambient result — re-run only when asked.
    data.ambientStatus = "pending";
  }
  if (Array.isArray(patch.tags)) {
    data.tags = patch.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, MAX_TAGS);
  }
  if (typeof patch.silverLining === "string") data.silverLining = patch.silverLining.slice(0, 200);
  if (typeof patch.silverLiningDeleted === "boolean") data.silverLiningDeleted = patch.silverLiningDeleted;
  if (typeof patch.spark === "string") data.spark = patch.spark.slice(0, 200);

  const row = await prisma.diaryEntry.update({ where: { id }, data });
  return toEntryView(row);
}

export async function deleteEntry(userId: string, id: string): Promise<boolean> {
  const existing = await prisma.diaryEntry.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) return false;
  await prisma.diaryEntry.delete({ where: { id } });
  return true;
}

/* -------------------------------------------------------------------------- */
/* Ambient layer                                                              */
/* -------------------------------------------------------------------------- */

export interface AmbientOutcome {
  entry: DiaryEntryView;
  paused: boolean;
  message: string;
}

/**
 * Runs (or returns the cache of) the single ambient call for an entry.
 * Cached results are reused unless `force` is passed.
 */
export async function ambientForEntry(
  user: ServiceUser,
  id: string,
  options: { force?: boolean; now?: Date } = {},
): Promise<AmbientOutcome | null> {
  const now = options.now ?? new Date();
  const row = await prisma.diaryEntry.findFirst({ where: { id, userId: user.id } });
  if (!row) return null;

  const settings = await settingsRow(user.id);
  const cached: AmbientOutcome = { entry: toEntryView(row), paused: false, message: "" };

  if (!options.force && row.ambientAt) return cached;

  const skip = async (status: string, message: string): Promise<AmbientOutcome> => {
    const updated = await prisma.diaryEntry.update({
      where: { id },
      data: { ambientStatus: status },
    });
    return { entry: toEntryView(updated), paused: false, message };
  };

  if (row.encrypted) {
    return skip("encrypted", "This entry is locked, so nothing was sent to the AI.");
  }
  if (aiPausedNow(settings.pausedUntil, now)) {
    return skip("paused", "The AI is paused for today. Your entry is saved.");
  }
  if (!settings.ambientOn || !settings.sendTextToAi || !diaryAiEnabled()) {
    return skip("off", "Ambient AI is off in Diary settings.");
  }
  if (detectDistress(row.body)) {
    await pauseDiaryAi(user.id, user, now);
    const updated = await prisma.diaryEntry.update({ where: { id }, data: { ambientStatus: "paused" } });
    return { entry: toEntryView(updated), paused: true, message: SUPPORT_MESSAGE };
  }

  const recent = await prisma.diaryEntry.findMany({
    where: { userId: user.id, createdAt: { gte: addZonedDays(now, -14, user.timezone) } },
    select: { spark: true },
  });

  const localHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: user.timezone, hour: "2-digit", hour12: false })
      .format(now)
      .replace(/\D/g, ""),
  );
  const timeOfDay = localHour < 5 ? "late night" : localHour < 12 ? "morning" : localHour < 17 ? "afternoon" : "evening";

  const result = await runAmbient(user.id, row.body, {
    timeOfDay,
    recentSparks: recent.map((item) => item.spark).filter(Boolean),
  });

  if (!result) {
    const updated = await prisma.diaryEntry.update({
      where: { id },
      data: { ambientStatus: "failed", moodColors: fallbackGradient(row.body.length) },
    });
    return {
      entry: toEntryView(updated),
      paused: false,
      message: "The ambient layer could not be reached. Your entry is saved exactly as written.",
    };
  }

  const stampDate = startOfZonedDay(row.createdAt, user.timezone);
  const updated = await prisma.diaryEntry.update({
    where: { id },
    data: {
      moodColors: result.hexColors,
      stamps: result.emojiStamps,
      silverLining: result.oneLineReframing,
      spark: result.spark || row.spark,
      ambientAt: now,
      ambientStatus: "ok",
    },
  });

  await prisma.diaryStamp.deleteMany({ where: { entryId: id } });
  await prisma.diaryStamp.createMany({
    data: result.emojiStamps.map((emoji) => ({ userId: user.id, entryId: id, emoji, date: stampDate })),
    skipDuplicates: true,
  });

  return { entry: toEntryView(updated), paused: false, message: "" };
}

/* -------------------------------------------------------------------------- */
/* Sparks                                                                     */
/* -------------------------------------------------------------------------- */

export async function sparkForToday(user: ServiceUser, now = new Date()): Promise<string | null> {
  const settings = await settingsRow(user.id);
  if (!settings.sparkOn) return null;

  const since = addZonedDays(now, -14, user.timezone);
  const recent = await prisma.diaryEntry.findMany({
    where: { userId: user.id, createdAt: { gte: since }, spark: { not: "" } },
    select: { spark: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const dayIndex = Math.floor(startOfZonedDay(now, user.timezone).getTime() / 86_400_000);
  const local = pickSpark(dayIndex, recent.map((item) => item.spark));
  if (local) return local;

  const latest = await prisma.diaryEntry.findFirst({
    where: { userId: user.id, spark: { not: "" } },
    orderBy: { createdAt: "desc" },
    select: { spark: true },
  });
  return latest?.spark ?? null;
}

/* -------------------------------------------------------------------------- */
/* Stamp collection                                                           */
/* -------------------------------------------------------------------------- */

export async function stampCollection(userId: string, limit = 60): Promise<{ emoji: string; count: number; last: string }[]> {
  const rows = await prisma.diaryStamp.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 400,
    select: { emoji: true, date: true },
  });

  const map = new Map<string, { emoji: string; count: number; last: string }>();
  for (const row of rows) {
    const existing = map.get(row.emoji);
    if (existing) existing.count += 1;
    else map.set(row.emoji, { emoji: row.emoji, count: 1, last: row.date.toISOString() });
  }

  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/* Deep modes                                                                 */
/* -------------------------------------------------------------------------- */

function advocateFromTurns(turns: SessionTurn[]): AdvocatePattern[] {
  return turns
    .filter((turn) => turn.role === "coach")
    .map((turn) => {
      try {
        const parsed = JSON.parse(turn.content) as { quote?: string; question?: string };
        return { quote: parsed.quote ?? "", question: parsed.question ?? "" };
      } catch {
        return { quote: "", question: turn.content };
      }
    })
    .filter((item) => item.question);
}

export type StartSessionResult = { session: DiarySessionView | null; paused?: boolean; message?: string } | null;

export async function startSession(
  user: ServiceUser,
  input: { entryId: string; mode: DiaryMode; persona?: string },
): Promise<StartSessionResult> {
  const entry = await prisma.diaryEntry.findFirst({ where: { id: input.entryId, userId: user.id } });
  if (!entry) return null;

  const settings = await settingsRow(user.id);
  const now = new Date();
  const block = (message: string): StartSessionResult => ({ session: null, paused: true, message });

  if (entry.encrypted) {
    return block("This entry is locked. Unlock it in the editor before opening a deep mode.");
  }
  if (aiPausedNow(settings.pausedUntil, now)) {
    return block("Deep modes are paused for today. Your entry is safe.");
  }
  if (!settings.sendTextToAi || !diaryAiEnabled()) {
    return block("Sending entry text to the AI is off in Diary settings.");
  }
  if (detectDistress(entry.body) && input.mode !== "alter_ego") {
    await pauseDiaryAi(user.id, user, now);
    return block(SUPPORT_MESSAGE);
  }

  const meta = MODE_META[input.mode];
  let turns: SessionTurn[] = [];

  if (input.mode === "devils_advocate") {
    const patterns = await advocatePass(user.id, entry.body);
    if (patterns === null) return block("The Devil's Advocate could not reach the model. Try again in a moment.");
    turns = patterns.map((pattern) => ({
      role: "coach" as const,
      content: JSON.stringify(pattern),
      at: now.toISOString(),
    }));
    if (!turns.length) {
      turns = [{ role: "coach", content: JSON.stringify({ quote: "", question: "No clear thinking trap here — this reads steady." }), at: now.toISOString() }];
    }
  } else if (input.mode === "collaborator") {
    const seeds = await collaboratorSeeds(user.id, entry.body);
    if (seeds === null) return block("The collaborator could not reach the model. Try again in a moment.");
    turns = seeds.map((seed: CollaboratorSeed) => ({
      role: "coach" as const,
      content: JSON.stringify(seed),
      at: now.toISOString(),
    }));
    if (!turns.length) return block("No seeds came back this time. Nothing was saved.");
  } else {
    const reply = await personaReply(user.id, {
      personaId: input.persona ?? "stoic",
      entryText: entry.body,
      turns: [],
    });
    if (!reply) return block("The mirror could not reach the model. Try again in a moment.");
    turns = [{ role: "coach", content: reply, at: now.toISOString() }];
  }

  const row = await prisma.diarySession.create({
    data: {
      userId: user.id,
      entryId: entry.id,
      mode: input.mode,
      persona: input.persona ?? "stoic",
      maxTurns: meta.turns,
      turns: turns as unknown as Prisma.InputJsonValue,
      status: input.mode === "alter_ego" ? "active" : "ended",
    },
  });

  return { session: toSessionView(row) };
}

export async function getSession(userId: string, id: string): Promise<DiarySessionView | null> {
  const row = await prisma.diarySession.findFirst({ where: { id, userId } });
  return row ? toSessionView(row) : null;
}

export async function listSessionsForEntry(userId: string, entryId: string): Promise<DiarySessionView[]> {
  const rows = await prisma.diarySession.findMany({
    where: { userId, entryId },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  return rows.map(toSessionView);
}

export async function addSessionTurn(
  user: ServiceUser,
  id: string,
  content: string,
): Promise<{ session: DiarySessionView; ended?: boolean; message?: string } | null> {
  const row = await prisma.diarySession.findFirst({ where: { id, userId: user.id } });
  if (!row) return null;

  const settings = await settingsRow(user.id);
  const now = new Date();

  if (row.status !== "active") {
    return { session: toSessionView(row), ended: true, message: "This session has ended." };
  }
  if (aiPausedNow(settings.pausedUntil, now) || !settings.sendTextToAi || !diaryAiEnabled()) {
    return { session: toSessionView(row), message: "Deep modes are paused. Your messages were not sent." };
  }
  if (detectDistress(content)) {
    await pauseDiaryAi(user.id, user, now);    const turns = [...(row.turns as unknown as SessionTurn[]), { role: "user" as const, content: content.slice(0, 4000), at: now.toISOString() }];
    const updated = await prisma.diarySession.update({
      where: { id },
      data: { turns: turns as unknown as Prisma.InputJsonValue, status: "ended" },
    });
    return { session: toSessionView(updated), ended: true, message: SUPPORT_MESSAGE };
  }

  const entry = await prisma.diaryEntry.findFirst({ where: { id: row.entryId, userId: user.id } });
  const turns = [
    ...(row.turns as unknown as SessionTurn[]),
    { role: "user" as const, content: content.slice(0, 4000), at: now.toISOString() },
  ];

  const userTurns = turns.filter((turn) => turn.role === "user").length;
  if (userTurns >= row.maxTurns) {
    const updated = await prisma.diarySession.update({
      where: { id },
      data: { turns: turns as unknown as Prisma.InputJsonValue, status: "ended" },
    });
    return { session: toSessionView(updated), ended: true, message: "That was the last turn in this session." };
  }

  const reply = await personaReply(user.id, {
    personaId: row.persona,
    entryText: entry?.body ?? "",
    turns: turns.map((turn) => ({ role: turn.role, content: turn.content })),
  });

  if (!reply) {
    const updated = await prisma.diarySession.update({
      where: { id },
      data: { turns: turns as unknown as Prisma.InputJsonValue },
    });
    return { session: toSessionView(updated), message: "The mirror did not answer. Your message was kept." };
  }

  turns.push({ role: "coach", content: reply, at: new Date().toISOString() });
  const updated = await prisma.diarySession.update({
    where: { id },
    data: { turns: turns as unknown as Prisma.InputJsonValue },
  });
  return { session: toSessionView(updated), ended: userTurns >= row.maxTurns - 1 };
}

export async function endSession(userId: string, id: string): Promise<DiarySessionView | null> {
  const row = await prisma.diarySession.findFirst({ where: { id, userId } });
  if (!row) return null;
  const updated = await prisma.diarySession.update({ where: { id }, data: { status: "ended" } });
  return toSessionView(updated);
}

export async function deleteSession(userId: string, id: string): Promise<boolean> {
  const row = await prisma.diarySession.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) return false;
  await prisma.diarySession.delete({ where: { id } });
  return true;
}

/* -------------------------------------------------------------------------- */
/* Artifacts (trend cards, blind spots, monthly stories, pinned seeds)        */
/* -------------------------------------------------------------------------- */

function toArtifactView(row: {
  id: string;
  kind: string;
  body: string;
  meta: unknown;
  status: string;
  periodKey: string;
  createdAt: Date;
}): ArtifactView {
  return {
    id: row.id,
    kind: row.kind,
    body: row.body,
    meta: toRecord(row.meta),
    status: row.status,
    periodKey: row.periodKey,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listArtifacts(
  userId: string,
  options: { kind?: string; status?: string; limit?: number } = {},
): Promise<ArtifactView[]> {
  const rows = await prisma.diaryArtifact.findMany({
    where: {
      userId,
      ...(options.kind ? { kind: options.kind } : {}),
      ...(options.status ? { status: options.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 20,
  });
  return rows.map(toArtifactView);
}

export async function setArtifactStatus(
  userId: string,
  id: string,
  status: "active" | "dismissed",
): Promise<boolean> {
  const row = await prisma.diaryArtifact.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) return false;
  await prisma.diaryArtifact.update({ where: { id }, data: { status } });
  return true;
}

export async function pinSeed(
  userId: string,
  input: { entryId: string; text: string; kind: string },
): Promise<ArtifactView> {
  const row = await prisma.diaryArtifact.create({
    data: {
      userId,
      kind: "pinned_seed",
      body: input.text.slice(0, 400),
      meta: { seedKind: input.kind },
      sourceIds: [input.entryId],
      periodKey: "",
    },
  });
  return toArtifactView(row);
}

export async function deleteArtifact(userId: string, id: string): Promise<boolean> {
  const row = await prisma.diaryArtifact.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) return false;
  await prisma.diaryArtifact.delete({ where: { id } });
  return true;
}

/* -------------------------------------------------------------------------- */
/* Blind Spot reminders                                                       */
/* -------------------------------------------------------------------------- */

const ECHO_LOOKBACK_DAYS = 365;

export async function findEcho(
  userId: string,
  entryId: string,
): Promise<{ body: string; entryId: string; entryDate: string; score: number } | null> {
  const entry = await prisma.diaryEntry.findFirst({ where: { id: entryId, userId } });
  if (!entry || entry.encrypted) return null;

  const candidates = await prisma.diaryEntry.findMany({
    where: {
      userId,
      id: { not: entryId },
      encrypted: false,
      createdAt: { gte: addZonedDays(entry.createdAt, -ECHO_LOOKBACK_DAYS, "UTC") },
      body: { not: "" },
    },
    select: { id: true, body: true, entryDate: true },
    orderBy: { createdAt: "desc" },
    take: 250,
  });

  const match = bestEcho(entry.body, candidates);
  if (!match) return null;

  const excerpt = match.entry.body
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 42)
    .join(" ");

  await prisma.diaryArtifact.upsert({
    where: { userId_kind_periodKey: { userId, kind: "blind_spot", periodKey: match.entry.id } },
    update: { body: excerpt, status: "active" },
    create: {
      userId,
      kind: "blind_spot",
      body: excerpt,
      meta: { score: Number(match.score.toFixed(2)), entryDate: match.entry.entryDate },
      sourceIds: [entryId, match.entry.id],
      periodKey: match.entry.id,
    },
  });

  return {
    body: excerpt,
    entryId: match.entry.id,
    entryDate: match.entry.entryDate,
    score: Number(match.score.toFixed(2)),
  };
}

/* -------------------------------------------------------------------------- */
/* Burn Diary                                                                 */
/* -------------------------------------------------------------------------- */

export async function burnText(
  user: ServiceUser,
  text: string,
  now = new Date(),
): Promise<{ takeaway: string; paused: boolean }> {
  const trimmed = text.trim().slice(0, 6000);

  if (detectDistress(trimmed)) {
    await pauseDiaryAi(user.id, user, now);
    const takeaway = SUPPORT_MESSAGE;
    // A single insert is atomic: the original text is never written to any table,
    // so there is nothing to delete in a second step.
    await prisma.burnEntry.create({ data: { userId: user.id, takeaway } });
    return { takeaway, paused: true };
  }

  const settings = await settingsRow(user.id);
  const paused = aiPausedNow(settings.pausedUntil, now);
  const aiAllowed = !paused && settings.sendTextToAi && diaryAiEnabled();

  const generated = aiAllowed ? await burnTakeaway(user.id, trimmed) : null;
  const takeaway =
    generated ??
    (aiAllowed
      ? "You carried it, you said it, and it is gone now. That counts as facing it."
      : "It is written, it is deleted, and nothing was sent anywhere. You still showed up.");

  await prisma.burnEntry.create({ data: { userId: user.id, takeaway } });

  return { takeaway, paused };
}

export async function listBurnEntries(userId: string, limit = 20): Promise<{ id: string; takeaway: string; createdAt: string }[]> {
  const rows = await prisma.burnEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, takeaway: true, createdAt: true },
  });
  return rows.map((row) => ({ id: row.id, takeaway: row.takeaway, createdAt: row.createdAt.toISOString() }));
}

/* -------------------------------------------------------------------------- */
/* Cron: weekly trends                                                        */
/* -------------------------------------------------------------------------- */

function isoWeekKey(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Deterministic cards so the trend screen works even with no model key. */
function fallbackTrendCards(rows: DiaryMetaRow[]): string[] {
  if (rows.length < 4) return [];
  const lengths = rows.map((row) => row.bodyLength);
  const average = Math.round(lengths.reduce((sum, value) => sum + value, 0) / lengths.length);
  const late = rows.filter((row) => {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "2-digit", hour12: false })
        .format(row.createdAt)
        .replace(/\D/g, ""),
    );
    return hour >= 19 || hour < 3;
  }).length;
  const stampCounts = new Map<string, number>();
  for (const row of rows) for (const stamp of row.stamps) stampCounts.set(stamp, (stampCounts.get(stamp) ?? 0) + 1);
  const topStamp = [...stampCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const cards = [
    `Your entries average ${average} characters over the last three months — ${average > 700 ? "longer on reflective days" : "short and steady"}.`,
    late > rows.length / 2
      ? "Most of your writing happens late in the evening, after the day has already spoken."
      : "Most of your writing happens during daylight — the quiet parts of the day.",
  ];
  if (topStamp) cards.push(`"${topStamp}" keeps returning in your stamps, more than any other marker.`);
  return cards.slice(0, 3);
}

export async function runDiaryTrends(now = new Date()) {
  if (!diaryAiEnabled()) return { ok: true, users: 0, cards: 0, disabled: true };

  const settings = await prisma.diarySettings.findMany({
    where: { trendsOn: true },
    select: { userId: true, user: { select: { timezone: true } } },
    take: 500,
  });

  let cards = 0;

  for (const setting of settings) {
    try {
      const since = addZonedDays(now, -90, setting.user.timezone);
      const entries = await prisma.diaryEntry.findMany({
        where: { userId: setting.userId, createdAt: { gte: since } },
        select: {
          entryDate: true,
          createdAt: true,
          body: true,
          tags: true,
          stamps: true,
          moodColors: true,
          encrypted: true,
        },
        orderBy: { createdAt: "asc" },
      });

      if (entries.length < 3) continue;

      const rows: DiaryMetaRow[] = entries.map((entry) => ({
        entryDate: entry.entryDate,
        createdAt: entry.createdAt,
        bodyLength: entry.encrypted ? 0 : entry.body.length,
        tags: toStringArray(entry.tags),
        stamps: toStringArray(entry.stamps),
        colors: toStringArray(entry.moodColors),
      }));

      const digest = buildTrendDigest(rows, setting.user.timezone);
      const generated = await trendCards(setting.userId, digest);
      const observations = generated ?? fallbackTrendCards(rows);
      if (!observations.length) continue;

      const weekKey = isoWeekKey(now);
      // One card per observation: the unique key carries the card index so a
      // fresh draft for the week replaces every card from the previous one.
      await prisma.diaryArtifact.deleteMany({
        where: { userId: setting.userId, kind: "trend_card", periodKey: { startsWith: `${weekKey}:` } },
      });
      await prisma.diaryArtifact.createMany({
        data: observations.map((observation, index) => ({
          userId: setting.userId,
          kind: "trend_card",
          body: observation,
          meta: { week: weekKey, index, source: generated ? "model" : "local" },
          periodKey: `${weekKey}:${index}`,
        })),
      });
      cards += observations.length;
    } catch (error) {
      console.warn("[lifeos] diary trends failed for", setting.userId, error);
    }
  }

  return { ok: true, users: settings.length, cards };
}

/* -------------------------------------------------------------------------- */
/* Cron: monthly story                                                        */
/* -------------------------------------------------------------------------- */

export async function runDiaryMonthly(now = new Date()) {
  if (!diaryAiEnabled()) return { ok: true, users: 0, stories: 0, disabled: true };

  const settings = await prisma.diarySettings.findMany({
    where: { sendTextToAi: true },
    select: { userId: true, user: { select: { timezone: true } } },
    take: 500,
  });

  const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const periodKey = previousMonth.toISOString().slice(0, 7);
  let stories = 0;

  for (const setting of settings) {
    try {
      const existing = await prisma.diaryArtifact.findFirst({
        where: { userId: setting.userId, kind: "monthly_story", periodKey },
        select: { id: true },
      });
      if (existing) continue;

      const start = new Date(Date.UTC(previousMonth.getUTCFullYear(), previousMonth.getUTCMonth(), 1));
      const end = new Date(Date.UTC(previousMonth.getUTCFullYear(), previousMonth.getUTCMonth() + 1, 1));

      const entries = await prisma.diaryEntry.findMany({
        where: { userId: setting.userId, createdAt: { gte: start, lt: end }, encrypted: false },
        select: { body: true, entryDate: true },
        orderBy: { createdAt: "asc" },
        take: 60,
      });
      if (entries.length < 3) continue;

      const digest = entries
        .map((entry) => `[${entry.entryDate}] ${entry.body.replace(/\s+/g, " ").slice(0, 600)}`)
        .join("\n");
      const story = await monthlyStory(setting.userId, digest);
      if (!story) continue;

      await prisma.diaryArtifact.create({
        data: {
          userId: setting.userId,
          kind: "monthly_story",
          body: story,
          meta: { entries: entries.length, fictionalised: true },
          periodKey,
        },
      });
      stories += 1;
    } catch (error) {
      console.warn("[lifeos] diary monthly story failed for", setting.userId, error);
    }
  }

  return { ok: true, users: settings.length, stories };
}

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

export async function exportDiary(userId: string) {
  const [entries, sessions, artifacts, burn, settings] = await Promise.all([
    prisma.diaryEntry.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.diarySession.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.diaryArtifact.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.burnEntry.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.diarySettings.findUnique({ where: { userId } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    note: "Locked entries are exported as ciphertext. The passphrase is not part of this file.",
    settings: settings
      ? {
          ambientOn: settings.ambientOn,
          trendsOn: settings.trendsOn,
          sparkOn: settings.sparkOn,
          sendTextToAi: settings.sendTextToAi,
          encryptionOn: settings.encryptionOn,
        }
      : null,
    entries,
    sessions,
    artifacts,
    burn: burn.map((row) => ({ takeaway: row.takeaway, createdAt: row.createdAt })),
  };
}

/* -------------------------------------------------------------------------- */
/* Aggregate for the home screen                                              */
/* -------------------------------------------------------------------------- */

export async function diaryStats(userId: string) {
  const [entries, monthRows, sessionCount] = await Promise.all([
    prisma.diaryEntry.count({ where: { userId } }),
    prisma.diaryEntry.findMany({
      where: { userId, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      select: { createdAt: true },
    }),
    prisma.diarySession.count({ where: { userId } }),
  ]);

  const days = new Set(monthRows.map((row) => row.createdAt.toISOString().slice(0, 10)));

  return { total: entries, last30: monthRows.length, daysWritten30: days.size, sessions: sessionCount };
}

export { advocateFromTurns, MAX_SESSION_TURNS };
