import { connectUrl, gatewayRefusal, integrationFetch, integrationStatus } from "@every-app/sdk/server";

export const PROVIDER = "linkedin";
const NOT_CONNECTED =
  "LinkedIn isn't connected. Connect it in Settings, then schedule the post again.";
const UNREACHABLE = new Set([
  "integration_not_configured",
  "integration_not_connected",
  "capability_not_requested",
  "provider_not_allowed",
]);

/** LinkedIn's text format reserves these characters; a backslash keeps them literal. */
export function escapeCommentary(text: string): string {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
}

export type PublishResult =
  | { ok: true; externalId: string; externalUrl: string }
  | { ok: false; reason: string };

async function refusalReason(response: Response): Promise<string> {
  const refusal = await gatewayRefusal(response);
  if (refusal && UNREACHABLE.has(refusal.code)) return NOT_CONNECTED;
  if (response.status === 401 || response.status === 403) return NOT_CONNECTED;
  return `LinkedIn refused the post (HTTP ${response.status}).`;
}

/** Publishes `body` as the member, from the minute cron. */
export async function publishToLinkedIn(
  env: object,
  member: { userId: string; orgId: string },
  body: string,
): Promise<PublishResult> {
  try {
    const call = integrationFetch({
      env,
      provider: PROVIDER,
      for: { background: true, organizationId: member.orgId, userId: member.userId },
    });
    const me = await call("https://api.linkedin.com/v2/userinfo");
    if (!me.ok) return { ok: false, reason: await refusalReason(me) };
    const { sub } = (await me.json()) as { sub?: string };
    if (!sub) return { ok: false, reason: NOT_CONNECTED };
    const response = await call("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "LinkedIn-Version": "202509",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: `urn:li:person:${sub}`,
        commentary: escapeCommentary(body),
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
    });
    if (!response.ok) return { ok: false, reason: await refusalReason(response) };
    const externalId = response.headers.get("x-restli-id") ?? "";
    return {
      ok: true,
      externalId,
      externalUrl: externalId
        ? `https://www.linkedin.com/feed/update/${encodeURIComponent(externalId)}/`
        : "https://www.linkedin.com/in/me/recent-activity/all/",
    };
  } catch {
    return { ok: false, reason: NOT_CONNECTED };
  }
}

export type LinkedInState =
  | { state: "connected" }
  | { state: "connect"; url: string }
  | { state: "unavailable"; setup: string | null };

/** Whether the member can publish, and where to connect when they can't. */
export async function linkedInState(env: object, returnTo: string): Promise<LinkedInState> {
  try {
    const status = await integrationStatus({ env, provider: PROVIDER });
    if (!status.configured) return { state: "unavailable", setup: status.setup };
    const connection = (status as { connection?: { ready?: boolean } }).connection;
    if (connection?.ready) return { state: "connected" };
    return { state: "connect", url: connectUrl({ env, provider: PROVIDER, returnTo }) };
  } catch {
    return { state: "unavailable", setup: null };
  }
}
