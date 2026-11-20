import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { getCalendar } from "@/serverFunctions/schedule";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const Route = createFileRoute("/calendar")({
  validateSearch: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }),
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: ({ deps }) => getCalendar({ data: deps.month ? { month: deps.month } : {} }),
  head: () => ({ meta: [{ title: "Calendar · Post Planner" }] }),
  component: Calendar,
});

function Calendar() {
  const calendar = Route.useLoaderData();
  return (
    <AppShell wide>
      <PageHeader
        title="Calendar"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Previous month" data-testid="calendar-prev"
              render={<Link to="/calendar" search={{ month: calendar.prev }} />}>
              <ChevronLeft />
            </Button>
            <span data-testid="calendar-month" className="w-36 text-center text-sm font-medium">{calendar.title}</span>
            <Button variant="outline" size="icon" aria-label="Next month" data-testid="calendar-next"
              render={<Link to="/calendar" search={{ month: calendar.next }} />}>
              <ChevronRight />
            </Button>
          </div>
        }
      />
      <div className="overflow-x-auto">
        <div className="grid min-w-[48rem] grid-cols-7 overflow-hidden rounded-xl border border-border bg-border gap-px">
          {WEEKDAYS.map((day) => (
            <div key={day} className="bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground">{day}</div>
          ))}
          {calendar.days.map((day) => (
            <div key={day.key} className={day.inMonth ? "min-h-28 space-y-1 bg-card p-1.5" : "min-h-28 space-y-1 bg-muted/60 p-1.5"}>
              <div className={day.today ? "flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground" : "px-1 text-xs text-muted-foreground"}>
                {day.day}
              </div>
              {day.posts.map((post) => (
                <Link
                  key={post.id}
                  to="/posts/$postId"
                  params={{ postId: post.id }}
                  data-testid="calendar-post"
                  className={
                    post.status === "published"
                      ? "block truncate rounded-md bg-success/10 px-1.5 py-0.5 text-xs text-success hover:bg-success/20"
                      : "block truncate rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary hover:bg-primary/20"
                  }
                >
                  {post.time} {post.snippet}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
