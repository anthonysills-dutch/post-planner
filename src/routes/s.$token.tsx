import { createFileRoute, notFound } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import { Card, CardContent } from "@/client/components/ui/card";
import { getPreview } from "@/serverFunctions/share";

// The public preview: anyone with the link reads the post as it is now.
export const Route = createFileRoute("/s/$token")({
  loader: async ({ params }) => {
    const post = await getPreview({ data: { token: params.token } });
    if (!post) throw notFound();
    return post;
  },
  head: () => ({ meta: [{ title: "Post preview" }, { name: "robots", content: "noindex" }] }),
  component: Preview,
  notFoundComponent: Missing,
});

function Missing() {
  return (
    <div className="flex min-h-dvh justify-center bg-background px-4 py-10">
      <div data-testid="shared-not-found" className="w-full max-w-xl">
        <EmptyState kind="filtered" title="Preview not found" />
      </div>
    </div>
  );
}

function Preview() {
  const post = Route.useLoaderData();
  return (
    <div className="flex min-h-dvh justify-center overflow-y-auto bg-background px-4 py-10">
      <div className="w-full max-w-xl">
        <Card data-testid="shared-post">
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
                {post.authorName.charAt(0).toUpperCase()}
              </div>
              <p data-testid="shared-author" className="font-medium">{post.authorName}</p>
            </div>
            <p data-testid="shared-body" className="break-words whitespace-pre-wrap">{post.body}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
