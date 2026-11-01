import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-[#06040e] text-white">
      <div className="surface max-w-md w-full p-8 text-center space-y-5">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 mx-auto">
          <Compass className="h-7 w-7" />
        </div>
        <div className="space-y-1.5">
          <h2 className="font-display text-2xl font-bold tracking-tight">Page Not Found</h2>
          <p className="text-sm text-white/50">
            The page you are looking for doesn&apos;t exist or has moved.
          </p>
        </div>
        <Link
          href="/today"
          className="btn btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Today
        </Link>
      </div>
    </div>
  );
}
