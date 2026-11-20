import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { BookmarkPlus, ExternalLink, Heart, MessageCircle, Plus, Shuffle, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { errorMessage } from "@/client/lib/status";
import { addEntry, addToCollection, deleteEntry, getLibrary, remixEntry } from "@/serverFunctions/library";

export const Route = createFileRoute("/library/")({
  loader: () => getLibrary(),
  head: () => ({ meta: [{ title: "Library · Post Planner" }] }),
  component: Library,
});

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "likes", label: "Most likes" },
  { value: "comments", label: "Most comments" },
];
const ALL = "__all";

function Library() {
  const { entries, collections } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState(ALL);
  const [sort, setSort] = useState("newest");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);

  const topics = useMemo(
    () => [
      { value: ALL, label: "All topics" },
      ...[...new Set(entries.map((e) => e.topic))].sort().map((t) => ({ value: t, label: t })),
    ],
    [entries],
  );
  const shown = useMemo(() => {
    const words = search.trim().toLowerCase();
    return entries
      .filter((e) => topic === ALL || e.topic === topic)
      .filter((e) => !words || `${e.authorName} ${e.body} ${e.topic}`.toLowerCase().includes(words))
      .sort((a, b) =>
        sort === "likes" ? b.likes - a.likes : sort === "comments" ? b.comments - a.comments : b.createdAt.localeCompare(a.createdAt),
      );
  }, [entries, search, topic, sort]);

  async function remix(id: string) {
    try {
      const post = await remixEntry({ data: { id } });
      if (post) await navigate({ to: "/posts/$postId", params: { postId: post.id } });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function save(collection: { id: string; name: string }, entryId: string) {
    try {
      await addToCollection({ data: { collectionId: collection.id, entryId } });
      toast.success(`Saved to ${collection.name}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setPendingDelete(true);
    try {
      await deleteEntry({ data: { id: deleting } });
      await router.invalidate();
      setDeleting(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPendingDelete(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Library"
        description="Example posts your team shares."
        actions={
          <>
            <Button variant="outline" render={<Link to="/library/collections" />}>Collections</Button>
            <Button data-testid="add-entry" onClick={() => setAdding(true)}>
              <Plus /> Add example
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Input data-testid="library-search" aria-label="Search" placeholder="Search" value={search}
          onChange={(e) => setSearch(e.target.value)} className="min-w-48 flex-1 bg-card" />
        <SimpleSelect items={topics} value={topic} onChange={setTopic} label="Topic" testId="library-topic" className="w-44" />
        <SimpleSelect items={SORTS} value={sort} onChange={setSort} label="Sort" testId="library-sort" className="w-44" />
      </div>

      {entries.length === 0 ? (
        <EmptyState title="No examples yet" description="Add a post worth learning from and the whole team can find it here." />
      ) : shown.length === 0 ? (
        <EmptyState kind="filtered" title="No examples match" />
      ) : (
        <ul className="space-y-3">
          {shown.map((entry) => (
            <li key={entry.id} data-testid="library-entry" className="space-y-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{entry.authorName}</span>
                  <Badge variant="outline">{entry.topic}</Badge>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Heart className="size-3.5" aria-label="Likes" />{entry.likes.toLocaleString("en-US")}</span>
                  <span className="inline-flex items-center gap-1"><MessageCircle className="size-3.5" aria-label="Comments" />{entry.comments.toLocaleString("en-US")}</span>
                </div>
              </div>
              <p className="line-clamp-6 text-sm break-words whitespace-pre-wrap">{entry.body}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" data-testid="remix-entry" onClick={() => remix(entry.id)}>
                  <Shuffle /> Remix
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger data-testid="save-to-collection" render={<Button size="sm" variant="outline" />}>
                    <BookmarkPlus /> Save
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {collections.length === 0 ? (
                      <DropdownMenuItem render={<Link to="/library/collections" />}>New collection</DropdownMenuItem>
                    ) : (
                      collections.map((collection) => (
                        <DropdownMenuItem key={collection.id} onClick={() => save(collection, entry.id)}>
                          {collection.name}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                {entry.sourceUrl ? (
                  <Button size="sm" variant="ghost" render={<a href={entry.sourceUrl} target="_blank" rel="noreferrer" />}>
                    <ExternalLink /> Source
                  </Button>
                ) : null}
                {entry.canDelete ? (
                  <Button size="icon-sm" variant="ghost" aria-label="Delete example" data-testid="delete-entry"
                    className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => setDeleting(entry.id)}>
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding ? <AddEntryDialog onClose={() => setAdding(false)} /> : null}
      {deleting ? (
        <ConfirmDialog title="Delete this example?" confirmLabel="Delete" destructive pending={pendingDelete}
          onConfirm={confirmDelete} onClose={() => setDeleting(null)}>
          It leaves the library and every collection it is in.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}

function AddEntryDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({ authorName: "", topic: "", body: "", likes: "0", comments: "0", sourceUrl: "" });
  const [pending, setPending] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await addEntry({
        data: {
          authorName: form.authorName,
          topic: form.topic,
          body: form.body,
          likes: Math.max(0, Math.floor(Number(form.likes) || 0)),
          comments: Math.max(0, Math.floor(Number(form.comments) || 0)),
          sourceUrl: form.sourceUrl,
        },
      });
      await router.invalidate();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add an example</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="entry-author">Author</Label>
              <Input id="entry-author" data-testid="entry-author" required value={form.authorName} onChange={set("authorName")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entry-topic">Topic</Label>
              <Input id="entry-topic" data-testid="entry-topic" required value={form.topic} onChange={set("topic")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-body">Post</Label>
            <Textarea id="entry-body" data-testid="entry-body" required value={form.body} onChange={set("body")} className="min-h-32" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="entry-likes">Likes</Label>
              <Input id="entry-likes" data-testid="entry-likes" type="number" min={0} value={form.likes} onChange={set("likes")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entry-comments">Comments</Label>
              <Input id="entry-comments" data-testid="entry-comments" type="number" min={0} value={form.comments} onChange={set("comments")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-source">Link (optional)</Label>
            <Input id="entry-source" data-testid="entry-source" type="url" placeholder="https://" value={form.sourceUrl} onChange={set("sourceUrl")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button type="submit" data-testid="save-entry" pending={pending}>Add</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
