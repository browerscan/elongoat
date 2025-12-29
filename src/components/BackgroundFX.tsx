export function BackgroundFX() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.22),transparent_55%),radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.18),transparent_45%),radial-gradient(circle_at_70%_80%,rgba(236,72,153,0.16),transparent_50%)]" />
      <div className="absolute inset-0 opacity-[0.55] [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black via-black/80 to-black" />
    </div>
  );
}
