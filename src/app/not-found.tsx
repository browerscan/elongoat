import Link from "next/link";
import { Rocket, MessageCircle, BookOpen, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="glass-premium glow-ring mx-auto max-w-lg rounded-3xl p-8 text-center">
        {/* Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
          <Rocket className="h-8 w-8 text-accent" />
        </div>

        {/* Status */}
        <div className="mt-4 text-xs uppercase tracking-widest text-white/50">
          404 - Page Not Found
        </div>

        {/* Title */}
        <h1 className="mt-3 text-balance text-3xl font-semibold text-white">
          Lost in deep space
        </h1>

        {/* Description */}
        <p className="mt-3 text-sm leading-relaxed text-white/65">
          This route doesn&apos;t exist or hasn&apos;t been generated yet.
          Let&apos;s get you back on course.
        </p>

        {/* Primary Actions */}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="btn-launch inline-flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        {/* Secondary Actions */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            href="/topics"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Topics
          </Link>
          <Link
            href="/q"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Q&A
          </Link>
        </div>
      </div>
    </div>
  );
}
