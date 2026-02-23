import { PlanBlock } from "@/types";
import { Check, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineBlockProps {
  block: PlanBlock;
  onToggle: (id: string) => void;
}

export function TimelineBlock({ block, onToggle }: TimelineBlockProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 transition-all animate-fade-in",
        block.isBreak
          ? "border-dashed border-accent/40 bg-accent/5"
          : "bg-card",
        block.completed && !block.isBreak && "opacity-50"
      )}
    >
      {/* Time column */}
      <div className="w-20 shrink-0 text-center">
        <div className="text-sm font-semibold text-foreground">{block.startTime}</div>
        <div className="text-[10px] text-muted-foreground">{block.endTime}</div>
      </div>

      {/* Divider */}
      <div className={cn(
        "h-10 w-0.5 shrink-0 rounded-full",
        block.isBreak ? "bg-accent/30" : "bg-primary/30"
      )} />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {block.isBreak && <Coffee size={14} className="text-accent" />}
          <span className={cn("text-sm font-medium", block.completed && "line-through")}>
            {block.taskTitle}
          </span>
        </div>
        {!block.isBreak && (
          <span className="text-xs text-muted-foreground">
            {block.subject} · {block.durationMinutes}min
          </span>
        )}
      </div>

      {/* Checkbox */}
      {!block.isBreak && (
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
      )}
    </div>
  );
}
