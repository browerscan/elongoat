"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CornerDownLeft,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Shield,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

import { deriveChatUx, shouldGlitchText } from "@/lib/chatUi";

const MAX_INPUT_CHARS = 2000;
const SEND_DEBOUNCE_MS = 300;
const TYPING_INDICATOR_DELAY = 600;

type Role = "user" | "assistant";
type ChatItem = {
  id: string;
  role: Role;
  content: string;
  error?: boolean;
};

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getViewportLabel(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname || "/";
}

/**
 * Improved ChatWidget with production-grade UX:
 * - Debounced send button (prevents double-submit)
 * - Character counter with visual feedback
 * - Network failure indicator with retry
 * - Better scrolling behavior
 * - Auto-focus input on mount
 * - Clear chat button with confirmation
 * - Accessibility improvements
 */
export function ChatWidget() {
  const pathname = usePathname() ?? "/";
  const ux = useMemo(() => deriveChatUx(pathname), [pathname]);

  const [open, setOpen] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [lastSendTime, setLastSendTime] = useState(0);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);
  const typingTimerRef = useRef<number | null>(null);

  const [messages, setMessages] = useState<ChatItem[]>(() => [
    {
      id: uid(),
      role: "assistant",
      content: deriveChatUx(getViewportLabel()).initialAssistantMessage,
    },
  ]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  // Character count logic
  const characterCount = input.length;
  const characterLimitReached = characterCount >= MAX_INPUT_CHARS;
  const characterNearLimit = characterCount >= MAX_INPUT_CHARS * 0.9;
  const characterCountColor = characterLimitReached
    ? "text-danger"
    : characterNearLimit
      ? "text-yellow-500"
      : "text-white/40";

  const canSend = useMemo(
    () =>
      input.trim().length > 0 &&
      !streaming &&
      !characterLimitReached &&
      Date.now() - lastSendTime > SEND_DEBOUNCE_MS,
    [input, streaming, characterLimitReached, lastSendTime],
  );

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 120;
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
  }, [input]);

  // Auto-focus input when chat opens
  useEffect(() => {
    if (open && isInitialMount.current) {
      // Small delay to ensure animation has started
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
    isInitialMount.current = false;
  }, [open]);

  // Focus input when opening chat (not just initial mount)
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Update initial message based on page
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length !== 1) return prev;
      const first = prev[0];
      if (!first || first.role !== "assistant") return prev;
      if (first.content === ux.initialAssistantMessage) return prev;
      return [{ ...first, content: ux.initialAssistantMessage }];
    });
  }, [ux.initialAssistantMessage]);

  // Nudge timer
  useEffect(() => {
    const timer = window.setTimeout(() => setNudge(true), 15_000);
    return () => window.clearTimeout(timer);
  }, []);

  // External open event
  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setNudge(false);
    };
    window.addEventListener("elongoat:chat:open", handler as EventListener);
    return () =>
      window.removeEventListener(
        "elongoat:chat:open",
        handler as EventListener,
      );
  }, []);

  // Improved scroll to bottom with smooth behavior
  useEffect(() => {
    if (!open) return;

    // Use requestAnimationFrame for smoother scrolling
    const rafId = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });

    return () => cancelAnimationFrame(rafId);
  }, [messages, open]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (!streaming || !open) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    // Scroll more frequently during streaming
    const intervalId = setInterval(() => {
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        100;

      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [streaming, open]);

  // Typing indicator with delay
  useEffect(() => {
    if (streaming) {
      typingTimerRef.current = window.setTimeout(() => {
        setShowTypingIndicator(true);
      }, TYPING_INDICATOR_DELAY);
    } else {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      setShowTypingIndicator(false);
    }

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, [streaming]);

  // Clear messages with confirmation reset
  useEffect(() => {
    if (!open) {
      setShowClearConfirm(false);
    }
  }, [open]);

  const send = useCallback(
    async (text: string, isRetry = false) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Debounce check
      const now = Date.now();
      if (now - lastSendTime < SEND_DEBOUNCE_MS && !isRetry) {
        return;
      }

      setOpen(true);
      setNudge(false);
      setStreaming(true);
      setNetworkError(null);
      setRetryMessage(null);
      setLastSendTime(now);

      // Check if we're retrying the last message
      const lastMsg = messages[messages.length - 1];
      const isRetryingError = lastMsg?.error && isRetry;

      let userMsg: ChatItem;
      let assistantMsg: ChatItem;

      if (isRetryingError) {
        // Reuse existing messages, just clear the error
        assistantMsg = { ...lastMsg, content: "", error: undefined };
        userMsg = messages[messages.length - 2];
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? assistantMsg : m)),
        );
      } else {
        userMsg = { id: uid(), role: "user", content: trimmed };
        assistantMsg = {
          id: uid(),
          role: "assistant",
          content: "",
        };
        setMessages((prev) => [...prev, userMsg, assistantMsg]);
      }

      if (!isRetryingError) {
        setInput("");
      }

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL
          ? `${process.env.NEXT_PUBLIC_API_URL}/api/chat`
          : "/api/chat";
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            context: { currentPage: getViewportLabel() },
          }),
        });

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({}));
          const msg =
            typeof err?.error === "string"
              ? err.error
              : "Chat error. Please retry.";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: msg, error: true }
                : m,
            ),
          );
          setNetworkError(msg);
          setRetryMessage(trimmed);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const lines = part.split("\n");
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine.startsWith("data:")) continue;
              const data = trimmedLine.slice(5).trim();

              if (data === "[DONE]") {
                break;
              }

              if (!data) continue;

              try {
                const evt = parseChatEvent(data);
                if (!evt) continue;

                if (evt.type === "delta") {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsg.id
                        ? { ...m, content: m.content + evt.delta }
                        : m,
                    ),
                  );
                }
                if (evt.type === "error") {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsg.id
                        ? {
                            ...m,
                            content: "Upstream error. Please retry.",
                            error: true,
                          }
                        : m,
                    ),
                  );
                  setNetworkError("Upstream error. Please retry.");
                  setRetryMessage(trimmed);
                }
              } catch {
                // ignore malformed events
              }
            }
          }
        }
      } catch {
        const errorMsg = "Network error. Please retry.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: errorMsg, error: true }
              : m,
          ),
        );
        setNetworkError(errorMsg);
        setRetryMessage(trimmed);
      } finally {
        setStreaming(false);
      }
    },
    [lastSendTime, messages],
  );

  const handleClearChat = useCallback(() => {
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      return;
    }

    setMessages([
      {
        id: uid(),
        role: "assistant",
        content: ux.initialAssistantMessage,
      },
    ]);
    setShowClearConfirm(false);
    setNetworkError(null);
    setRetryMessage(null);
  }, [showClearConfirm, ux.initialAssistantMessage]);

  const handleRetry = useCallback(() => {
    if (retryMessage) {
      void send(retryMessage, true);
    }
  }, [retryMessage, send]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (canSend) void send(input);
      }
      // Escape to close chat
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    },
    [input, canSend, send, open],
  );

  const hasMessagesBeyondInitial = messages.length > 1;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 sm:bottom-4 sm:right-4"
      role="region"
      aria-label="Chat widget"
    >
      <AnimatePresence>
        {open ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="glass glow-ring w-[calc(100vw-2rem)] overflow-hidden rounded-3xl sm:w-[360px] md:w-[400px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/30 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  <Image
                    alt="ElonGoat"
                    src="/favicon.svg"
                    width={28}
                    height={28}
                    className="opacity-90"
                  />
                  {streaming && (
                    <span className="absolute bottom-0 right-0 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">
                    ElonSim Chat
                  </div>
                  <div
                    className="truncate text-xs text-white/55"
                    aria-live="polite"
                  >
                    {networkError
                      ? "Connection lost"
                      : streaming
                        ? ux.loadingLabel
                        : "Streaming • no history saved"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Clear chat button */}
                {hasMessagesBeyondInitial && (
                  <button
                    type="button"
                    className={`rounded-xl border p-2 text-white/70 transition ${
                      showClearConfirm
                        ? "border-danger bg-danger/20 text-danger hover:bg-danger/30"
                        : "border-white/10 bg-white/5 hover:bg-white/10 hover:text-white"
                    }`}
                    onClick={handleClearChat}
                    aria-label={
                      showClearConfirm ? "Confirm clear" : "Clear chat"
                    }
                    title={
                      showClearConfirm ? "Click again to confirm" : "Clear chat"
                    }
                  >
                    {showClearConfirm ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                )}

                <button
                  id="chat-close"
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                  onClick={() => setOpen(false)}
                  aria-label="Close chat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="max-h-[50vh] overflow-y-auto px-3 py-3 sm:max-h-[52vh] sm:px-4 sm:py-4"
              role="log"
              aria-live="polite"
              aria-atomic="false"
            >
              {/* Quick start buttons */}
              {!hasMessagesBeyondInitial && (
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {ux.quickStart.slice(0, 4).map((q) => (
                    <button
                      key={q}
                      type="button"
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 transition hover:border-white/20 hover:bg-white/10 sm:px-3 sm:text-xs active:bg-white/15 disabled:opacity-50"
                      onClick={() => void send(q)}
                      disabled={streaming}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Messages */}
              <div className="mt-4 space-y-3">
                {messages.map((m, idx) => (
                  <div
                    key={m.id}
                    className={
                      m.role === "user"
                        ? "flex justify-end"
                        : "flex justify-start"
                    }
                  >
                    <div
                      className={
                        m.role === "user"
                          ? "max-w-[85%] rounded-2xl bg-white px-4 py-3 text-sm text-black"
                          : [
                              "max-w-[85%] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80",
                              shouldGlitchText(m.content) ? "glitch-text" : "",
                              m.error ? "border-danger/50" : "",
                            ].join(" ")
                      }
                    >
                      {m.role === "assistant" &&
                      streaming &&
                      !m.content &&
                      idx === messages.length - 1 ? (
                        showTypingIndicator ? (
                          <span className="inline-flex items-center gap-2 text-white/65">
                            <span className="flex gap-1">
                              <span className="h-2 w-2 animate-pulse rounded-full bg-white/60" />
                              <span className="h-2 w-2 animate-pulse rounded-full bg-white/60 delay-75" />
                              <span className="h-2 w-2 animate-pulse rounded-full bg-white/60 delay-150" />
                            </span>
                            <span className="text-xs">{ux.loadingLabel}</span>
                          </span>
                        ) : (
                          <span className="text-white/40">...</span>
                        )
                      ) : m.error ? (
                        <div className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
                          <div>
                            <div>{m.content}</div>
                            <button
                              type="button"
                              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-danger/20 px-2 py-1 text-xs text-danger transition hover:bg-danger/30"
                              onClick={handleRetry}
                              aria-label="Retry sending message"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Retry
                            </button>
                          </div>
                        </div>
                      ) : (
                        renderMessage(m.content)
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-white/10 bg-black/30 p-2.5 sm:p-3">
              <div className="flex items-end gap-2">
                <div className="relative flex-1">
                  <textarea
                    ref={inputRef}
                    id="chat-input"
                    value={input}
                    onChange={(e) => {
                      const newVal = e.target.value;
                      if (newVal.length <= MAX_INPUT_CHARS) {
                        setInput(newVal);
                      }
                    }}
                    placeholder={ux.inputPlaceholder}
                    rows={1}
                    maxLength={MAX_INPUT_CHARS}
                    className="min-h-[40px] w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-3 py-2.5 pr-16 text-sm text-white placeholder:text-white/40 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 sm:min-h-[44px] sm:px-4 sm:py-3"
                    onKeyDown={handleKeyDown}
                    disabled={streaming}
                    aria-describedby="chat-character-count"
                    aria-label="Type your message"
                  />
                  {/* Character counter */}
                  <div
                    id="chat-character-count"
                    className={`absolute bottom-2 right-2.5 text-[10px] sm:bottom-2.5 sm:right-3.5 sm:text-[11px] ${characterCountColor}`}
                    aria-live="polite"
                  >
                    {characterCount}/{MAX_INPUT_CHARS}
                  </div>
                </div>

                <button
                  id="chat-send"
                  type="button"
                  className="inline-flex h-[40px] w-[40px] flex-shrink-0 items-center justify-center rounded-2xl bg-white text-black transition hover:bg-white/90 disabled:opacity-50 sm:h-[44px] sm:w-[44px] active:scale-95"
                  disabled={!canSend}
                  onClick={() => void send(input)}
                  aria-label={
                    streaming
                      ? "Sending message"
                      : canSend
                        ? "Send message"
                        : "Cannot send empty message"
                  }
                >
                  {streaming ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <CornerDownLeft className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>

              {/* Footer info */}
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/45 sm:mt-2 sm:text-[11px]">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <Shield className="h-3 w-3 flex-shrink-0 sm:h-3.5 sm:w-3.5" />
                  <span className="truncate">
                    Keys stay server-side. This is a simulation.
                  </span>
                </div>

                {/* Keyboard hint */}
                <span className="hidden sm:inline text-white/30">
                  Enter to send
                </span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="button"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative"
          >
            <AnimatePresence>
              {nudge ? (
                <motion.div
                  key="nudge"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18 }}
                  className="absolute bottom-14 right-0 w-[240px] rounded-2xl border border-white/10 bg-black/50 p-2.5 text-sm text-white/80 backdrop-blur-xl sm:w-[280px] sm:p-3"
                >
                  <div className="flex items-start gap-2">
                    <Sparkles
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-white/70"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-white">
                        {ux.nudgeTitle}
                      </div>
                      <div className="mt-1 text-xs text-white/60">
                        {ux.nudgeBody}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg p-1 text-white/50 hover:text-white"
                      onClick={() => setNudge(false)}
                      aria-label="Dismiss notification"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <button
              id="chat-open"
              type="button"
              className="glass glow-ring group flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
              onClick={() => {
                setOpen(true);
                setNudge(false);
              }}
              aria-label="Open chat"
            >
              <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <Image
                  alt="ElonGoat"
                  src="/favicon.svg"
                  width={28}
                  height={28}
                  className="opacity-90"
                />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  Chat <MessageSquareText className="h-4 w-4 text-white/70" />
                </span>
                <span className="block truncate text-xs text-white/55">
                  {ux.buttonTagline}
                </span>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Safely render markdown content with XSS protection.
 * Uses react-markdown with rehype-sanitize to prevent injection attacks.
 */
function renderMessage(content: string): React.ReactNode {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        // Customize styling for markdown elements
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => (
          <strong className="font-semibold text-white">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-white/90">{children}</em>
        ),
        ul: ({ children }) => (
          <ul className="ml-4 list-disc space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="ml-4 list-decimal space-y-1">{children}</ol>
        ),
        li: ({ children }) => <li className="text-white/80">{children}</li>,
        code: ({ className, children }) => {
          const isInline = !className;
          return isInline ? (
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/90">
              {children}
            </code>
          ) : (
            <code className="block rounded bg-white/10 p-2 text-xs text-white/90">
              {children}
            </code>
          );
        },
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-white/70 underline underline-offset-2 hover:text-white"
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

type ChatStreamEvent =
  | { type: "delta"; delta: string }
  | { type: "error" }
  | { type: "meta" }
  | { type: "done" };

function parseChatEvent(data: string): ChatStreamEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data) as unknown;
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const type = obj["type"];
  if (type === "delta") {
    const delta = obj["delta"];
    if (typeof delta === "string") return { type: "delta", delta };
    return null;
  }
  if (type === "error") return { type: "error" };
  if (type === "meta") return { type: "meta" };
  if (type === "done") return { type: "done" };
  return null;
}
