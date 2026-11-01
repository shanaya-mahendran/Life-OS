# LifeOS Agent

> One chat message, one master calendar. Career, studies, competitions, health, finances and personal life organized by an intelligent planning agent.

LifeOS Agent is a modern Next.js web application built with TypeScript, React 19, Tailwind CSS, Supabase, Prisma, and DeepSeek AI.

---

## Features

- **18 Unified Life Domains**: Pre-configured domains covering Career, Academics, Competitions, Health, Finance, Deep Work, Personal Growth, and more.
- **Natural Language Orchestrator**: Chat interface powered by DeepSeek with an automatic, deterministic rule-based fallback engine.
- **Protected Time & Conflict Resolution**: Automatically avoids booking over sleep, protected focus hours, and prior commitments.
- **Automated Briefs & Reviews**:
  - Daily Morning Brief (`/api/cron/brief`)
  - Sunday Weekly Review (`/api/cron/review`)
- **Full Undo/Redo Audit Trail**: Every automated schedule mutation is logged and reversible with one click.
- **Master Calendar & Today Dashboard**: Clean multi-view agenda, day schedule, and quick-add actions.

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

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Run test suite**:
   ```bash
   npm test
   ```

---

## Deploying to Vercel

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the step-by-step Vercel deployment guide and environment configuration.
