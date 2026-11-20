import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft, Copy, ExternalLink, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { CopyButton } from "@/client/components/CopyButton";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/client/components/ui/toggle-group";
import type { PostStatus } from "@/db/schema";
import type { AssistRequest } from "@/server/ai";
import { STATUS_BADGE, STATUS_LABELS, errorMessage } from "@/client/lib/status";
import {
  addToQueue,
  askAi,
  createShareLink,
  deletePost,
  duplicatePost,
  getEditor,
  revokeShareLink,
  saveMetrics,
  savePost,
  scheduleAt,
  unschedule,
} from "@/serverFunctions/posts";

const MAX = 3000;
const WORKING = ["idea", "draft", "ready"] as const;
type Working = (typeof WORKING)[number];

export const Route = createFileRoute("/posts/$postId")({
  loader: ({ params }) => getEditor({ data: { id: params.postId } }),
  head: () => ({ meta: [{ title: "Post · Post Planner" }] }),
  component: Editor,
});

type Data = ReturnType<typeof Route.useLoaderData>;
type Post = NonNullable<Data["post"]>;

function Editor() {
  const data = Route.useLoaderData();
  if (!data.post) {
    return (
      <AppShell>
        <PageHeader title="Post" backLink={<BackToBoard />} />
        <div data-testid="post-not-found">
          <EmptyState kind="filtered" title="Post not found" action={<Button render={<Link to="/" />}>Back to posts</Button>} />
        </div>
      </AppShell>
    );
  }
  return <PostEditor key={data.post.id} post={data.post} data={data} />;
}

function BackToBoard() {
  return (
    <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ChevronLeft className="size-4" aria-hidden /> Posts
    </Link>
  );
}

