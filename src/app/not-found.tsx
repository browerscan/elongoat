import Link from "next/link";

export default function NotFound() {
  return (
    <div className="glass glow-ring mx-auto max-w-2xl rounded-3xl p-8 text-center">
      <div className="text-xs uppercase tracking-widest text-white/50">404</div>
      <h1 className="mt-3 text-balance text-3xl font-semibold text-white">
        Lost in deep space.
      </h1>
      <p className="mt-2 text-sm text-white/65">
        This route doesn’t exist (or hasn’t been generated yet). Try a topic hub
        or the Q&A index.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href="/topics"
          className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          Browse topics
        </Link>
        <Link
          href="/q"
          className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
        >
          Browse Q&A
        </Link>
      </div>
    </div>
  );
}
