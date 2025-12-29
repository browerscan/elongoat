export type XTimelineTweet = {
  tweetId: string;
  authorHandle: string;
  url: string;
  content: string;
  postedAt: string | null;
  raw: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function extractNextDataFromHtml(html: string): unknown | null {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as unknown;
  } catch {
    return null;
  }
}

export function extractTimelineEntries(nextData: unknown): unknown[] {
  if (!isRecord(nextData)) return [];
  const props = nextData["props"];
  if (!isRecord(props)) return [];
  const pageProps = props["pageProps"];
  if (!isRecord(pageProps)) return [];
  const timeline = pageProps["timeline"];
  if (!isRecord(timeline)) return [];
  const entries = timeline["entries"];
  if (!Array.isArray(entries)) return [];
  return entries;
}

export function parseTweetsFromSyndicationNextData(params: {
  monitoredHandle: string;
  nextData: unknown;
  limit: number;
}): XTimelineTweet[] {
  const entries = extractTimelineEntries(params.nextData);
  if (!entries.length) return [];

  const out: XTimelineTweet[] = [];
  for (const entry of entries) {
    if (!isRecord(entry)) continue;
    if (entry["type"] !== "tweet") continue;
    const content = entry["content"];
    if (!isRecord(content)) continue;
    const tweetObj = content["tweet"];
    if (!isRecord(tweetObj)) continue;

    const idStr =
      typeof tweetObj["id_str"] === "string" ? tweetObj["id_str"] : null;
    const convoStr =
      typeof tweetObj["conversation_id_str"] === "string"
        ? tweetObj["conversation_id_str"]
        : null;
    const tweetId = (idStr ?? convoStr ?? "").trim();
    if (!tweetId || !/^\d{5,}$/.test(tweetId)) continue;

    const user = tweetObj["user"];
    const authorHandleRaw =
      isRecord(user) && typeof user["screen_name"] === "string"
        ? user["screen_name"]
        : "";
    const authorHandle = (authorHandleRaw || params.monitoredHandle).trim();

    const fullText =
      typeof tweetObj["full_text"] === "string"
        ? tweetObj["full_text"]
        : typeof tweetObj["text"] === "string"
          ? tweetObj["text"]
          : "";

    const permalink =
      typeof tweetObj["permalink"] === "string"
        ? tweetObj["permalink"]
        : `/${authorHandle}/status/${tweetId}`;
    const url =
      permalink.startsWith("http://") || permalink.startsWith("https://")
        ? permalink
        : `https://x.com${permalink.startsWith("/") ? "" : "/"}${permalink}`;

    const createdAtRaw =
      typeof tweetObj["created_at"] === "string"
        ? tweetObj["created_at"]
        : null;
    const postedAt = createdAtRaw ? new Date(createdAtRaw) : null;
    const postedAtIso =
      postedAt && Number.isFinite(postedAt.getTime())
        ? postedAt.toISOString()
        : null;

    out.push({
      tweetId,
      authorHandle,
      url,
      content: fullText.trim(),
      postedAt: postedAtIso,
      raw: {
        entry_id:
          typeof entry["entry_id"] === "string" ? entry["entry_id"] : null,
        sort_index:
          typeof entry["sort_index"] === "string" ? entry["sort_index"] : null,
        tweet: tweetObj,
      },
    });

    if (out.length >= Math.max(1, params.limit)) break;
  }

  return out;
}

export function extractXHandlesFromText(text: string): string[] {
  const out = new Set<string>();

  const at = /@([A-Za-z0-9_]{1,15})\b/g;
  for (const match of text.matchAll(at)) {
    const handle = match[1]?.toLowerCase();
    if (handle) out.add(handle);
  }

  const url = /https?:\/\/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\b/gi;
  for (const match of text.matchAll(url)) {
    const handle = match[1]?.toLowerCase();
    if (handle) out.add(handle);
  }

  return [...out];
}
