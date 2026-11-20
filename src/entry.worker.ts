import tanstackEntry from "@tanstack/react-start/server-entry";
import { everyApp } from "@every-app/sdk/server";
import { publishDue } from "./server/publish";

// everyApp() verifies the identity the Gateway sent before any request reaches
// the app (a request from anywhere else is a 401). The minute cron publishes
// due posts.
export default {
  ...everyApp<Env>(async (request) => tanstackEntry.fetch(request)),
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(publishDue(env));
  },
};
