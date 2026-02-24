import { useState } from "react";
import { Check, Coffee, GripVertical, MoveHorizontal, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DbPlanBlock } from "@/hooks/useSupabaseData";

interface TimelineBlockProps {
  block: DbPlanBlock;
  onToggle: (id: string) => void;
  onMove?: (id: string, newDate: string, newStartTime: string) => void;
  onTimerComplete?: (block: DbPlanBlock, actualMinutes: number) => void;
}

export function TimelineBlock({ block, onToggle, onMove, onTimerComplete }: TimelineBlockProps) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [newDate, setNewDate] = useState(block.date);
  const [newTime, setNewTime] = useState(block.start_time.slice(0, 5));

  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const startTimer = () => {
    setTimerRunning(true);
    const start = Date.now();
    setTimerStart(start);
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    (window as any).__sf_timer = interval;
  };

  const stopTimer = () => {
    setTimerRunning(false);
    clearInterval((window as any).__sf_timer);
    const actualMinutes = Math.max(1, Math.round(elapsed / 60));
    if (onTimerComplete) onTimerComplete(block, actualMinutes);
    setElapsed(0);
    setTimerStart(null);
  };

  const handleMove = () => {
    if (onMove) onMove(block.id, newDate, newTime);
    setMoveOpen(false);
  };

  const formatElapsed = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 transition-all animate-fade-in",
        block.is_break
          ? "border-dashed border-accent/40 bg-accent/5"
          : "bg-card",
        block.completed && !block.is_break && "opacity-50",
        isDragging && "opacity-30 shadow-lg"
      )}
    >
      {/* Drag handle */}
      {!block.is_break && (
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>
      )}

      {/* Time column */}
      <div className="w-20 shrink-0 text-center">
        <div className="text-sm font-semibold text-foreground">{block.start_time.slice(0, 5)}</div>
        <div className="text-[10px] text-muted-foreground">{block.end_time.slice(0, 5)}</div>
      </div>

      {/* Divider */}
      <div className={cn(
        "h-10 w-0.5 shrink-0 rounded-full",
        block.is_break ? "bg-accent/30" : "bg-primary/30"
      )} />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {block.is_break && <Coffee size={14} className="text-accent" />}
          <span className={cn("text-sm font-medium", block.completed && "line-through")}>
            {block.is_break ? "Pauze 🧃" : block.task_title}
          </span>
          {timerRunning && (
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-mono font-bold text-primary animate-pulse">
              {formatElapsed(elapsed)}
            </span>
          )}
        </div>
        {!block.is_break && (
          <span className="text-xs text-muted-foreground">
            {block.subject} · {block.duration_minutes} min
          </span>
        )}
      </div>

      {/* Actions */}
      {!block.is_break && (
        <div className="flex shrink-0 items-center gap-1">
          {!block.completed && (
            timerRunning ? (
              <button onClick={stopTimer} className="rounded-md p-1.5 text-destructive hover:bg-destructive/10" title="Stop timer">
                <Square size={14} />
              </button>
            ) : (
              <button onClick={startTimer} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Start timer">
                <Play size={14} />
              </button>
            )
          )}

          {onMove && !block.completed && (
            <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
              <DialogTrigger asChild>
                <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Verplaats">
                  <MoveHorizontal size={14} />
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xs">
                <DialogHeader>
                  <DialogTitle>Blok verplaatsen</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                  <div>
                    <Label>Nieuwe datum</Label>
                    <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Nieuwe starttijd</Label>
                    <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                  </div>
                  <Button onClick={handleMove}>Verplaatsen</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <button
            onClick={() => onToggle(block.id)}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              block.completed
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/30 hover:border-primary"
            )}
          >
            {block.completed && <Check size={12} />}
          </button>
        </div>
      )}
    </div>
  );
}
