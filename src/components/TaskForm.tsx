import { useState } from "react";
import { Task, SUBJECTS, Priority } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

interface TaskFormProps {
  onSave: (task: Omit<Task, "id" | "completed" | "createdAt">) => void;
  initial?: Task;
  trigger?: React.ReactNode;
}

export function TaskForm({ onSave, initial, trigger }: TaskFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial?.title || "");
  const [subject, setSubject] = useState(initial?.subject || "");
  const [dueDate, setDueDate] = useState(initial?.dueDate || "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(initial?.estimatedMinutes?.toString() || "30");
  const [priority, setPriority] = useState<Priority>(initial?.priority || "medium");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !subject || !dueDate) return;
    onSave({ title, subject, dueDate, estimatedMinutes: parseInt(estimatedMinutes) || 30, priority });
    setOpen(false);
    if (!initial) {
      setTitle("");
      setSubject("");
      setDueDate("");
      setEstimatedMinutes("30");
      setPriority("medium");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <Plus size={16} />
            Add Task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Task" : "New Homework Task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Read Chapter 5..." required />
          </div>
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="minutes">Est. Minutes</Label>
              <Input id="minutes" type="number" min="5" max="480" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Priority</Label>
            <div className="mt-1 flex gap-2">
              {(["low", "medium", "high"] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`priority-${p} rounded-full border px-3 py-1 text-xs font-medium capitalize transition-all ${priority === p ? "ring-2 ring-offset-1 ring-current" : "opacity-60"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" className="mt-2">{initial ? "Save Changes" : "Add Task"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
