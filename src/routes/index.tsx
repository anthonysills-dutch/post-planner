import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { BOARD_COLUMNS, STATUS_LABELS, errorMessage } from "@/client/lib/status";
import { createPost, getBoard } from "@/serverFunctions/posts";

export const Route = createFileRoute("/")({
  loader: () => getBoard(),
  head: () => ({ meta: [{ title: "Posts · Post Planner" }] }),
  component: Board,
});

function Board() {
  const posts = Route.useLoaderData();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  async function create() {
    setCreating(true);
    try {
      const { id } = await createPost({ data: {} });
      await navigate({ to: "/posts/$postId", params: { postId: id } });
    } catch (error) {
      toast.error(errorMessage(error));
      setCreating(false);
    }
  }

  return (
    <AppShell wide>
      <PageHeader
        title="Posts"
        actions={
          <Button data-testid="new-post" onClick={create} pending={creating}>
            <Plus /> New post
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {BOARD_COLUMNS.map((status) => {
          const items = posts.filter((post) => post.status === status);
          return (
            <section
              key={status}
              data-testid={`column-${status}`}
              className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/40 p-2"
            >
              <h2 className="flex items-center justify-between px-1 text-sm font-medium">
                {STATUS_LABELS[status]}
                <Badge variant="outline">{items.length}</Badge>
              </h2>
              {items.map((post) => (
                <Link
                  key={post.id}
                  to="/posts/$postId"
                  params={{ postId: post.id }}
                  data-testid="post-card"
                  className="block rounded-lg border border-border bg-card p-3 text-sm text-card-foreground shadow-xs transition-colors hover:border-primary/40"
                >
                  <p className="line-clamp-4 break-words whitespace-pre-line">
                    {post.body.trim() || <span className="text-muted-foreground">Empty post</span>}
                  </p>
                </Link>
              ))}
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
