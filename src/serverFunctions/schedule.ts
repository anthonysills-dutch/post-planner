import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import { dayLabel, snippet, timeLabel } from "@/server/format";
import { listBetween, listUpcoming } from "@/server/posts";
import { ensureProfile, listSlots } from "@/server/profile";
import { dateKey, slotDays, zonedParts, zonedToUtc } from "@/server/time";

const DAY = 86_400_000;

export const getQueue = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    const profile = await ensureProfile(context.user);
    const tz = profile.timeZone;
    const now = Date.now();
    const [slots, upcoming] = await Promise.all([listSlots(profile.userId), listUpcoming(profile.userId, now - DAY)]);
    const days = slotDays(slots, tz, now, 14).map((day) => {
      const times = new Set(day.times.filter((t) => t > now));
      const posts = upcoming.filter((p) => dateKey(p.scheduledAt!, tz) === day.date);
      for (const post of posts) times.add(post.scheduledAt!);
      return {
        date: day.date,
        label: dayLabel(zonedToUtc(...(day.date.split("-").map(Number) as [number, number, number]), 12, 0, tz), tz),
        items: [...times]
          .sort((a, b) => a - b)
          .map((time) => {
            const post = posts.find((p) => p.scheduledAt === time);
            return {
              time: timeLabel(time, tz),
              post: post ? { id: post.id, snippet: snippet(post.body) } : null,
            };
          }),
      };
    });
    const last = days.at(-1)?.date ?? "";
    const later = upcoming
      .filter((p) => dateKey(p.scheduledAt!, tz) > last)
      .map((p) => ({ id: p.id, snippet: snippet(p.body), when: `${dayLabel(p.scheduledAt!, tz)}, ${timeLabel(p.scheduledAt!, tz)}` }));
    return { timeZone: tz, hasSlots: slots.length > 0, days, later };
  });

export const getCalendar = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) =>
    z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() }).strict().parse(data),
  )
  .handler(async ({ data, context }) => {
    const profile = await ensureProfile(context.user);
    const tz = profile.timeZone;
    const today = zonedParts(Date.now(), tz);
    const [year, month] = data.month
      ? (data.month.split("-").map(Number) as [number, number])
      : [today.year, today.month];
    const from = zonedToUtc(year, month, 1, 0, 0, tz);
    const next = month === 12 ? [year + 1, 1] : [year, month + 1];
    const to = zonedToUtc(next[0]!, next[1]!, 1, 0, 0, tz);
    const rows = await listBetween(profile.userId, from, to);
    const first = new Date(Date.UTC(year, month - 1, 1));
    const lead = (first.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const cells = Math.ceil((lead + daysInMonth) / 7) * 7;
    const todayKey = dateKey(Date.now(), tz);
    const days = Array.from({ length: cells }, (_, i) => {
      const date = new Date(Date.UTC(year, month - 1, 1 + i - lead));
      const key = date.toISOString().slice(0, 10);
      const posts = rows
        .map((p) => ({ ...p, at: (p.status === "published" ? p.publishedAt : p.scheduledAt)! }))
        .filter((p) => dateKey(p.at, tz) === key)
        .sort((a, b) => a.at - b.at)
        .map((p) => ({ id: p.id, status: p.status, time: timeLabel(p.at, tz), snippet: snippet(p.body, 120) }));
      return { key, day: date.getUTCDate(), inMonth: date.getUTCMonth() === month - 1, today: key === todayKey, posts };
    });
    const pad = (n: number) => String(n).padStart(2, "0");
    const prev = month === 1 ? `${year - 1}-12` : `${year}-${pad(month - 1)}`;
    return {
      title: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(first),
      prev,
      next: `${next[0]}-${pad(next[1]!)}`,
      days,
    };
  });
