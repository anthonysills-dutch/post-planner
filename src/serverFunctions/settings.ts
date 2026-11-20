import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { linkedInState } from "@/server/linkedin";
import * as profile from "@/server/profile";

export const getSettings = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    const me = await profile.ensureProfile(context.user);
    const [slots, linkedin] = await Promise.all([
      profile.listSlots(context.user.id),
      linkedInState(env, getRequest().url),
    ]);
    return {
      displayName: me.displayName,
      timeZone: me.timeZone,
      weeklyGoal: me.weeklyGoal,
      slots,
      linkedin,
    };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => profile.updateProfileInput.parse(data))
  .handler(async ({ data, context }) => {
    await profile.ensureProfile(context.user);
    await profile.updateProfile(context.user.id, data);
    return { ok: true as const };
  });

export const addSlots = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => profile.addSlotsInput.parse(data))
  .handler(async ({ data, context }) => {
    await profile.addSlots(context.user.id, data);
    return { ok: true as const };
  });

export const removeSlot = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => profile.removeSlotInput.parse(data))
  .handler(async ({ data, context }) => {
    await profile.removeSlot(context.user.id, data.id);
    return { ok: true as const };
  });
