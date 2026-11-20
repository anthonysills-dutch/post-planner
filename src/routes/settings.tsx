import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { errorMessage } from "@/client/lib/status";
import { addSlots, getSettings, removeSlot, saveSettings } from "@/serverFunctions/settings";

export const Route = createFileRoute("/settings")({
  loader: () => getSettings(),
  head: () => ({ meta: [{ title: "Settings · Post Planner" }] }),
  component: Settings,
});

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_CHOICES = [
  ...DAY_NAMES.map((name, i) => ({ value: String(i + 1), label: name })),
  { value: "weekdays", label: "Weekdays" },
  { value: "every", label: "Every day" },
];

function zones(current: string): { value: string; label: string }[] {
  const all = new Set<string>(["UTC", current]);
  try {
    for (const zone of Intl.supportedValuesOf("timeZone")) all.add(zone);
  } catch {
    // An older engine lists none; UTC and the saved zone remain.
  }
  return [...all].sort().map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }));
}

function Settings() {
  const settings = Route.useLoaderData();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(settings.displayName);
  const [timeZone, setTimeZone] = useState(settings.timeZone);
  const [goal, setGoal] = useState(String(settings.weeklyGoal));
  const [saving, setSaving] = useState(false);
  const [day, setDay] = useState("1");
  const [time, setTime] = useState("09:00");
  const [adding, setAdding] = useState(false);
  const zoneItems = useMemo(() => zones(settings.timeZone), [settings.timeZone]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveSettings({ data: { displayName, timeZone, weeklyGoal: Math.floor(Number(goal)) } });
      toast.success("Settings saved");
      await router.invalidate();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function add() {
    setAdding(true);
    const weekdays = day === "every" ? [1, 2, 3, 4, 5, 6, 7] : day === "weekdays" ? [1, 2, 3, 4, 5] : [Number(day)];
    try {
      await addSlots({ data: { weekdays, time } });
      await router.invalidate();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    try {
      await removeSlot({ data: { id } });
      await router.invalidate();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <AppShell>
      <PageHeader title="Settings" />

      <Card>
        <CardHeader>
          <CardTitle>Profile and goal</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={save}>
            <div className="space-y-1.5">
              <Label htmlFor="display-name">Display name</Label>
              <Input id="display-name" data-testid="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weekly-goal">Posts per week</Label>
              <Input id="weekly-goal" data-testid="weekly-goal" type="number" min={1} max={50} value={goal} onChange={(e) => setGoal(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Time zone</Label>
              <SimpleSelect items={zoneItems} value={timeZone} onChange={setTimeZone} label="Time zone" testId="timezone" className="w-full" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" data-testid="save-settings" pending={saving}>Save</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Posting times</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <SimpleSelect items={DAY_CHOICES} value={day} onChange={setDay} label="Day" testId="slot-day" className="w-40" />
            <Input type="time" aria-label="Time" data-testid="slot-time" value={time} onChange={(e) => setTime(e.target.value)} className="w-32" />
            <Button variant="outline" data-testid="add-slot" onClick={add} pending={adding} disabled={!time}>Add</Button>
          </div>
          {settings.slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posting times yet. Add to queue needs at least one.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {settings.slots.map((slot) => (
                <li key={slot.id} data-testid="slot-row" className="flex items-center justify-between px-3 py-1.5 text-sm">
                  <span>
                    {DAY_NAMES[slot.weekday - 1]} · {String(Math.floor(slot.minute / 60)).padStart(2, "0")}:{String(slot.minute % 60).padStart(2, "0")}
                  </span>
                  <Button variant="ghost" size="icon-sm" aria-label="Remove time" className="text-muted-foreground hover:text-destructive" onClick={() => remove(slot.id)}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>LinkedIn</CardTitle>
        </CardHeader>
        <CardContent data-testid="linkedin-status" className="space-y-3 text-sm">
          {settings.linkedin.state === "connected" ? (
            <Badge variant="success">Connected</Badge>
          ) : settings.linkedin.state === "connect" ? (
            <>
              <p className="text-muted-foreground">Scheduled posts go out from your own LinkedIn account.</p>
              <Button render={<a href={settings.linkedin.url} />}>Connect LinkedIn</Button>
            </>
          ) : (
            <p className="text-muted-foreground">
              {settings.linkedin.setup ?? "Publishing to LinkedIn isn't set up for this workspace."} Until it is, due posts are marked Failed.
            </p>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
