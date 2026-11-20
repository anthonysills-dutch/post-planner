import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { getQueue } from "@/serverFunctions/schedule";

export const Route = createFileRoute("/queue")({
  loader: () => getQueue(),
  head: () => ({ meta: [{ title: "Queue · Post Planner" }] }),
  component: Queue,
});

function Queue() {
  const queue = Route.useLoaderData();
  const days = queue.days.filter((day) => day.items.length > 0);
  return (
    <AppShell>
      <PageHeader title="Queue" description={`Next two weeks · ${queue.timeZone}`} />
      {!queue.hasSlots && days.length === 0 ? (
        <EmptyState
          title="No posting times yet"
          description="Add weekly posting times and queued posts fill them in order."
          action={<Button render={<Link to="/settings" />}>Add posting times</Button>}
        />
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <section key={day.date} data-testid="queue-day" className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">{day.label}</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xs">
                {day.items.map((item) => (
                  <li key={item.time} className="flex items-center gap-4 px-4 py-3 text-sm">
                    <span className="w-12 shrink-0 font-mono text-muted-foreground">{item.time}</span>
                    {item.post ? (
                      <Link
                        to="/posts/$postId"
                        params={{ postId: item.post.id }}
                        data-testid="queue-post"
                        className="min-w-0 flex-1 truncate hover:underline"
                      >
                        {item.post.snippet || "Empty post"}
                      </Link>
                    ) : (
                      <span data-testid="queue-empty-slot" className="text-muted-foreground">
                        Empty slot
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {queue.later.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">Later</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xs">
                {queue.later.map((post) => (
                  <li key={post.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                    <span className="shrink-0 text-muted-foreground">{post.when}</span>
                    <Link to="/posts/$postId" params={{ postId: post.id }} data-testid="queue-post" className="min-w-0 flex-1 truncate hover:underline">
                      {post.snippet || "Empty post"}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
