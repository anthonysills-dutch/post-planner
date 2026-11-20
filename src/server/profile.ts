import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { EveryAppUser } from "@every-app/sdk/server";
import { db } from "@/db";
import { profiles, slots } from "@/db/schema";
import { isTimeZone } from "./time";

export interface Profile {
  userId: string;
  orgId: string;
  displayName: string;
  timeZone: string;
  weeklyGoal: number;
}

const shown = {
  userId: profiles.userId,
  orgId: profiles.orgId,
  displayName: profiles.displayName,
  timeZone: profiles.timeZone,
  weeklyGoal: profiles.weeklyGoal,
};

/** "maya.ortiz@x.com" as "Maya Ortiz". */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local.split(/[._-]+/).filter(Boolean);
  return (
    words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") ||
    "Member"
  );
}

/** The member's profile, made the first time the app sees them. */
export async function ensureProfile(user: EveryAppUser): Promise<Profile> {
  const [found] = await db
    .select(shown)
    .from(profiles)
    .where(eq(profiles.userId, user.id));
  if (found) return found;
  await db
    .insert(profiles)
    .values({
      userId: user.id,
      orgId: user.orgId,
      email: user.email,
      displayName: nameFromEmail(user.email),
    })
    .onConflictDoNothing();
  const [made] = await db
    .select(shown)
    .from(profiles)
    .where(eq(profiles.userId, user.id));
  return made!;
}

export const updateProfileInput = z
  .object({
    displayName: z.string().trim().min(1, "Enter a name").max(80),
    timeZone: z.string().refine(isTimeZone, "Pick a time zone"),
    weeklyGoal: z.number().int().min(1).max(50),
  })
  .strict();

export async function updateProfile(
  userId: string,
  input: z.infer<typeof updateProfileInput>,
): Promise<void> {
  await db.update(profiles).set(input).where(eq(profiles.userId, userId));
}

export interface SlotRow {
  id: string;
  weekday: number;
  minute: number;
}

export function listSlots(userId: string): Promise<SlotRow[]> {
  return db
    .select({ id: slots.id, weekday: slots.weekday, minute: slots.minute })
    .from(slots)
    .where(eq(slots.userId, userId))
    .orderBy(asc(slots.weekday), asc(slots.minute));
}

export const addSlotsInput = z
  .object({
    weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time"),
  })
  .strict();

export async function addSlots(
  userId: string,
  { weekdays, time }: z.infer<typeof addSlotsInput>,
): Promise<void> {
  const [h, m] = time.split(":").map(Number) as [number, number];
  await db
    .insert(slots)
    .values(
      weekdays.map((weekday) => ({
        id: crypto.randomUUID(),
        userId,
        weekday,
        minute: h * 60 + m,
      })),
    )
    .onConflictDoNothing();
}

export const removeSlotInput = z.object({ id: z.string().uuid() }).strict();

export async function removeSlot(userId: string, id: string): Promise<void> {
  await db.delete(slots).where(and(eq(slots.id, id), eq(slots.userId, userId)));
}
