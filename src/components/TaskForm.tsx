import { useState } from "react";
import { SUBJECTS } from "@/types";
import { useSubjects } from "@/hooks/useSupabaseData";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

type PriorityMode = "automatic" | "low" | "medium" | "high";

export interface TaskFormData {
  title: string;
  subject: string;
  due_date: string;
  estimated_minutes: number;
  priority: string;
  priority_mode: string;
  task_type: string;
  is_missing: boolean;
  smart_planning_enabled: boolean;
  is_daily_practice: boolean;
  practice_frequency: number;
}

interface TaskFormProps {
  onSave: (task: TaskFormData) => void;
  initial?: Partial<TaskFormData> & {
    title: string;
    subject: string;
    due_date: string;
    estimated_minutes: number;
    priority: string;
  };
  trigger?: React.ReactNode;
}

const PRIORITY_LABELS: Record<PriorityMode, string> = {
  automatic: "automatisch",
  low: "laag",
  medium: "gemiddeld",
  high: "hoog",
};

export function TaskForm({ onSave, initial, trigger }: TaskFormProps) {
  const { data: customSubjects = [] } = useSubjects();
  const subjects = [...new Set([...SUBJECTS, ...customSubjects.map((item) => item.name)])].sort();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial?.title || "");
  const [subject, setSubject] = useState(initial?.subject || "");
  const [dueDate, setDueDate] = useState(initial?.due_date || "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(initial?.estimated_minutes?.toString() || "30");
  const [unknownTime, setUnknownTime] = useState(initial?.estimated_minutes === 30 && !initial?.title);
  const [priorityMode, setPriorityMode] = useState<PriorityMode>(
    (initial?.priority_mode as PriorityMode) || "automatic"
  );
  const [taskType, setTaskType] = useState(initial?.task_type || "homework");
  const [isMissing, setIsMissing] = useState(initial?.is_missing || false);
  const [smartPlanningEnabled, setSmartPlanningEnabled] = useState(initial?.smart_planning_enabled ?? true);
  const [isDailyPractice, setIsDailyPractice] = useState(initial?.is_daily_practice || false);
  const [practiceFrequency, setPracticeFrequency] = useState(initial?.practice_frequency || 0); // 0 = elke dag

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !subject || !dueDate) return;
    onSave({
      title,
      subject,
      due_date: dueDate,
      estimated_minutes: unknownTime ? 30 : (parseInt(estimatedMinutes) || 30),
      priority: priorityMode === "automatic" ? "medium" : priorityMode,
      priority_mode: priorityMode,
      task_type: taskType,
      is_missing: isMissing,
      smart_planning_enabled: smartPlanningEnabled,
      is_daily_practice: isDailyPractice,
      practice_frequency: isDailyPractice ? practiceFrequency : 0,
    });
    setOpen(false);
    if (!initial) {
      setTitle("");
      setSubject("");
      setDueDate("");
      setEstimatedMinutes("30");
      setUnknownTime(false);
      setPriorityMode("automatic");
      setTaskType("homework");
      setIsMissing(false);
      setSmartPlanningEnabled(true);
      setIsDailyPractice(false);
      setPracticeFrequency(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <Plus size={16} />
            Taak toevoegen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Taak bewerken" : "Nieuwe huiswerktaak"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="title">Titel</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Hoofdstuk 5 lezen..." required />
          </div>
          <div>
            <Label htmlFor="subject">Vak</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger><SelectValue placeholder="Kies een vak" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Taaktype</Label>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="homework">Huiswerk</SelectItem>
                <SelectItem value="test">Toets</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="revision">Herhalen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dueDate">Deadline</Label>
              <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="minutes">Geschatte minuten</Label>
              <Input id="minutes" type="number" min="5" max="480" value={unknownTime ? "" : estimatedMinutes} onChange={(e) => { setEstimatedMinutes(e.target.value); setUnknownTime(false); }} disabled={unknownTime} placeholder={unknownTime ? "Weet niet" : ""} />
              <label className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox checked={unknownTime} onCheckedChange={(c) => { setUnknownTime(!!c); if (c) setEstimatedMinutes("30"); }} />
                Weet niet
              </label>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={isDailyPractice} onCheckedChange={(c) => setIsDailyPractice(!!c)} />
            <span className="text-sm">Dagelijks oefenen</span>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3">
              <Checkbox checked={isMissing} onCheckedChange={(checked) => setIsMissing(!!checked)} />
              <span className="text-sm">Ontbrekend huiswerk</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3">
              <Checkbox
                checked={smartPlanningEnabled}
                onCheckedChange={(checked) => setSmartPlanningEnabled(!!checked)}
              />
              <span className="text-sm">Slim inplannen</span>
            </label>
          </div>
          {isDailyPractice && (
            <div className="ml-6 flex flex-col gap-3">
              <div>
                <Label>Hoe vaak oefenen?</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {[
                    { value: 0, label: "Elke dag" },
                    { value: 2, label: "2×" },
                    { value: 3, label: "3×" },
                    { value: 4, label: "4×" },
                    { value: 5, label: "5×" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPracticeFrequency(opt.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                        practiceFrequency === opt.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-secondary-foreground border-border opacity-70 hover:opacity-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {practiceFrequency > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {practiceFrequency}× verspreid tot de deadline
                  </p>
                )}
              </div>
              <div>
                <Label>Minuten per sessie</Label>
                <div className="mt-1 flex gap-2">
                  {[5, 10, 15, 20, 30].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setEstimatedMinutes(m.toString())}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                        parseInt(estimatedMinutes) === m
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-secondary-foreground border-border opacity-70 hover:opacity-100"
                      }`}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div>
            <Label>Prioriteit</Label>
            <div className="mt-1 flex gap-2">
              {(["automatic", "low", "medium", "high"] as PriorityMode[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriorityMode(p)}
                  className={`${p === "automatic" ? "bg-primary/10 text-primary border-primary/30" : `priority-${p}`} rounded-full border px-3 py-1 text-xs font-medium capitalize transition-all ${priorityMode === p ? "ring-2 ring-offset-1 ring-current" : "opacity-60"}`}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" className="mt-2">{initial ? "Opslaan" : "Taak toevoegen"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
