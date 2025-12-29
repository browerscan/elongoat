import "server-only";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string };
    text?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export function getVectorEngineChatUrl(): string | null {
  if (!process.env.VECTORENGINE_API_KEY) return null;
  const baseUrl =
    process.env.VECTORENGINE_BASE_URL ?? "https://api.vectorengine.ai";
  const url =
    process.env.VECTORENGINE_API_URL ??
    `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  return url;
}

export async function vectorEngineChatComplete(params: {
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<{ text: string; usage?: { totalTokens?: number } }> {
  const key = process.env.VECTORENGINE_API_KEY;
  const url = getVectorEngineChatUrl();
  if (!key || !url) {
    throw new Error(
      "VectorEngine not configured (missing VECTORENGINE_API_KEY)",
    );
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      stream: false,
      temperature: params.temperature ?? 0.4,
      max_tokens: params.maxTokens ?? 900,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`VectorEngine error ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as ChatCompletionResponse;
  const content =
    json.choices?.[0]?.message?.content ?? json.choices?.[0]?.text ?? "";
  return {
    text: typeof content === "string" ? content : "",
    usage: { totalTokens: json.usage?.total_tokens },
  };
}
