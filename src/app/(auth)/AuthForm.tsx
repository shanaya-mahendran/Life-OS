"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, Loader2, Lock, Mail, Sparkles, User } from "lucide-react";
import { signInAction, signUpAction, demoSignInAction, type AuthState } from "./actions";

interface AuthFormProps {
  mode: "signin" | "signup";
  next?: string;
  notice?: string;
}

export function AuthForm({ mode, next, notice }: AuthFormProps) {
  const action = mode === "signin" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});

  return (
    <div className="surface mx-auto w-full max-w-[26rem] p-7 sm:p-8">
      <div className="mb-7 space-y-1.5">
        <h2 className="font-display text-[1.6rem] font-semibold tracking-tight text-white">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h2>
        <p className="text-[0.82rem] text-white/45">
          {mode === "signin"
            ? "Sign in to open your plan for today."
            : "Eighteen domains and a protected-week planner, ready in a minute."}
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next ?? "/today"} />

        {mode === "signup" && (
          <label className="block space-y-1.5">
            <span className="label">Full name</span>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Shanaya Mahendran"
                className="field pl-9"
              />
            </div>
          </label>
        )}

        <label className="block space-y-1.5">
          <span className="label">Email</span>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="field pl-9"
            />
          </div>
        </label>

        <label className="block space-y-1.5">
          <span className="label">Password</span>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder={mode === "signin" ? "Your password" : "At least 8 characters"}
              className="field pl-9"
            />
          </div>
        </label>

        {state.error && (
          <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {state.error}
          </p>
        )}
        {state.notice && (
          <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            {state.notice}
          </p>
        )}
        {notice && !state.error && (
          <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            That link has expired. Sign in again or request a new one.
          </p>
        )}

        <button type="submit" disabled={pending} className="btn btn-primary mt-2 w-full py-2.5">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {mode === "signin" ? "Sign in" : "Create account"}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <div className="relative my-5 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <span className="relative bg-[#13111c] px-3 text-[0.72rem] text-white/40">or instant preview</span>
      </div>

      <form action={demoSignInAction}>
        <button
          type="submit"
          className="btn btn-ghost w-full justify-center border border-white/10 bg-white/[0.03] py-2.5 text-xs font-semibold text-white/80 hover:bg-white/[0.08]"
        >
          <Sparkles className="h-3.5 w-3.5 text-violet-300" /> Continue in Demo Mode (Instant)
        </button>
      </form>

      <p className="mt-6 text-center text-[0.78rem] text-white/40">
        {mode === "signin" ? (
          <>
            New to LifeOS?{" "}
            <Link href="/register" className="font-semibold text-violet-300 hover:text-violet-200">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have one?{" "}
            <Link href="/login" className="font-semibold text-violet-300 hover:text-violet-200">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
