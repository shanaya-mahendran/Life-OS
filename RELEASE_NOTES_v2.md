# LifeOS v2.0.0 — Reset Plan, Habit Tracker & Diary Mode

LifeOS started as one chat message that builds your calendar. Version 2 turns it into a system you live inside: a 90-day reset you can actually follow, a habit tracker that shows the truth without shaming you, and a private diary where the AI stays quiet unless you ask it to speak.

Everything additive. Every new section sits behind its own flag, and turning a flag off restores the exact v1 behaviour.

---

## Highlights

### 🧭 Reset Plan — a 90-day program, one vertical slice at a time

A guided Reset that moves from audit to action without ever booking your calendar behind your back.

- **3-step audit** — where you are now, where you should be in 90 days, what happened last time you tried.
- **Gap report** you can edit and approve — patterns, top gaps, cut candidates, anchor candidates, recommended focus.
- **Plan builder across three phases** with per-kind limits: cuts and anchors for Month 1, routines, non-negotiables, challenges and goals for Months 2–3. Phases unlock explicitly; crossing day 30 does not move you forward on its own.
- **Calendar sync that asks first.** Blocks are previewed, conflicts are surfaced, and nothing is written until you approve — with a one-click undo for the whole batch.
- **Daily check-ins** (done / skipped / missed) with streaks, adherence, per-commitment stats, and drift detection that offers *move*, *make lighter*, *drop* or *dismiss* instead of guilt.
- **Weekly review notebook** with the three questions that matter, plus weekly and monthly period reports.
- **Finish and start again** — close the cycle, archive its habits and goals, and open a lighter next cycle.
- **Privacy and control** — choose whether audit answers go to the model, per-notification toggles, full JSON export, and delete.

### 🔁 Habit Tracker — the plan, made visible

- Habits generated from Reset commitments and standalone habits you add yourself.
- Daily and weekly cadence, 7-day and 30-day views, current and best streak, completion rate.
- **Goal tracks** with a metric, unit and target — log progress and see the ring move.
- Same check-in data as the Reset Plan, so a tick in one place is a tick everywhere.

### 📔 Diary Mode — ambient AI as a design engine, not a conversationalist

The centre of v2: the model never talks back unless you open a mode and ask.

**The quiet layer.** One cached structured call per entry returns two mood colours, three emoji stamps, a one-line silver lining and the next spark. It drives three visible touches and nothing else:

- the page's **living gradient** shifts to your entry's mood;
- **capsule stamps** collect into a grid over months;
- a **silver lining** line sits under the entry — editable, deletable, and it stays deleted.

If the call fails or no key is configured, the page falls back to a neutral theme and the entry still saves. Re-rendering never calls the model again.

**Deep modes, opt-in and bounded.** Alter-ego personas (Stoic, Renaissance artist, futurist you at 60, blunt editor, gentle mentor), Devil's Advocate with distortion spotting and gentler reframes, and Creative Collaborator seeds that pin to an idea shelf. Every session has a turn counter, a visible end, and a transcript you can delete.

**Longitudinal, never surveillance.** Weekly trend cards from ambient metadata only, Blind Spot reminders when a new entry rhymes with an old one, and a monthly entry compiled into a clearly fictionalised short story you can keep, edit, export or delete.

**Burn Diary.** Write, send for analysis, get one or two sentences back — and the original is deleted in the same transaction that saves the takeaway. Only the takeaway and a timestamp remain. There is no undo, and the screen says so before you type.

**Locked entries.** Optional client-side AES-GCM encryption with a recovery phrase you hold. The server stores ciphertext; the passphrase never reaches it.

**Guardrails.** Serious distress pauses diary AI for the day, responds with care, and surfaces support lines. Devil's Advocate refuses crisis entries. Every AI feature has an off switch.

### 🛠 Platform and reliability

- **Vercel Hobby–safe crons:** exactly two scheduled jobs. The daily job drives morning briefs, reset check-ins and reviews, diary trends on Mondays and the monthly report + story on the 1st — with a time budget so a 60s function limit can't kill it mid-run.
- **Fixed first-use race conditions.** Concurrent requests were creating the same settings/domain row twice and throwing `P2002` / unique-constraint 500s. Lazy rows are now created once and re-read on collision.
- **Mochi** on Groq `openai/gpt-oss-120b`, with the deterministic rules engine as fallback and a monthly token budget guard.
- Top priorities, notification feed, mobile sidebar and safe-area footer, recurring events, flexible durations, 20-hour focus cap, quick-add, PWA install fixes, and on-demand alerts.

---

## Under the hood

| Area | Change |
|---|---|
| Database | Additive migration: 8 Reset tables, 4 Habit/Goal tables, 6 Diary tables. No existing table altered. |
| API | `/api/reset/*`, `/api/habits/*`, `/api/diary/*` — all per-user scoped and origin-checked for mutations. |
| Crons | `/api/cron/brief` (daily), `/api/cron/review` (Sundays); reset and diary jobs also callable directly. |
| AI | Server-side only. Structured JSON schemas, cached per entry, `GROQ_API_KEY` never reaches the browser. |
| Flags | `RESET_PLAN_ENABLED`, `HABIT_TRACKER_ENABLED`, `DIARY_ENABLED`, `DIARY_AI_ENABLED`. |
| Tests | Reset calculations, diary rules (distress detection, sparks, echoes, metadata digest), conflicts, recurrence, time zones, NLU. |

---

## Upgrading from v1

1. **Apply the schema** (no migrations folder — this project uses push):
   ```bash
   DATABASE_URL="<pooler-6543>" DIRECT_URL="<direct-5432>" npx prisma db push
   ```
2. **Add the new environment variables:**
   ```env
   RESET_PLAN_ENABLED="true"
   HABIT_TRACKER_ENABLED="true"
   DIARY_ENABLED="true"
   DIARY_AI_ENABLED="true"      # false = diary works, every model call disabled
   # DIARY_MODEL="openai/gpt-oss-120b"
   ```
   `CRON_SECRET` is now required in production for every cron endpoint.
3. **Set `NEXT_PUBLIC_APP_URL`** to the deployed origin, and add `<origin>/auth/callback` to Supabase → Authentication → URL Configuration.
4. **Rebuild.** `npm run build` runs `prisma generate` first.

---

## Known limits

- Vercel Hobby allows two cron jobs; the schedules are consolidated by design. Direct endpoints remain available for manual runs or paid plans.
- The daily cron processes up to 500 accounts per run and stops starting new work near the function timeout — the next run picks up the remainder.
- Diary Mode is text-only in v1. No voice, no images, no shared journals.
- If you enable entry encryption and lose your recovery phrase, the entries cannot be recovered. That is the point of the key, and the UI says so.

---

**Full diff:** `v1.0.0...v2.0.0`
**Suggested tag:** `v2.0.0`
