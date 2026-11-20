import { aiBaseUrl, createGatewayFetch, gatewayRefusal } from "@every-app/sdk/server";
import { z } from "zod";

export const TONES = ["professional", "casual", "storytelling"] as const;

export const assistInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("draft"), idea: z.string().trim().min(1, "Write a short idea first").max(500) }).strict(),
  z.object({ action: z.literal("hook"), body: z.string().trim().min(1, "Write the post first").max(3000) }).strict(),
  z.object({ action: z.literal("shorten"), body: z.string().trim().min(1, "Write the post first").max(3000) }).strict(),
  z.object({ action: z.literal("tone"), tone: z.enum(TONES), body: z.string().trim().min(1, "Write the post first").max(3000) }).strict(),
]);
type AssistInput = z.infer<typeof assistInput>;
export type AssistRequest = AssistInput;

const SYSTEM =
  "You write LinkedIn posts. Plain text only, no markdown, no hashtags unless asked. Short paragraphs separated by blank lines. Stay under 3000 characters. Reply with the post text alone.";

function prompt(input: AssistInput): string {
  switch (input.action) {
    case "draft":
      return `Write a LinkedIn post from this idea:\n\n${input.idea}`;
    case "hook":
      return `Rewrite only the opening line or two of this post so it makes people want to read on. Keep the rest exactly as it is and return the whole post.\n\n${input.body}`;
    case "shorten":
      return `Make this post noticeably shorter while keeping its point and voice.\n\n${input.body}`;
    case "tone":
      return `Rewrite this post in a ${input.tone} tone, keeping its content.\n\n${input.body}`;
  }
}

export type AssistResult =
  | { ok: true; text: string }
  | { ok: false; off: boolean; message: string };

const OFF = new Set(["ai_default_not_configured", "ai_provider_not_configured", "integration_not_configured", "provider_not_allowed"]);

async function call(env: object, body: unknown): Promise<Response> {
  const fetch = createGatewayFetch({ env });
  return fetch(`${aiBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Whether the workspace has a model: a request with no messages, which a configured provider rejects without running. */
export async function aiAvailable(env: object): Promise<boolean> {
  try {
    const response = await call(env, { model: "default", messages: [] });
    const refusal = await gatewayRefusal(response);
    return !(refusal && OFF.has(refusal.code));
  } catch {
    return false;
  }
}

export async function assist(env: object, input: AssistInput): Promise<AssistResult> {
  let response: Response;
  try {
    response = await call(env, {
      model: "default",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt(input) },
      ],
    });
  } catch {
    return { ok: false, off: false, message: "The model didn't answer. Try again." };
  }
  const refusal = await gatewayRefusal(response.clone());
  if (refusal) {
    return OFF.has(refusal.code)
      ? { ok: false, off: true, message: "No AI model is set up for this workspace." }
      : { ok: false, off: false, message: refusal.message || "The model didn't answer. Try again." };
  }
  if (!response.ok) return { ok: false, off: false, message: "The model didn't answer. Try again." };
  const data = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) return { ok: false, off: false, message: "The model returned nothing. Try again." };
  return { ok: true, text: text.slice(0, 3000) };
}
