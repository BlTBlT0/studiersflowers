import { useState } from "react";
import { Check, Pencil, Trash2, Clock, Calendar, CalendarPlus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { TaskForm } from "./TaskForm";
import type { TaskFormData } from "./TaskForm";
import type { DbTask } from "@/hooks/useSupabaseData";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface TaskCardProps {
  task: DbTask;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, data: TaskFormData) => void;
  onManualPlan?: (id: string, date: string, startTime: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  homework: "huiswerk",
  test: "toets",
  project: "project",
  revision: "herhalen",
};

export function TaskCard({ task, onToggle, onDelete, onEdit, onManualPlan }: TaskCardProps) {
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDate, setManualDate] = useState(task.due_date);
  const [manualTime, setManualTime] = useState("16:00");
  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-xl border bg-card p-4 transition-all animate-fade-in",
        task.completed && "opacity-50"
      )}
    >
      <button
        onClick={() => onToggle(task.id)}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          task.completed
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30 hover:border-primary"
        )}
      >
        {task.completed && <Check size={12} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("font-medium", task.completed && "line-through")}>{task.title}</span>
          <span className={`priority-${task.priority} rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase`}>
             {task.priority_score}
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">
            {TYPE_LABELS[task.task_type] || "huiswerk"}
          </span>
          {task.priority_mode === "automatic" && <Sparkles size={13} className="text-primary" />}
          {task.is_missing && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
              ontbreekt
            </span>
          )}
          {task.is_daily_practice && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
              📖 dagelijks
            </span>
          )}
        </div>
        {task.priority_explanation && !task.completed && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {task.priority_explanation}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="rounded bg-secondary px-1.5 py-0.5 font-medium text-secondary-foreground">
            {task.subject}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {task.estimated_minutes}m
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {format(parseISO(task.due_date), "d MMM", { locale: nl })}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {onManualPlan && !task.completed && (
          <Dialog open={manualOpen} onOpenChange={setManualOpen}>
            <DialogTrigger asChild>
              <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <CalendarPlus size={14} />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xs">
              <DialogHeader><DialogTitle>Handmatig inplannen</DialogTitle></DialogHeader>
              <div className="flex flex-col gap-3">
                <div><Label>Datum</Label><Input type="date" value={manualDate} onChange={(event) => setManualDate(event.target.value)} /></div>
                <div><Label>Starttijd</Label><Input type="time" value={manualTime} onChange={(event) => setManualTime(event.target.value)} /></div>
                <Button onClick={() => { onManualPlan(task.id, manualDate, manualTime); setManualOpen(false); }}>
                  Inplannen en vergrendelen
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        <TaskForm
          initial={task}
          onSave={(data) => onEdit(task.id, data)}
          trigger={
            <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <Pencil size={14} />
            </button>
          }
        />
        <button
          onClick={() => onDelete(task.id)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
