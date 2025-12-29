import { useCallback, useEffect, useRef, useState } from "react";

const MAX_INPUT_CHARS = 2000;
const SEND_DEBOUNCE_MS = 300;

export interface UseChatInputOptions {
  /** Maximum allowed characters */
  maxLength?: number;
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Callback when send is triggered */
  onSend: (message: string) => void | Promise<void>;
  /** Whether the chat is currently streaming */
  isStreaming: boolean;
}

export interface UseChatInputReturn {
  input: string;
  setInput: (value: string) => void;
  sendDisabled: boolean;
  characterCount: number;
  characterCountColor: string;
  handleSend: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  isSending: boolean;
  canSend: boolean;
  focusInput: () => void;
}

/**
 * Hook for managing chat input state with debouncing,
 * character counting, and accessibility features.
 */
export function useChatInput({
  maxLength = MAX_INPUT_CHARS,
  debounceMs = SEND_DEBOUNCE_MS,
  onSend,
  isStreaming,
}: UseChatInputOptions): UseChatInputReturn {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendTimeoutRef = useRef<number | null>(null);
  const lastSendTimeRef = useRef<number>(0);

  const characterCount = input.length;
  const characterLimitReached = characterCount >= maxLength;
  const characterCountNearLimit = characterCount >= maxLength * 0.9;

  const characterCountColor = characterLimitReached
    ? "text-danger"
    : characterCountNearLimit
      ? "text-yellow-500"
      : "text-white/40";

  const canSend = input.trim().length > 0 && !isStreaming && !isSending;

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 120; // Max height in pixels
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
  }, [input]);

  // Auto-focus input when chat opens (exported for parent components)
  const focusInput = useCallback(() => {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, [inputRef]);

  const handleSend = useCallback(() => {
    const now = Date.now();
    const timeSinceLastSend = now - lastSendTimeRef.current;

    // Prevent double-submit with debounce
    if (timeSinceLastSend < debounceMs) {
      return;
    }

    const trimmed = input.trim();
    if (!trimmed || isStreaming || isSending) {
      return;
    }

    setIsSending(true);
    lastSendTimeRef.current = now;

    // Clear input immediately for better UX
    const messageToSend = trimmed;
    setInput("");

    // Reset sending state after callback completes
    Promise.resolve(onSend(messageToSend)).finally(() => {
      setIsSending(false);
    });
  }, [input, isStreaming, isSending, onSend, debounceMs]);

  // Cleanup timeout on unmount
  useEffect(() => {
    const timeoutRef = sendTimeoutRef;
    return () => {
      const timeoutId = timeoutRef.current;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return {
    input,
    setInput,
    sendDisabled: !canSend,
    characterCount,
    characterCountColor,
    handleSend,
    inputRef,
    isSending,
    canSend,
    focusInput,
  };
}

/**
 * Hook for managing chat state including messages,
 * streaming, and network status.
 */
export interface UseChatStateOptions {
  initialMessage?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
  error?: boolean;
}

export type NetworkStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "error"
  | "success";

export function useChatState({ initialMessage }: UseChatStateOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialMessage) {
      return [
        {
          id: generateMessageId(),
          role: "assistant",
          content: initialMessage,
        },
      ];
    }
    return [];
  });

  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>("idle");
  const [currentStreamingId, setCurrentStreamingId] = useState<string | null>(
    null,
  );

  const addUserMessage = useCallback((content: string) => {
    const message: ChatMessage = {
      id: generateMessageId(),
      role: "user",
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, message]);
    return message;
  }, []);

  const addAssistantMessage = useCallback((content: string = "") => {
    const message: ChatMessage = {
      id: generateMessageId(),
      role: "assistant",
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, message]);
    setCurrentStreamingId(message.id);
    return message;
  }, []);

  const updateStreamingMessage = useCallback(
    (delta: string) => {
      if (!currentStreamingId) return false;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === currentStreamingId
            ? { ...m, content: m.content + delta }
            : m,
        ),
      );
      return true;
    },
    [currentStreamingId],
  );

  const setStreamingError = useCallback(
    (errorMessage: string = "Network error. Please retry.") => {
      if (!currentStreamingId) return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === currentStreamingId
            ? { ...m, content: errorMessage, error: true }
            : m,
        ),
      );
      setCurrentStreamingId(null);
    },
    [currentStreamingId],
  );

  const endStreaming = useCallback(() => {
    setCurrentStreamingId(null);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const retryLastMessage = useCallback(() => {
    const lastAssistant = messages
      .slice()
      .reverse()
      .find((m) => m.role === "assistant");

    if (lastAssistant && lastAssistant.error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === lastAssistant.id ? { ...m, content: "", error: false } : m,
        ),
      );
      setCurrentStreamingId(lastAssistant.id);
      return lastAssistant.id;
    }
    return null;
  }, [messages]);

  return {
    messages,
    networkStatus,
    setNetworkStatus,
    addUserMessage,
    addAssistantMessage,
    updateStreamingMessage,
    setStreamingError,
    endStreaming,
    clearMessages,
    retryLastMessage,
    currentStreamingId,
  };
}

function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
