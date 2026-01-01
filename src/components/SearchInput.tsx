"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { Search, X } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  debounceMs?: number;
};

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Search...",
  autoFocus = false,
  debounceMs = 300,
}: Props) {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Focus input on mount if autoFocus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        onChange(newValue);
      });
    }, debounceMs);
  };

  const handleClear = () => {
    setLocalValue("");
    onChange("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      handleClear();
    } else if (e.key === "Enter" && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div
      className={`glass glow-ring flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors ${
        isFocused ? "border-white/20" : ""
      }`}
    >
      <Search className="h-4 w-4 shrink-0 text-white/60" />
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
        autoComplete="off"
      />
      {localValue ? (
        <button
          type="button"
          onClick={handleClear}
          className="shrink-0 rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
