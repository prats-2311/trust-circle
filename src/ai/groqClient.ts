export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export type ChatPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type ChatContent = string | ChatPart[];
export interface ChatMessage {
  role: "system" | "user";
  content: ChatContent;
}
export type ChatResult = { ok: true; content: string } | { ok: false; error: string };

export async function groqChat(opts: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  json: boolean;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): Promise<ChatResult> {
  try {
    const res = await (opts.fetchImpl ?? fetch)(GROQ_URL, {
      method: "POST",
      signal: AbortSignal.timeout(opts.timeoutMs),
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        temperature: 0,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        messages: opts.messages,
      }),
    });
    if (!res.ok) return { ok: false, error: `groq http ${res.status}` };
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: "groq empty response" };
    return { ok: true, content };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.name : "groq error" };
  }
}

/** Some models wrap JSON in reasoning tags or code fences; take the outermost object. */
export function parseJsonObject(content: string): unknown {
  const visible = content.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = visible.indexOf("{");
  const end = visible.lastIndexOf("}");
  if (start < 0 || end <= start) throw new SyntaxError("No JSON object in model output");
  return JSON.parse(visible.slice(start, end + 1));
}
