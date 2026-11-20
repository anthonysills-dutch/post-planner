import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { getStats } from "@/serverFunctions/stats";

const RANGES = [
  { value: "4", label: "Last 4 weeks" },
  { value: "8", label: "Last 8 weeks" },
  { value: "12", label: "Last 12 weeks" },
  { value: "26", label: "Last 26 weeks" },
];

export const Route = createFileRoute("/stats")({
  validateSearch: z.object({ weeks: z.enum(["4", "8", "12", "26"]).optional() }),
  loaderDeps: ({ search }) => ({ weeks: Number(search.weeks ?? "8") as 4 | 8 | 12 | 26 }),
  loader: ({ deps }) => getStats({ data: { weeks: deps.weeks } }),
  head: () => ({ meta: [{ title: "Stats · Post Planner" }] }),
  component: Stats,
});

type Column = "date" | "impressions" | "reactions" | "comments" | "reposts";
const NUMBER_COLUMNS = [
  ["impressions", "Impressions"],
  ["reactions", "Reactions"],
  ["comments", "Comments"],
  ["reposts", "Reposts"],
] as const;
const format = (n: number) => n.toLocaleString("en-US");

function Stats() {
  const stats = Route.useLoaderData();
  const { weeks } = Route.useLoaderDeps();
  const navigate = useNavigate();
  const [sort, setSort] = useState<{ column: Column; desc: boolean }>({ column: "date", desc: true });
  const peak = Math.max(stats.goal, ...stats.weeks.map((w) => w.count), 1);

  const rows = useMemo(() => {
    const key = (row: (typeof stats.posts)[number]) => (sort.column === "date" ? row.publishedAt : row[sort.column]);
    return [...stats.posts].sort((a, b) => (sort.desc ? key(b) - key(a) : key(a) - key(b)));
  }, [stats.posts, sort]);

  function toggle(column: Column) {
    setSort((current) => (current.column === column ? { column, desc: !current.desc } : { column, desc: true }));
  }

  return (
    <AppShell>
      <PageHeader
        title="Stats"
        actions={
          <SimpleSelect items={RANGES} value={String(weeks)} label="Range" testId="stats-range" className="w-40"
            onChange={(value) => navigate({ to: "/stats", search: { weeks: value as "4" | "8" | "12" | "26" } })} />
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Weekly goal" testId="stat-goal" value={`${format(stats.goal)} posts`} />
        <Metric label="Streak" testId="stat-streak" value={`${stats.streak} ${stats.streak === 1 ? "week" : "weeks"}`} />
        {NUMBER_COLUMNS.map(([key, label]) => (
          <Metric key={key} label={label} testId={`stat-${key}`} value={format(stats.totals[key])} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Posts per week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative flex h-40 items-end gap-1.5">
            <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-primary/60"
              style={{ bottom: `${(stats.goal / peak) * 100}%` }} aria-hidden />
            {stats.weeks.map((week) => (
              <div key={week.label} data-testid="week-bar" className="flex h-full min-w-0 flex-1 flex-col justify-end"
                title={`Week of ${week.label}: ${week.count}`}>
                <div className={week.count >= stats.goal ? "rounded-t bg-primary" : "rounded-t bg-primary/40"}
                  style={{ height: `${(week.count / peak) * 100}%`, minHeight: week.count ? 4 : 0 }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{stats.weeks[0]?.label}</span>
            <span>{stats.weeks.at(-1)?.label}</span>
          </div>
        </CardContent>
      </Card>

      {stats.posts.length === 0 ? (
        <EmptyState title="Nothing published in this range" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Post</TableHead>
                <TableHead><SortButton label="Published" active={sort.column === "date"} desc={sort.desc} onClick={() => toggle("date")} /></TableHead>
                {NUMBER_COLUMNS.map(([key, label]) => (
                  <TableHead key={key} className="text-right">
                    <SortButton label={label} active={sort.column === key} desc={sort.desc} onClick={() => toggle(key)} />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} data-testid="stats-row">
                  <TableCell className="max-w-64 truncate">
                    <Link to="/posts/$postId" params={{ postId: row.id }} className="hover:underline">{row.snippet}</Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                  {NUMBER_COLUMNS.map(([key]) => (
                    <TableCell key={key} className="text-right tabular-nums">{format(row[key])}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}

function Metric({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p data-testid={testId} className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SortButton({ label, active, desc, onClick }: { label: string; active: boolean; desc: boolean; onClick: () => void }) {
  const Icon = desc ? ArrowDown : ArrowUp;
  return (
    <button type="button" onClick={onClick} className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground">
      {label}
      {active ? <Icon className="size-3.5" aria-hidden /> : null}
    </button>
  );
}
