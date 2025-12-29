"use client";

import { MessageSquareText } from "lucide-react";

export function OpenChatButton({
  id = "open-chat-cta",
  label = "Ask the AI now",
  className,
}: {
  id?: string;
  label?: string;
  className?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      className={
        className ??
        "inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-black/30"
      }
      onClick={() => {
        window.dispatchEvent(new CustomEvent("elongoat:chat:open"));
      }}
    >
      <MessageSquareText className="h-4 w-4" />
      {label}
    </button>
  );
}
