# Deploying LifeOS to Vercel

This guide walks you through deploying **LifeOS Agent** to [Vercel](https://vercel.com) with Supabase (Auth & Postgres) and an optional OpenRouter or Groq model provider.

---

## 1. Prerequisites

- A [Vercel](https://vercel.com) account
- A GitHub repository containing this code
- Your [Supabase](https://supabase.com) project credentials
- An [OpenRouter](https://openrouter.ai) API key (optional; falls back to Groq if configured, then the deterministic rules engine)

---

## 2. Push Code to GitHub

Initialize Git (if not already done) and push the repository to GitHub:

```bash
git init
git add .
git commit -m "feat: complete LifeOS Agent for Vercel deployment"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/lifeos-agent.git
git push -u origin main
```

---

## 3. Import Project in Vercel

1. Log into [vercel.com](https://vercel.com) and click **"Add New..." → "Project"**.
2. Select your GitHub repository (`lifeos-agent`).
3. Leave **Framework Preset** as **Next.js**.
4. Root Directory: `./` (default).
5. Build and Output Settings:
   - **Build Command**: `prisma generate && next build` (detected automatically from `package.json`).
   - **Install Command**: `npm install` (runs `postinstall` to generate Linux Prisma binaries).

---

## 4. Configure Environment Variables in Vercel

Add the following environment variables under **Settings → Environment Variables** in your Vercel project:

| Variable Name | Value Description | Example / Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | `https://xkosypxxmdxwcssnrelr.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Public Key | From Supabase → Project Settings → API |
| `DATABASE_URL` | Postgres pooler connection string | `postgresql://postgres.<project-ref>:<encoded-password>@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10&pool_timeout=20` |
| `DIRECT_URL` | Direct Postgres connection string | `postgresql://postgres.<project-ref>:<encoded-password>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres` |
| `NEXT_PUBLIC_APP_URL` | Production URL of your app | `https://your-project.vercel.app` |
| `OPENROUTER_API_KEY` | Preferred OpenRouter API key | Server-side only |
| `OPENROUTER_API_KEY_2` | Optional second OpenRouter key for failover | Server-side only |
| `OPENROUTER_MODEL` | OpenRouter model | Defaults to `openai/gpt-4o` |
| `GROQ_API_KEY` | Optional fallback Groq API key | Server-side only |
| `GROQ_API_KEY_2` | Optional second Groq key for failover | Server-side only |
| `GROQ_MODEL` | Groq fallback model | Defaults to `openai/gpt-oss-120b` |
| `CRON_SECRET` | Secret token for Vercel Cron jobs | Generate random hex: `openssl rand -hex 32` |
| `MONTHLY_TOKEN_BUDGET` | Max LLM tokens per user per month | `2000000` |
| `RESET_PLAN_ENABLED` / `HABIT_TRACKER_ENABLED` | Show the Reset Plan and Habit Tracker sections | `true` (set `false` to hide) |
| `DIARY_ENABLED` | Show the Diary section | `true` (set `false` to hide) |
| `DIARY_AI_ENABLED` | Master switch for every diary model call | `true` |
| `DIARY_MODEL` | Optional model override for the diary layer | Defaults to the active agent model |

> [!NOTE]
> Ensure special characters in the database password (such as `'`, `"`, `,`) are URL-encoded (`%27`, `%22`, `%2C`) in `DATABASE_URL` and `DIRECT_URL`.

### Apply the Prisma schema to production

This project does not have a `prisma/migrations` directory, so Vercel's build does not create database tables. Before first use, run `npx prisma db push` from the project root using the production `DATABASE_URL` and `DIRECT_URL` from Vercel.

Make sure both URLs point to the **same Supabase project**: `DATABASE_URL` should use the pooler (port `6543`) and `DIRECT_URL` the direct connection (port `5432`). Set them in your local shell to the Vercel production values, then run:

```powershell
npx prisma db push
```

Confirm Prisma reports that the database is in sync. Do not add `prisma db push` to the Vercel build command; apply schema changes deliberately before deploying them.

---

## 5. Configure Supabase Auth Redirects

In the [Supabase Dashboard](https://supabase.com/dashboard):
1. Go to **Authentication → URL Configuration**.
2. Set **Site URL** to your Vercel production domain:
   ```
   https://your-project.vercel.app
   ```
3. Under **Redirect URLs**, add:
   ```
   https://your-project.vercel.app/**
   https://your-project.vercel.app/auth/callback
   ```

---

## 6. Automated Features Configured

- **Prisma Serverless Engine**: `prisma/schema.prisma` is pre-configured with `binaryTargets = ["native", "rhel-openssl-3.0.x"]` for Vercel's AWS Lambda runtime.
- **Vercel Crons**: `vercel.json` automatically schedules:
  - Daily Morning Brief: `/api/cron/brief` (01:00 UTC)
  - Sunday Weekly Review: `/api/cron/review` (14:00 UTC)

  The free plan allows only **two** cron jobs, so the daily brief job also runs the Reset check-in/review sweep, the diary trend draft on Mondays and, on the 1st, the monthly reset report and diary story. The dedicated endpoints (`/api/cron/reset-*`, `/api/cron/diary-*`) still exist for manual runs or a plan that allows more jobs — add them to `vercel.json` only if your plan supports it.
  Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` for scheduled triggers.
- **Resilient AI Execution**: If configured model keys experience rate limits or balance limits, LifeOS tries the next key before falling back to its deterministic scheduling rules engine.
