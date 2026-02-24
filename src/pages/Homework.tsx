import { useTasks, useTaskMutations } from "@/hooks/useSupabaseData";
import { TaskForm } from "@/components/TaskForm";
import { TaskCard } from "@/components/TaskCard";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const Homework = () => {
  const { data: tasks = [], isLoading } = useTasks();
  const { addTask, updateTask, deleteTask } = useTaskMutations();
  const [search, setSearch] = useState("");

  const handleAdd = (data: { title: string; subject: string; due_date: string; estimated_minutes: number; priority: string; is_daily_practice: boolean }) => {
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
        <TaskForm onSave={handleAdd} />
      </div>

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
          <p className="text-sm">Klik op "Taak toevoegen" om te beginnen</p>
        </div>
      )}
    </div>
  );
};

export default Homework;
