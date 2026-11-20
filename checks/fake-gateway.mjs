// A local stand-in for the Gateway that answers the default chat model with
// a fixed completion and refuses every other capability as unconfigured.
export const SUGGESTION =
  "Most teams plan too much and ship too little. Here is the one-page weekly plan we switched to, and what it changed for us.";

const SCRIPT = `export default { async fetch(request) {
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname.endsWith("/chat/completions")) {
    const body = await request.json().catch(() => ({}));
    if (Array.isArray(body.messages) && body.messages.length > 0) {
      return Response.json({ id: "c1", object: "chat.completion", created: 0, model: "local",
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: ${JSON.stringify(SUGGESTION)} } }] });
    }
    return Response.json({ error: { message: "messages is required" } }, { status: 400 });
  }
  const code = "integration_not_configured";
  return Response.json({ error: "Service Unavailable", code, message: "Not set up." }, { status: 503, headers: { "x-everyapp-error": code } });
} };`;

export const fakeGateway = {
  bindings: { EVERY_APP_GATEWAY: { type: "worker", worker: "fake-gateway" } },
  workers: [{ config: { name: "fake-gateway", compatibilityDate: "2026-06-01",
    manifest: { mainModule: "gateway.mjs", modules: { "gateway.mjs": { type: "esm", contents: SCRIPT } } } } }],
};
