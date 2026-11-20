import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { ConfigurationError, gatewayUrl } from "@every-app/sdk/server";

/**
 * The Gateway's origin: the way back to the other apps, and the host the
 * light/dark cookie is set on. Read by the root loader, so it also runs for
 * the public preview page; it reveals nothing but the Gateway's address.
 */
export const getGatewayUrl = createServerFn().handler(() => {
  try {
    return { gatewayUrl: new URL(gatewayUrl(env)).origin };
  } catch (error) {
    if (!(error instanceof ConfigurationError)) throw error;
    return { gatewayUrl: null };
  }
});
