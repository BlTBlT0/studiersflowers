import { Task } from "@/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { TaskForm } from "@/components/TaskForm";
import { TaskCard } from "@/components/TaskCard";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const Homework = () => {
  const [tasks, setTasks] = useLocalStorage<Task[]>("studyflow-tasks", []);
  const [search, setSearch] = useState("");

  const addTask = (data: Omit<Task, "id" | "completed" | "createdAt">) => {
    const newTask: Task = {
      ...data,
      id: crypto.randomUUID(),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const editTask = (id: string, data: Omit<Task, "id" | "completed" | "createdAt">) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
  };

  const filtered = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase())
  );

  const incomplete = filtered.filter((t) => !t.completed);
  const completed = filtered.filter((t) => t.completed);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold">Homework</h1>
        <TaskForm onSave={addTask} />
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex flex-col gap-2">
        {incomplete.map((task) => (
          <TaskCard key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onEdit={editTask} />
        ))}
      </div>

      {completed.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Completed ({completed.length})
          </h3>
          <div className="flex flex-col gap-2">
            {completed.map((task) => (
              <TaskCard key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onEdit={editTask} />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          <p className="text-lg">No tasks yet</p>
          <p className="text-sm">Click "Add Task" to get started</p>
        </div>
      )}
    </div>
  );
};

export default Homework;
