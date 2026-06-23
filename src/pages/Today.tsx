import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { Play, Square, Check, Bell, BellOff, Coffee, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlanBlocks, usePlanBlockMutations, useTimeTrackingMutations } from "@/hooks/useSupabaseData";
import { useReminders } from "@/hooks/useReminders";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function toMinutes(t: string) {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

const Today = () => {
  const { data: blocks = [] } = usePlanBlocks();
  const { updateBlock } = usePlanBlockMutations();
  const { addTracking } = useTimeTrackingMutations();
  const { enabled, permission, enable, disable } = useReminders();

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const today = format(now, "yyyy-MM-dd");
  const todayBlocks = useMemo(
    () =>
      blocks
        .filter((b) => b.date === today && !b.is_break)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [blocks, today]
  );

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const current = todayBlocks.find(
    (b) => !b.completed && toMinutes(b.start_time) <= nowMin && toMinutes(b.end_time) > nowMin
  );
  const next = todayBlocks.find((b) => !b.completed && toMinutes(b.start_time) > nowMin);
  const focusBlock = current || next;
  const isLive = !!current;

  // Local timer
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    if (running) return;
    setRunning(true);
    const start = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
  };

  const stopTimer = (markDone: boolean) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);
    if (focusBlock && elapsed > 5) {
      addTracking.mutate({
        task_id: focusBlock.task_id,
        subject: focusBlock.subject,
        estimated_minutes: focusBlock.duration_minutes,
        actual_minutes: Math.max(1, Math.round(elapsed / 60)),
      });
    }
    if (markDone && focusBlock) {
      updateBlock.mutate({ id: focusBlock.id, completed: true });
      toast.success("Blok afgevinkt!");
    }
    setElapsed(0);
  };

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const completed = todayBlocks.filter((b) => b.completed).length;
  const totalMin = todayBlocks.reduce((sum, b) => sum + b.duration_minutes, 0);
  const doneMin = todayBlocks.filter((b) => b.completed).reduce((sum, b) => sum + b.duration_minutes, 0);
  const pct = totalMin > 0 ? Math.round((doneMin / totalMin) * 100) : 0;

  const handleReminderToggle = async () => {
    if (enabled) {
      disable();
      toast("Herinneringen uit");
    } else {
      const ok = await enable();
      if (ok) toast.success("Herinneringen aan — je krijgt een ping 10 min vóór elk blok");
      else toast.error("Geef toestemming voor meldingen in je browser");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Vandaag</h1>
          <p className="text-sm text-muted-foreground">
            {format(now, "EEEE d MMMM", { locale: nl })} · {format(now, "HH:mm")}
          </p>
        </div>
        <Button
          variant={enabled ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={handleReminderToggle}
          disabled={typeof Notification === "undefined"}
        >
          {enabled ? <Bell size={14} /> : <BellOff size={14} />}
          {enabled ? "Aan" : "Herinneringen"}
        </Button>
      </div>

      {/* Hero focus card */}
      {focusBlock ? (
        <div
          className={cn(
            "rounded-3xl border-2 p-6 transition-all",
            isLive ? "border-primary bg-primary/5 shadow-[0_0_30px_-10px_hsl(var(--primary))]" : "bg-card"
          )}
        >
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1">
              {isLive ? <Sparkles size={12} className="text-primary" /> : <ArrowRight size={12} />}
              {isLive ? "Nu bezig" : "Volgende blok"}
            </span>
            <span>
              {focusBlock.start_time.slice(0, 5)} – {focusBlock.end_time.slice(0, 5)}
            </span>
          </div>
          <h2 className="mt-3 font-display text-2xl font-bold">{focusBlock.task_title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {focusBlock.subject} · {focusBlock.duration_minutes} min
          </p>
          {focusBlock.smart_explanation && (
            <p className="mt-2 text-xs text-muted-foreground">{focusBlock.smart_explanation}</p>
          )}

          {/* Big timer */}
          <div className="mt-6 flex flex-col items-center gap-4">
            <div className="font-mono text-5xl font-bold tabular-nums text-primary">
              {fmt(elapsed)}
            </div>
            <div className="flex gap-2">
              {!running ? (
                <Button size="lg" onClick={startTimer} className="gap-2">
                  <Play size={18} /> Start
                </Button>
              ) : (
                <Button size="lg" variant="outline" onClick={() => stopTimer(false)} className="gap-2">
                  <Square size={18} /> Pauze
                </Button>
              )}
              <Button size="lg" variant="default" onClick={() => stopTimer(true)} className="gap-2">
                <Check size={18} /> Klaar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-3xl border-2 border-dashed bg-card/50 py-12 text-center">
          <Coffee size={36} className="mb-2 text-primary/40" />
          <h3 className="font-display text-lg font-semibold">Klaar voor vandaag!</h3>
          <p className="mt-1 text-sm text-muted-foreground">Geen openstaande blokken meer.</p>
        </div>
      )}

      {/* Progress */}
      {todayBlocks.length > 0 && (
        <div className="rounded-2xl border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Voortgang vandaag</span>
            <span className="text-muted-foreground">
              {completed}/{todayBlocks.length} · {pct}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Rest of the day */}
      {todayBlocks.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Alle blokken vandaag</h3>
          <div className="flex flex-col gap-2">
            {todayBlocks.map((b) => (
              <div
                key={b.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border bg-card p-3",
                  b.completed && "opacity-50",
                  b.id === focusBlock?.id && "border-primary"
                )}
              >
                <div className="w-16 shrink-0 text-center">
                  <div className="text-sm font-semibold">{b.start_time.slice(0, 5)}</div>
                  <div className="text-[10px] text-muted-foreground">{b.end_time.slice(0, 5)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className={cn("text-sm font-medium", b.completed && "line-through")}>{b.task_title}</div>
                  <div className="text-xs text-muted-foreground">{b.subject} · {b.duration_minutes} min</div>
                </div>
                <button
                  onClick={() => updateBlock.mutate({ id: b.id, completed: !b.completed })}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border-2",
                    b.completed ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                  )}
                >
                  {b.completed && <Check size={12} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {permission === "denied" && (
        <p className="text-xs text-muted-foreground">
          Meldingen staan uit in je browser. Sta ze toe via je browserinstellingen om herinneringen te ontvangen.
        </p>
      )}
    </div>
  );
};

export default Today;