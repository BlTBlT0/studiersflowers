import { useTasks, useTaskMutations } from "@/hooks/useSupabaseData";
import { TaskForm } from "@/components/TaskForm";
import { TaskCard } from "@/components/TaskCard";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Homework = () => {
  const { data: tasks = [], isLoading } = useTasks();
  const { addTask, updateTask, deleteTask } = useTaskMutations();
  const [search, setSearch] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const handleAdd = (data: { title: string; subject: string; due_date: string; estimated_minutes: number; priority: string; is_daily_practice: boolean; practice_frequency: number }) => {
    addTask.mutate(data);
  };

  const handleToggle = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (task) updateTask.mutate({ id, completed: !task.completed });
  };

  const handleDelete = (id: string) => {
    deleteTask.mutate(id);
  };

  const handleEdit = (id: string, data: { title: string; subject: string; due_date: string; estimated_minutes: number; priority: string; is_daily_practice: boolean }) => {
    updateTask.mutate({ id, ...data });
  };

  const handleAiParse = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-homework", {
        body: { text: aiText },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const parsedTasks = data.tasks;
      if (!Array.isArray(parsedTasks) || parsedTasks.length === 0) {
        toast.error("Kon geen taken herkennen");
        return;
      }

      for (const t of parsedTasks) {
        addTask.mutate({
          title: t.title,
          subject: t.subject,
          due_date: t.due_date,
          estimated_minutes: t.estimated_minutes || 30,
          priority: t.priority || "medium",
          is_daily_practice: t.is_daily_practice || false,
        });
      }

      toast.success(`${parsedTasks.length} ${parsedTasks.length === 1 ? "taak" : "taken"} toegevoegd!`);
      setAiText("");
      setAiOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Er ging iets mis met AI");
    } finally {
      setAiLoading(false);
    }
  };

  const filtered = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase())
  );

  const incomplete = filtered.filter((t) => !t.completed);
  const completed = filtered.filter((t) => t.completed);

  if (isLoading) return <div className="py-16 text-center text-muted-foreground">Laden...</div>;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold">Huiswerk</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAiOpen(!aiOpen)}>
            <Sparkles size={16} className="mr-1" /> AI Invoer
          </Button>
          <TaskForm onSave={handleAdd} />
        </div>
      </div>

      {aiOpen && (
        <div className="mb-4 rounded-lg border bg-card p-4">
          <p className="mb-2 text-sm text-muted-foreground">
            Typ je huiswerk in gewone taal, bijv. <em>"Wiskunde blz 42-45 af voor donderdag"</em>
          </p>
          <Textarea
            placeholder="Typ je huiswerk hier..."
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            rows={3}
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={handleAiParse} disabled={aiLoading || !aiText.trim()}>
              {aiLoading ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Sparkles size={16} className="mr-1" />}
              Omzetten naar taken
            </Button>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Zoek taken..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex flex-col gap-2">
        {incomplete.map((task) => (
          <TaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} onEdit={handleEdit} />
        ))}
      </div>

      {completed.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Afgerond ({completed.length})
          </h3>
          <div className="flex flex-col gap-2">
            {completed.map((task) => (
              <TaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} onEdit={handleEdit} />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && !isLoading && (
        <div className="py-16 text-center text-muted-foreground">
          <p className="text-lg">Nog geen taken</p>
          <p className="text-sm">Klik op "Taak toevoegen" of gebruik AI Invoer</p>
        </div>
      )}
    </div>
  );
};

export default Homework;
