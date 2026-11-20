# LifeOS Project Functionality Report

## Scope and status

LifeOS is a Next.js web application for organizing personal planning in one place. Its implemented product areas are the planning agent and calendar, plus three optional modules: Reset Plan, Habit Tracker, and Diary Mode. "Implemented" here means the repository contains the screens and supporting application logic; whether a module is visible or an integration runs in a deployment can still depend on feature flags, credentials, database setup, and scheduled-job configuration.

This report describes functionality evidenced by the application and its repository documentation. It does not treat roadmap ideas or unconfigured integrations as live. The source pointers at the end identify representative implementation files; the application's route tree and environment configuration provide the complete operational details.

## Application foundation

- **Web application:** Next.js with React and TypeScript, styled with Tailwind CSS.
- **Persistence:** Prisma models backed by the configured database. Supabase is used for authentication and related account flows.
- **Application shell:** Shared layout, navigation, domain workspaces, and onboarding provide access to the planning experience.
- **AI integration:** The planning experience can use a server-side model integration and has a deterministic rules-based fallback. Diary AI is separately configurable and can be disabled while keeping diary entries usable. Provider credentials and model availability are deployment configuration, not guaranteed runtime capabilities.
- **Progressive availability:** Reset Plan, Habit Tracker, and Diary Mode each have a feature flag. A feature being implemented does not mean it is enabled in every deployment.

## Implemented product areas

### Planning agent and life domains

- A chat workspace accepts natural-language planning requests and presents the agent's response and proposed work.
- The application organizes work into 18 configured life domains, including career, academics, competitions, health, finance, deep work, and personal growth.
- Domain workspaces provide a place to manage domain-specific planning alongside the shared calendar.
- Agent lookups and scheduling logic support the planning flow; when model-backed processing is unavailable, the deterministic rules engine provides the documented fallback.

### Master calendar and daily planning

- The master calendar and Today dashboard provide calendar/agenda views of planned commitments.
- Users can add items with quick-add and work with recurring events and flexible durations.
- Scheduling logic checks protected time and existing commitments, surfaces conflicts, and respects a 20-hour focus-time cap.
- Automated schedule changes have an audit trail with undo/redo support.
- Notification and priority surfaces make relevant work and updates visible.

### Briefs, reviews, and scheduled work

- The daily brief and weekly review are exposed through cron endpoints.
- The deployed Vercel schedule defines two jobs: `/api/cron/brief` runs daily and `/api/cron/review` runs weekly.
- The daily brief job also drives the documented Reset Plan check-ins/reviews and diary trend or monthly work when those modules are enabled. Additional reset and diary cron endpoints exist for manual invocation or deployments with different scheduling capacity.
- Cron endpoints require `CRON_SECRET` in production. Defining an endpoint does not by itself schedule it; `vercel.json` is the schedule source.

### Reset Plan (optional 90-day program)

When `RESET_PLAN_ENABLED` is on, the Reset area provides:

- A three-step audit of the user's current situation, 90-day target, and past attempts.
- An editable gap report and a plan builder organized into three phases.
- Explicit phase progression; the calendar date alone does not advance the plan.
- Proposed calendar blocks with conflict review and approval before any batch is written, plus batch undo.
- Daily commitment check-ins, streak/adherence views, and drift options to move, lighten, drop, or dismiss a commitment.
- Weekly review notes, weekly/monthly reports, cycle completion, and the option to start another cycle.
- Settings for audit/model use, notifications, export, and deletion.

The route surface documented for this module includes `/reset` and the audit, gap, builder, plan, notebook, reports, finish, and settings pages.

### Habit Tracker (optional)

When `HABIT_TRACKER_ENABLED` is on, users can:

- Track habits derived from Reset commitments or create standalone habits.
- Record daily or weekly cadence and view recent completion, streak, and adherence information.
- Create goal tracks with a metric, unit, and target, then log progress.
- Reuse check-in data shared with Reset commitments, so a completion is reflected in both areas.

The documented routes are `/habits` and `/habits/goals/[id]`.

### Diary Mode (optional, privacy-oriented)

When `DIARY_ENABLED` is on, Diary Mode provides:

- Private text entries, entry/session views, settings, and a stories area.
- An optional quiet, structured AI reflection for an entry (mood colors, emoji stamps, a silver lining, and a next-day spark). Results are cached; if AI is disabled or unavailable, entries remain usable without those generated details.
- User-initiated, bounded deep modes such as alter-ego, Devil's Advocate, and Creative Collaborator. Sessions have a turn limit and a deletable transcript.
- Weekly trend cards and monthly fictionalized stories based on diary metadata/entries.
- A Burn Diary flow that stores the takeaway rather than the original submitted text.
- Optional browser-side AES-GCM encryption for locked entries; the passphrase is not sent to the server.
- Distress/crisis guardrails and support-line handling for applicable AI flows.

`DIARY_AI_ENABLED=false` disables diary model calls without disabling the diary itself. Diary AI and model selection have their own configuration. The documented routes include `/diary`, entry/session views, burn, stories, and settings.

## Data, APIs, and operations

- Prisma defines the application's account, planning, and optional-module data.
- The Reset, Habit, and Diary modules have corresponding API route groups under `/api/reset/*`, `/api/habits/*`, and `/api/diary/*`.
- Repository documentation describes mutations as scoped to the current user and origin-checked.
- The schema changes for the v2 modules are additive; the README's database setup instruction is `npm run db:push`.
- Environment variables, database configuration, authentication callback setup, and Vercel deployment steps are described in `.env.example` and `DEPLOYMENT.md`.

## Availability and known limits

- Feature flags control visibility/availability of the three optional modules; check deployment environment settings before expecting their routes to be enabled.
- AI output depends on server-side credentials, selected model configuration, and provider availability. The documented rules fallback applies to planning; diary entries can also be saved without diary AI.
- Scheduled execution depends on the deployment's cron configuration and `CRON_SECRET`; locally or on other hosts, the endpoints may need to be invoked separately.
- Diary Mode is text-only; voice, image entries, and shared journals are not implemented in the documented release.
- Locked entries cannot be recovered if the user loses the recovery phrase.

## Representative source files

These are implementation entry points and representative feature files, not an exhaustive list of every route or helper:

| Area | Source pointers |
|---|---|
| Application shell and onboarding | `src/app/layout.tsx`, `src/app/onboarding/OnboardingForm.tsx` |
| Account and agent lookup | `src/lib/account.ts`, `src/lib/agent/lookup.ts` |
| Chat planning and domain workspace | `src/components/chat/ChatWorkspace.tsx`, `src/components/domain/DomainWorkspace.tsx` |
| Reset Plan | `src/components/reset/AuditWizard.tsx` |
| Habit Tracker and goals | `src/components/habits/HabitTracker.tsx`, `src/components/habits/GoalDetailPanel.tsx` |
| Diary | `src/components/diary/EntryEditor.tsx`, `src/components/diary/BurnForm.tsx` |
| Database and scheduled jobs | `prisma/schema.prisma`, `vercel.json` |
| Dependencies and commands | `package.json` |

## Repository documentation

- [README](README.md) - feature overview, local setup, tests, cron endpoints, and deployment entry point.
- [Deployment guide](DEPLOYMENT.md) - Vercel deployment and environment configuration.
- [v2 release notes](RELEASE_NOTES_v2.md) - release-level feature descriptions, upgrade notes, and known limits.
