# LifeOS Agent

> One chat message, one master calendar. Career, studies, competitions, health, finances and personal life organized by an intelligent planning agent.

LifeOS Agent is a modern Next.js web application built with TypeScript, React 19, Tailwind CSS, Supabase, Prisma, and DeepSeek AI.

For a fuller, source-oriented inventory of implemented functionality, optional modules, integrations, and known limits, see the [project functionality report](./report.md).

---

## Features

- **18 Unified Life Domains**: Pre-configured domains covering Career, Academics, Competitions, Health, Finance, Deep Work, Personal Growth, and more.
- **Natural Language Orchestrator**: Chat interface powered by DeepSeek with an automatic, deterministic rule-based fallback engine.
- **Protected Time & Conflict Resolution**: Automatically avoids booking over sleep, protected focus hours, and prior commitments.
- **Task Hierarchy & Priorities**: Organize work into deadline-aware main tasks and scheduled subtasks, with progress/risk rollups, calendar-linked sessions, and a reorderable all-priorities view.
- **Automated Briefs & Reviews**:
  - Daily Morning Brief (`/api/cron/brief`)
  - Sunday Weekly Review (`/api/cron/review`)
- **Full Undo/Redo Audit Trail**: Every automated schedule mutation is logged and reversible with one click.
- **Master Calendar & Today Dashboard**: Clean multi-view agenda, day schedule, and quick-add actions.

### Sections in the sidebar

The app also includes three optional first-class sections beside the domains. Each one sits behind its own flag and returns 404 when disabled, so turning a flag off restores the exact previous behaviour.

| Section | Flag | Routes |
|---|---|---|
| Reset Plan (90-day program) | `RESET_PLAN_ENABLED` | `/reset`, `/reset/audit`, `/reset/gap`, `/reset/builder`, `/reset/plan`, `/reset/notebook`, `/reset/reports`, `/reset/finish`, `/reset/settings` |
| Habit Tracker | `HABIT_TRACKER_ENABLED` | `/habits`, `/habits/goals/[id]` |
| Diary Mode | `DIARY_ENABLED` | `/diary`, `/diary/entry/[id]`, `/diary/session/[id]`, `/diary/burn`, `/diary/stories`, `/diary/settings` |

**Diary Mode** keeps the AI quiet: one cached structured call per entry returns two mood colours, three emoji stamps, a one-line silver lining and the next day's spark. Deep modes (alter-ego, Devil's Advocate, Creative Collaborator) run only when opened, are capped at a fixed number of turns, and store a transcript you can delete. The Burn Diary never persists the original text — only the takeaway is written. Locked entries are AES-GCM ciphertext produced in the browser; the passphrase never reaches the server.

```bash
# apply the additive diary tables (six new tables, no existing table altered)
npm run db:push
```

Optional environment variables: `OPENROUTER_API_KEY` and `OPENROUTER_API_KEY_2` (preferred provider; `OPENROUTER_MODEL` defaults to `openai/gpt-4o`), or `GROQ_API_KEY` as a fallback. `DIARY_ENABLED` / `NEXT_PUBLIC_DIARY_ENABLED` (`false` hides the section), `DIARY_AI_ENABLED=false` (keeps the diary, disables every model call), and `DIARY_MODEL` (defaults to the active agent model) also apply. With no model key configured the diary still saves; the page simply stays neutral.

---

## Getting Started Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Create a `.env.local` and `.env` file based on `.env.example`.

3. **Initialize database**:
   ```bash
   npm run setup
   ```
   This pushes the Prisma schema, seeds the domains, and backfills existing tasks into subtasks. For an existing production database, see the backfill step in [DEPLOYMENT.md](./DEPLOYMENT.md).

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Run test suite**:
   ```bash
   npm test
   ```

6. **Cron endpoints** (protected by `CRON_SECRET`):
   Vercel's free plan allows only two cron jobs, so `vercel.json` schedules exactly two and the daily job drives the rest:
   - `/api/cron/brief` (daily) — morning briefs, then reset check-ins/reviews, plus diary trends on Mondays and the monthly reset report + diary story on the 1st.
   - `/api/cron/review` (Sundays) — weekly review.
   - These stay available for manual runs or paid plans with more jobs: `/api/cron/reset-daily`, `/api/cron/reset-review`, `/api/cron/reset-month`, `/api/cron/diary-trends`, `/api/cron/diary-month`.

---

## Deploying to Vercel

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the step-by-step Vercel deployment guide and environment configuration.
