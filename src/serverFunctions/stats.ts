import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import { dayLabel, snippet } from "@/server/format";
import { listPublished } from "@/server/posts";
import { ensureProfile } from "@/server/profile";
import { postsPerWeek, weeklyStreak } from "@/server/stats";

export const RANGES = [4, 8, 12, 26] as const;

export const getStats = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) =>
    z.object({ weeks: z.union(RANGES.map((n) => z.literal(n)) as [z.ZodLiteral<4>, z.ZodLiteral<8>, z.ZodLiteral<12>, z.ZodLiteral<26>]) }).strict().parse(data),
  )
  .handler(async ({ data, context }) => {
    const profile = await ensureProfile(context.user);
    const tz = profile.timeZone;
    const now = Date.now();
    const published = (await listPublished(profile.userId)).filter((p) => p.publishedAt !== null);
    const times = published.map((p) => p.publishedAt!);
    const weeks = postsPerWeek(times, tz, now, data.weeks);
    const from = weeks[0]!.start;
    const inRange = published.filter((p) => p.publishedAt! >= from);
    const sum = (key: "impressions" | "reactions" | "comments" | "reposts") =>
      inRange.reduce((total, p) => total + p[key], 0);
    return {
      goal: profile.weeklyGoal,
      streak: weeklyStreak(times, tz, now, profile.weeklyGoal),
      weeks: weeks.map((w) => ({ label: dayLabel(w.start + 12 * 3_600_000, tz), count: w.count })),
      totals: {
        impressions: sum("impressions"),
        reactions: sum("reactions"),
        comments: sum("comments"),
        reposts: sum("reposts"),
      },
      posts: inRange.map((p) => ({
        id: p.id,
        snippet: snippet(p.body, 70),
        publishedAt: p.publishedAt!,
        date: dayLabel(p.publishedAt!, tz),
        impressions: p.impressions,
        reactions: p.reactions,
        comments: p.comments,
        reposts: p.reposts,
      })),
    };
  });
