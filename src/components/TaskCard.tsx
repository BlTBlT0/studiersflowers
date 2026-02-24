import { Check, Pencil, Trash2, Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { TaskForm } from "./TaskForm";
import type { DbTask } from "@/hooks/useSupabaseData";

interface TaskCardProps {
  task: DbTask;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, data: { title: string; subject: string; due_date: string; estimated_minutes: number; priority: string }) => void;
}

export function TaskCard({ task, onToggle, onDelete, onEdit }: TaskCardProps) {
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
            {task.priority}
          </span>
        </div>
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
