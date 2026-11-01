# Deploying LifeOS to Vercel

This guide walks you through deploying **LifeOS Agent** to [Vercel](https://vercel.com) with Supabase (Auth & Postgres) and DeepSeek.

---

## 1. Prerequisites

- A [Vercel](https://vercel.com) account
- A GitHub repository containing this code
- Your [Supabase](https://supabase.com) project credentials
- Your [DeepSeek](https://platform.deepseek.com) API key (optional for LLM agent; falls back to the deterministic rules engine if omitted or empty balance)

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
| `DEEPSEEK_API_KEY` | DeepSeek API Key | `sk-...` (server-side only) |
| `DEEPSEEK_BASE_URL` | DeepSeek Base URL | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | DeepSeek Model | `deepseek-chat` |
| `CRON_SECRET` | Secret token for Vercel Cron jobs | Generate random hex: `openssl rand -hex 32` |
| `MONTHLY_TOKEN_BUDGET` | Max LLM tokens per user per month | `2000000` |

> [!NOTE]
> Ensure special characters in the database password (such as `'`, `"`, `,`) are URL-encoded (`%27`, `%22`, `%2C`) in `DATABASE_URL` and `DIRECT_URL`.

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
  Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` for scheduled triggers.
- **Resilient AI Execution**: If DeepSeek experiences rate limits or balance limits, LifeOS seamlessly degrades to its deterministic scheduling rules engine without crashing.
