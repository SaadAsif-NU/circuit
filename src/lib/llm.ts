/**
 * The model, streamed.
 *
 * Runs server-side only. With a key it streams tokens from Gemini's
 * OpenAI-compatible endpoint; without one it falls back to a deterministic
 * simulated reply so the canvas always runs and a demo never dies on a missing
 * key or a rate limit.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const MODEL = process.env.CIRCUIT_MODEL || "gemini-2.5-flash";

export function apiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
}

export function hasKey(): boolean {
  return Boolean(apiKey());
}

/** Stream a completion, calling `onToken` for each chunk. Returns the full text. */
export async function streamCompletion(
  prompt: string,
  onToken: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const key = apiKey();
  if (!key) return simulate(prompt, onToken);

  const res = await fetch(`${GEMINI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      stream: true,
    }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`model error ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE frames are separated by a blank line; keep the trailing partial.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const delta = parseFrame(frame);
      if (delta) {
        full += delta;
        onToken(delta);
      }
    }
  }
  return full;
}

function parseFrame(frame: string): string | null {
  const line = frame.split("\n").find((l) => l.startsWith("data:"));
  if (!line) return null;
  const payload = line.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;
  try {
    const json = JSON.parse(payload);
    return json?.choices?.[0]?.delta?.content ?? null;
  } catch {
    return null;
  }
}

/**
 * The offline stand-in: deterministic, and streamed word by word so the canvas
 * animates exactly as it does with a real model.
 */
async function simulate(
  prompt: string,
  onToken: (text: string) => void,
): Promise<string> {
  const subject = prompt.trim().split("\n")[0].slice(0, 80) || "the input";
  const text =
    `Working offline, so this is a simulated reply about "${subject}". ` +
    "Set GEMINI_API_KEY to run this node on a real model. The flow, the wiring, " +
    "and the streaming you are watching are all real.";
  for (const word of text.split(" ")) {
    onToken(word + " ");
    await new Promise((r) => setTimeout(r, 12));
  }
  return text;
}
