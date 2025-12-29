"use client";

export function CopyPromptButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/80 transition hover:border-white/20 hover:bg-white/10"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        window.dispatchEvent(new CustomEvent("elongoat:chat:open"));
      }}
    >
      {text}
    </button>
  );
}
