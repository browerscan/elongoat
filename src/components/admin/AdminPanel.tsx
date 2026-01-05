"use client";

import { useEffect, useMemo, useState } from "react";

import { slugify } from "../../lib/slugify";

type AdminTab = "flywheel" | "config";

type HotQuestion = {
  questionHash: string;
  question: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  samplePage: string | null;
  promotedSlug: string | null;
  promotedAt: string | null;
};

type AdminSnapshot = {
  ok: true;
  variables: {
    dob: string;
    age: number;
    children_count: number;
    net_worth: string;
    chat_mood: "confident" | "neutral" | "defensive";
    chat_typing_quirk: boolean;
  };
  updatedAt: { vars: string; chat: string };
};

type AuthState = {
  isAuthenticated: boolean;
  csrfToken: string | null;
  isChecking: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Helper to get CSRF token from cookies
function getCsrfToken(): string | null {
  const match = document.cookie.match(/elongoat_admin_csrf=([^;]+)/);
  return match ? match[1] : null;
}

// Helper to build headers with CSRF token
function buildAuthHeaders(csrfToken: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (csrfToken) {
    headers["X-Admin-CSRF"] = csrfToken;
  }
  return headers;
}

export function AdminPanel() {
  const [tab, setTab] = useState<AdminTab>("flywheel");
  const [token, setToken] = useState("");
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    csrfToken: null,
    isChecking: true,
  });

  const [minCount, setMinCount] = useState(10);
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<HotQuestion[]>([]);
  const [lastPromoted, setLastPromoted] = useState<string | null>(null);

  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [saveConfigBusy, setSaveConfigBusy] = useState(false);

  const tokenOk = useMemo(() => token.trim().length >= 16, [token]);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Update CSRF token from cookies after login
  useEffect(() => {
    const csrf = getCsrfToken();
    setAuthState((prev) => ({ ...prev, csrfToken: csrf }));
  }, [authState.isAuthenticated]);

  async function checkAuthStatus() {
    try {
      const res = await fetch("/api/admin/auth/login");
      const data = (await res.json()) as { authenticated: boolean };
      setAuthState({
        isAuthenticated: data.authenticated,
        csrfToken: getCsrfToken(),
        isChecking: false,
      });
    } catch {
      setAuthState({
        isAuthenticated: false,
        csrfToken: null,
        isChecking: false,
      });
    }
  }

  async function login() {
    if (!tokenOk) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        csrfToken?: string;
      };

      if (!res.ok || !data.success) {
        setError(data.error ?? "Login failed");
        setAuthState((prev) => ({
          ...prev,
          isAuthenticated: false,
          isChecking: false,
        }));
        return;
      }

      setAuthState({
        isAuthenticated: true,
        csrfToken: data.csrfToken ?? getCsrfToken(),
        isChecking: false,
      });

      // Clear token from memory after successful login (it's now in session cookie)
      setToken("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch {
      // Ignore logout errors
    } finally {
      setAuthState({
        isAuthenticated: false,
        csrfToken: null,
        isChecking: false,
      });
    }
  }

  async function loadFlywheel() {
    if (!authState.isAuthenticated) return;
    setLoading(true);
    setError(null);
    setLastPromoted(null);

    try {
      const qs = new URLSearchParams({
        minCount: String(minCount),
        limit: String(limit),
      });
      const res = await fetch(`/api/admin/chat-questions?${qs.toString()}`);
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          isRecord(json) && typeof json.error === "string"
            ? json.error
            : `HTTP ${res.status}`,
        );
        return;
      }
      const list = isRecord(json) ? json.questions : null;
      setQuestions(Array.isArray(list) ? (list as HotQuestion[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch_failed");
    } finally {
      setLoading(false);
    }
  }

  async function promote(questionHash: string, question: string) {
    if (!authState.isAuthenticated) return;
    setLoading(true);
    setError(null);
    setLastPromoted(null);

    const defaultSlug = slugify(question);
    const slug = window.prompt("Slug for /q/<slug>:", defaultSlug) ?? "";
    if (!slug.trim()) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/promote-question", {
        method: "POST",
        headers: buildAuthHeaders(authState.csrfToken),
        body: JSON.stringify({ questionHash, slug: slug.trim() }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          isRecord(json) && typeof json.error === "string"
            ? json.error
            : `HTTP ${res.status}`,
        );
        return;
      }
      setLastPromoted(
        isRecord(json) && typeof json.url === "string"
          ? json.url
          : `/q/${slug.trim()}`,
      );
      await loadFlywheel();
    } catch (e) {
      setError(e instanceof Error ? e.message : "promote_failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadConfig() {
    if (!authState.isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/variables");
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          isRecord(json) && typeof json.error === "string"
            ? json.error
            : `HTTP ${res.status}`,
        );
        return;
      }
      setSnapshot(json as AdminSnapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch_failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig(patch: Partial<AdminSnapshot["variables"]>) {
    if (!authState.isAuthenticated) return;
    setSaveConfigBusy(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {};
      if (patch.chat_mood != null) body.chat_mood = patch.chat_mood;
      if (patch.chat_typing_quirk != null)
        body.chat_typing_quirk = patch.chat_typing_quirk;
      if (patch.net_worth != null) body.net_worth = patch.net_worth;
      if (patch.children_count != null)
        body.children_count = patch.children_count;
      if (patch.dob != null) body.dob = patch.dob;

      const res = await fetch("/api/admin/variables", {
        method: "POST",
        headers: buildAuthHeaders(authState.csrfToken),
        body: JSON.stringify(body),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const issues =
          isRecord(json) && Array.isArray(json.issues)
            ? json.issues.map(String).join(", ")
            : "";
        const base =
          isRecord(json) && typeof json.error === "string"
            ? json.error
            : `HTTP ${res.status}`;
        setError([base, issues].filter(Boolean).join(": "));
        return;
      }
      await loadConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : "update_failed");
    } finally {
      setSaveConfigBusy(false);
    }
  }

  useEffect(() => {
    if (!authState.isAuthenticated) return;
    if (tab === "flywheel") void loadFlywheel();
    if (tab === "config") void loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, authState.isAuthenticated]);

  return (
    <div className="space-y-6">
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Admin</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              {authState.isAuthenticated
                ? "Authenticated via secure session. Your admin session is stored in httpOnly cookies (XSS-protected)."
                : "Enter your admin token to access protected tools. Tokens are never stored in localStorage."}
            </p>
          </div>
          {authState.isAuthenticated && (
            <button
              type="button"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
              onClick={logout}
            >
              Logout
            </button>
          )}
        </div>

        {!authState.isAuthenticated ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="text-xs text-white/60" htmlFor="admin-token">
                `ELONGOAT_ADMIN_TOKEN`
              </label>
              <input
                id="admin-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="paste admin token"
                className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-white/20 focus:outline-none"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
                disabled={!tokenOk || loading}
                onClick={login}
              >
                Login
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-100">
            <span className="flex h-2 w-2">
              <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            Authenticated
            <button
              type="button"
              className="ml-4 rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
              disabled={loading}
              onClick={() => {
                if (tab === "flywheel") void loadFlywheel();
                if (tab === "config") void loadConfig();
              }}
            >
              Refresh
            </button>
          </div>
        )}
      </div>

      {authState.isAuthenticated && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={[
              "rounded-xl border px-3 py-2 text-sm transition",
              tab === "flywheel"
                ? "border-white/20 bg-white/10 text-white"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
            ].join(" ")}
            onClick={() => setTab("flywheel")}
          >
            Flywheel
          </button>
          <button
            type="button"
            className={[
              "rounded-xl border px-3 py-2 text-sm transition",
              tab === "config"
                ? "border-white/20 bg-white/10 text-white"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
            ].join(" ")}
            onClick={() => setTab("config")}
          >
            Variables & mood
          </button>
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {authState.isAuthenticated && tab === "flywheel" ? (
        <div className="glass rounded-3xl p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Chat to Content
              </h2>
              <p className="mt-1 text-sm text-white/60">
                Requires `CHAT_ANALYTICS_ENABLED=1` to record aggregated
                question counts (no chat history).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="text-xs text-white/60">
                minCount
                <input
                  type="number"
                  min={1}
                  max={1000000}
                  value={minCount}
                  onChange={(e) =>
                    setMinCount(Number.parseInt(e.target.value || "10", 10))
                  }
                  className="ml-2 w-24 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-xs text-white/60">
                limit
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={limit}
                  onChange={(e) =>
                    setLimit(Number.parseInt(e.target.value || "100", 10))
                  }
                  className="ml-2 w-24 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <button
                type="button"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-50"
                disabled={loading}
                onClick={() => void loadFlywheel()}
              >
                Load
              </button>
            </div>
          </div>

          {lastPromoted ? (
            <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              Promoted:{" "}
              <a className="underline" href={lastPromoted}>
                {lastPromoted}
              </a>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3">
            {questions.length ? (
              questions.map((q) => (
                <div
                  key={q.questionHash}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">
                        {q.question}
                      </div>
                      <div className="mt-1 text-xs text-white/55">
                        Count: {q.count} - Last:{" "}
                        {new Date(q.lastSeenAt).toLocaleString()}
                        {q.samplePage ? ` - Page: ${q.samplePage}` : ""}
                      </div>
                      {q.promotedSlug ? (
                        <div className="mt-2 text-xs text-white/55">
                          Promoted:{" "}
                          <a
                            className="underline"
                            href={`/q/${q.promotedSlug}`}
                          >{`/q/${q.promotedSlug}`}</a>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
                        disabled={loading || Boolean(q.promotedSlug)}
                        onClick={() => void promote(q.questionHash, q.question)}
                      >
                        Promote
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/60">
                {loading ? "Loading..." : "No rows (or analytics disabled)."}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {authState.isAuthenticated && tab === "config" ? (
        <div className="glass rounded-3xl p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Variables & mood
              </h2>
              <p className="mt-1 text-sm text-white/60">
                Updates write to `elongoat.variables` and invalidate Redis
                caches.
              </p>
            </div>
          </div>

          {snapshot ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/55">Chat mood</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["confident", "neutral", "defensive"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={saveConfigBusy}
                      className={[
                        "rounded-xl border px-3 py-2 text-sm transition",
                        snapshot.variables.chat_mood === m
                          ? "border-white/20 bg-white/10 text-white"
                          : "border-white/10 bg-black/40 text-white/70 hover:bg-white/10 hover:text-white",
                      ].join(" ")}
                      onClick={() => void saveConfig({ chat_mood: m })}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-xs text-white/45">
                  Updated: {new Date(snapshot.updatedAt.chat).toLocaleString()}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/55">Typing quirk</div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={saveConfigBusy}
                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
                    onClick={() =>
                      void saveConfig({
                        chat_typing_quirk:
                          !snapshot.variables.chat_typing_quirk,
                      })
                    }
                  >
                    {snapshot.variables.chat_typing_quirk ? "ON" : "OFF"}
                  </button>
                  <span className="text-xs text-white/55">
                    {snapshot.variables.chat_typing_quirk
                      ? "tweet-like lowercase/shorthand"
                      : "clean writing"}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/55">
                  Net worth (variable)
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={snapshot.variables.net_worth}
                    onChange={(e) =>
                      setSnapshot((prev) =>
                        prev
                          ? {
                              ...prev,
                              variables: {
                                ...prev.variables,
                                net_worth: e.target.value,
                              },
                            }
                          : prev,
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                  <button
                    type="button"
                    disabled={saveConfigBusy}
                    className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
                    onClick={() =>
                      void saveConfig({
                        net_worth: snapshot.variables.net_worth,
                      })
                    }
                  >
                    Save
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/55">Core variables</div>
                <div className="mt-2 grid gap-2">
                  <div className="flex items-center justify-between gap-2 text-sm text-white/75">
                    <span>DOB</span>
                    <code className="rounded bg-black/40 px-2 py-1">
                      {snapshot.variables.dob}
                    </code>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm text-white/75">
                    <span>Age (derived)</span>
                    <code className="rounded bg-black/40 px-2 py-1">
                      {snapshot.variables.age}
                    </code>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm text-white/75">
                    <span>Children</span>
                    <code className="rounded bg-black/40 px-2 py-1">
                      {snapshot.variables.children_count}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/60">
              {loading ? "Loading..." : "Failed to load config."}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