function PostEditor({ post, data }: { post: Post; data: Data }) {
  const router = useRouter();
  const navigate = useNavigate();
  const [body, setBody] = useState(post.body);
  const [status, setStatus] = useState<Working | null>(
    (WORKING as readonly string[]).includes(post.status) ? (post.status as Working) : null,
  );
  const [savedBody, setSavedBody] = useState(post.body);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const published = post.status === "published";
  const dirty = body !== savedBody || (status !== null && status !== post.status);
  const over = body.length > MAX;

  useEffect(() => {
    setStatus((WORKING as readonly string[]).includes(post.status) ? (post.status as Working) : null);
  }, [post.status]);

  async function run(name: string, work: () => Promise<{ ok: boolean; error?: string } | unknown>, success?: string) {
    setBusy(name);
    try {
      const result = (await work()) as { ok?: boolean; error?: string } | null;
      if (result && result.ok === false) {
        toast.error(result.error ?? "That didn't work. Try again.");
        return false;
      }
      if (success) toast.success(success);
      await router.invalidate();
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setSaveState("saving");
    const ok = await run("save", () =>
      savePost({ data: { id: post.id, body, ...(status && status !== post.status ? { status } : {}) } }),
    );
    if (ok) setSavedBody(body);
    setSaveState("saved");
  }

  async function duplicate() {
    setBusy("duplicate");
    try {
      const copy = await duplicatePost({ data: { id: post.id } });
      if (copy) await navigate({ to: "/posts/$postId", params: { postId: copy.id } });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      await deletePost({ data: { id: post.id } });
      await navigate({ to: "/" });
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(null);
    }
  }

  return (
    <AppShell wide>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Post
            <Badge data-testid="post-status" variant={STATUS_BADGE[post.status as PostStatus]}>
              {STATUS_LABELS[post.status as PostStatus]}
            </Badge>
          </span>
        }
        backLink={<BackToBoard />}
        actions={
          <>
            <Button variant="outline" data-testid="duplicate-post" onClick={duplicate} pending={busy === "duplicate"}>
              <Copy /> Duplicate
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete post"
              data-testid="delete-post"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 />
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="min-w-0 space-y-6">
          {published ? (
            <Card>
              <CardContent className="space-y-3">
                <p data-testid="post-body-readonly" className="break-words whitespace-pre-wrap">
                  {post.body}
                </p>
                {post.externalUrl ? (
                  <a
                    data-testid="published-link"
                    href={post.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    View on LinkedIn <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <Textarea
                data-testid="post-body"
                aria-label="Post"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Write your post"
                className="min-h-72 bg-card"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <ToggleGroup
                  value={status ? [status] : []}
                  onValueChange={(value) => {
                    const next = value[0] as Working | undefined;
                    if (next) setStatus(next);
                  }}
                  variant="outline"
                  size="sm"
                  aria-label="Status"
                >
                  {WORKING.map((option) => (
                    <ToggleGroupItem key={option} value={option} data-testid={`status-${option}`}>
                      {STATUS_LABELS[option]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <div className="flex items-center gap-3">
                  <span data-testid="char-count" className={over ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
                    {body.length} / {MAX}
                  </span>
                  <span data-testid="save-state" className="text-sm text-muted-foreground">
                    {saveState === "saving" ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}
                  </span>
                  <Button data-testid="save-post" onClick={save} disabled={over || !dirty} pending={busy === "save"}>
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!published ? <AiHelp available={data.ai} body={body} onAccept={setBody} /> : null}
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent data-testid="post-preview" className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
                  {data.profile.displayName.charAt(0).toUpperCase()}
                </div>
                <p data-testid="preview-author" className="font-medium">
                  {data.profile.displayName}
                </p>
              </div>
              <p className="text-sm break-words whitespace-pre-wrap">
                {(published ? post.body : body) || <span className="text-muted-foreground">Nothing written yet</span>}
              </p>
            </CardContent>
          </Card>

          {published ? (
            <Metrics post={post} />
          ) : (
            <Scheduling post={post} timeZone={data.profile.timeZone} busy={busy} run={run} />
          )}

          <Sharing post={post} origin={data.origin} busy={busy} run={run} />
        </div>
      </div>

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete this post?"
          confirmLabel="Delete"
          destructive
          pending={busy === "delete"}
          onConfirm={remove}
          onClose={() => setConfirmDelete(false)}
        >
          Its preview link stops working too.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}

type Run = (name: string, work: () => Promise<unknown>, success?: string) => Promise<boolean>;

function Scheduling({ post, timeZone, busy, run }: { post: Post; timeZone: string; busy: string | null; run: Run }) {
  const [at, setAt] = useState("");
  const scheduled = post.status === "scheduled";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {scheduled && post.scheduledAt ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p data-testid="scheduled-for" className="text-sm">
              {formatWhen(post.scheduledAt, timeZone)}
            </p>
            <Button variant="outline" size="sm" data-testid="unschedule" pending={busy === "unschedule"}
              onClick={() => run("unschedule", () => unschedule({ data: { id: post.id } }))}>
              Unschedule
            </Button>
          </div>
        ) : null}
        {post.status === "failed" && post.failureReason ? (
          <Alert variant="destructive">
            <AlertDescription data-testid="failure-reason">{post.failureReason}</AlertDescription>
          </Alert>
        ) : null}
        {!scheduled ? (
          <Button className="w-full" data-testid="add-to-queue" pending={busy === "queue"}
            onClick={() => run("queue", () => addToQueue({ data: { id: post.id } }))}>
            Add to queue
          </Button>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="schedule-at">{scheduled ? "Move to" : "Or pick a time"}</Label>
          <div className="flex gap-2">
            <Input id="schedule-at" type="datetime-local" data-testid="schedule-at-input" value={at}
              onChange={(event) => setAt(event.target.value)} className="bg-card" />
            <Button variant="outline" data-testid="schedule-at" pending={busy === "at"} disabled={!at}
              onClick={() => run("at", () => scheduleAt({ data: { id: post.id, at } }))}>
              Schedule
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{timeZone}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Metrics({ post }: { post: Post }) {
  const router = useRouter();
  const [values, setValues] = useState({
    impressions: String(post.impressions),
    reactions: String(post.reactions),
    comments: String(post.comments),
    reposts: String(post.reposts),
  });
  const [pending, setPending] = useState(false);
  const fields = [
    ["impressions", "Impressions"],
    ["reactions", "Reactions"],
    ["comments", "Comments"],
    ["reposts", "Reposts"],
  ] as const;
  async function save() {
    setPending(true);
    try {
      const numbers = Object.fromEntries(fields.map(([key]) => [key, Math.max(0, Math.floor(Number(values[key]) || 0))]));
      await saveMetrics({ data: { id: post.id, ...(numbers as Record<(typeof fields)[number][0], number>) } });
      toast.success("Numbers saved");
      await router.invalidate();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Numbers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {fields.map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`metric-${key}`}>{label}</Label>
              <Input id={`metric-${key}`} data-testid={`metric-${key}`} type="number" min={0} inputMode="numeric"
                value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
            </div>
          ))}
        </div>
        <Button data-testid="save-metrics" onClick={save} pending={pending}>Save numbers</Button>
      </CardContent>
    </Card>
  );
}

function Sharing({ post, origin, busy, run }: { post: Post; origin: string; busy: string | null; run: Run }) {
  const url = post.shareToken ? `${origin}/s/${post.shareToken}` : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview link</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {url ? (
          <>
            <div className="flex gap-2">
              <Input data-testid="share-link" readOnly value={url} aria-label="Preview link" className="bg-card" />
              <CopyButton value={url} successMessage="Link copied" />
            </div>
            <Button variant="outline" size="sm" data-testid="revoke-share-link" pending={busy === "revoke"}
              onClick={() => run("revoke", () => revokeShareLink({ data: { id: post.id } }))}>
              Revoke link
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Anyone with the link can read this post, including people outside your organization.</p>
            <Button variant="outline" data-testid="create-share-link" pending={busy === "share"}
              onClick={() => run("share", () => createShareLink({ data: { id: post.id } }))}>
              Create link
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const TONES = [
  ["professional", "Professional"],
  ["casual", "Casual"],
  ["storytelling", "Storytelling"],
] as const;

function AiHelp({ available, body, onAccept }: { available: boolean; body: string; onAccept: (text: string) => void }) {
  const [idea, setIdea] = useState("");
  const [off, setOff] = useState(!available);
  const [pending, setPending] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  async function ask(name: string, input: AssistRequest) {
    setPending(name);
    try {
      const result = await askAi({ data: input });
      if (result.ok) setSuggestion(result.text);
      else {
        if (result.off) setOff(true);
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(null);
    }
  }

  const noBody = !body.trim();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden /> Writing help
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {off ? (
          <Alert data-testid="ai-off">
            <AlertDescription>No AI model is set up for this workspace. An admin can add one in the Gateway.</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex gap-2">
          <Input data-testid="ai-idea" aria-label="Idea" placeholder="A short idea" value={idea} disabled={off}
            onChange={(event) => setIdea(event.target.value)} className="bg-card" />
          <Button data-testid="ai-draft" disabled={off || !idea.trim()} pending={pending === "draft"}
            onClick={() => ask("draft", { action: "draft", idea })}>
            Draft
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" data-testid="ai-hook" disabled={off || noBody} pending={pending === "hook"}
            onClick={() => ask("hook", { action: "hook", body })}>
            Rewrite hook
          </Button>
          <Button variant="outline" size="sm" data-testid="ai-shorten" disabled={off || noBody} pending={pending === "shorten"}
            onClick={() => ask("shorten", { action: "shorten", body })}>
            Shorten
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={off || noBody}
              data-testid="ai-tone"
              render={<Button variant="outline" size="sm" pending={pending === "tone"} />}
            >
              Change tone <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {TONES.map(([tone, label]) => (
                <DropdownMenuItem key={tone} onClick={() => ask("tone", { action: "tone", tone, body })}>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {suggestion !== null ? (
          <div data-testid="ai-suggestion" className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-sm break-words whitespace-pre-wrap">{suggestion}</p>
            <div className="flex gap-2">
              <Button size="sm" data-testid="ai-accept" onClick={() => { onAccept(suggestion); setSuggestion(null); }}>
                Use this
              </Button>
              <Button size="sm" variant="ghost" data-testid="ai-discard" onClick={() => setSuggestion(null)}>
                Discard
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatWhen(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(ms);
}
