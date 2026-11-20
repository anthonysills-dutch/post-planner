import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { errorMessage } from "@/client/lib/status";
import {
  createCollection,
  deleteCollection,
  getCollections,
  removeFromCollection,
  renameCollection,
} from "@/serverFunctions/library";

export const Route = createFileRoute("/library/collections")({
  loader: () => getCollections(),
  head: () => ({ meta: [{ title: "Collections · Post Planner" }] }),
  component: Collections,
});

function Collections() {
  const collections = Route.useLoaderData();
  const router = useRouter();
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function act(work: () => Promise<unknown>) {
    setPending(true);
    try {
      await work();
      await router.invalidate();
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Collections"
        description="Only you see your collections."
        backLink={
          <Link to="/library" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden /> Library
          </Link>
        }
      />
      <form
        className="flex gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!name.trim()) return;
          if (await act(() => createCollection({ data: { name } }))) setName("");
        }}
      >
        <Input data-testid="new-collection-name" aria-label="Collection name" placeholder="New collection" value={name}
          onChange={(e) => setName(e.target.value)} className="bg-card" />
        <Button type="submit" data-testid="create-collection" disabled={!name.trim()}>Create</Button>
      </form>

      {collections.length === 0 ? (
        <EmptyState title="No collections yet" description="Create one, then save examples to it from the library." />
      ) : (
        <div className="space-y-6">
          {collections.map((collection) => (
            <section key={collection.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 data-testid="collection-name" className="text-base font-semibold tracking-tight">{collection.name}</h2>
                <div className="flex items-center gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label="Rename collection" data-testid="rename-collection"
                    onClick={() => setRenaming({ id: collection.id, name: collection.name })}>
                    <Pencil />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Delete collection" data-testid="delete-collection"
                    className="text-muted-foreground hover:text-destructive" onClick={() => setDeleting(collection.id)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
              {collection.entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Empty</p>
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xs">
                  {collection.entries.map((entry) => (
                    <li key={entry.entryId} data-testid="collection-entry" className="flex items-start gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-medium">{entry.authorName} <span className="font-normal text-muted-foreground">· {entry.topic}</span></p>
                        <p className="line-clamp-2 text-muted-foreground">{entry.body}</p>
                      </div>
                      <Button size="icon-sm" variant="ghost" aria-label="Remove from collection" data-testid="remove-from-collection"
                        onClick={() => act(() => removeFromCollection({ data: { collectionId: collection.id, entryId: entry.entryId } }))}>
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {renaming ? (
        <Dialog open onOpenChange={(open) => { if (!open && !pending) setRenaming(null); }}>
          <DialogContent>
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                if (await act(() => renameCollection({ data: renaming }))) setRenaming(null);
              }}
            >
              <DialogHeader>
                <DialogTitle>Rename collection</DialogTitle>
              </DialogHeader>
              <Input data-testid="rename-input" aria-label="Name" value={renaming.name}
                onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRenaming(null)}>Cancel</Button>
                <Button type="submit" data-testid="rename-save" pending={pending} disabled={!renaming.name.trim()}>Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
      {deleting ? (
        <ConfirmDialog title="Delete this collection?" confirmLabel="Delete" destructive pending={pending}
          onConfirm={async () => { if (await act(() => deleteCollection({ data: { id: deleting } }))) setDeleting(null); }}
          onClose={() => setDeleting(null)}>
          The examples stay in the library.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
