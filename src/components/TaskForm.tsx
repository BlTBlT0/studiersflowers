import { useState } from "react";
import { SUBJECTS } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

type Priority = "low" | "medium" | "high";

interface TaskFormData {
  title: string;
  subject: string;
  due_date: string;
  estimated_minutes: number;
  priority: string;
  is_daily_practice: boolean;
  practice_frequency: number;
}

interface TaskFormProps {
  onSave: (task: TaskFormData) => void;
  initial?: { title: string; subject: string; due_date: string; estimated_minutes: number; priority: string; is_daily_practice?: boolean; practice_frequency?: number };
  trigger?: React.ReactNode;
}

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "laag",
  medium: "gemiddeld",
  high: "hoog",
};

export function TaskForm({ onSave, initial, trigger }: TaskFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial?.title || "");
  const [subject, setSubject] = useState(initial?.subject || "");
  const [dueDate, setDueDate] = useState(initial?.due_date || "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(initial?.estimated_minutes?.toString() || "30");
  const [unknownTime, setUnknownTime] = useState(initial?.estimated_minutes === 30 && !initial?.title);
  const [priority, setPriority] = useState<Priority>((initial?.priority as Priority) || "medium");
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
      priority,
      is_daily_practice: isDailyPractice,
    });
    setOpen(false);
    if (!initial) {
      setTitle("");
      setSubject("");
      setDueDate("");
      setEstimatedMinutes("30");
      setUnknownTime(false);
      setPriority("medium");
      setIsDailyPractice(false);
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
                {SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
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
          {isDailyPractice && (
            <div className="ml-6">
              <Label>Minuten per dag</Label>
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
          )}
          <div>
            <Label>Prioriteit</Label>
            <div className="mt-1 flex gap-2">
              {(["low", "medium", "high"] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`priority-${p} rounded-full border px-3 py-1 text-xs font-medium capitalize transition-all ${priority === p ? "ring-2 ring-offset-1 ring-current" : "opacity-60"}`}
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
