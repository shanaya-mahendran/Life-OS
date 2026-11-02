/** Shared authorization for cron endpoints (same contract as the existing jobs). */
export function cronAuthorised(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : header;
  return bearer === secret;
}

export function cronConfigured(): boolean {
  return process.env.NODE_ENV !== "production" || Boolean(process.env.CRON_SECRET);
}
