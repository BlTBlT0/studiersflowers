import { useTasks, useTaskMutations, usePlanBlockMutations, useGrades, useScheduleSettings } from "@/hooks/useSupabaseData";
import { TaskForm } from "@/components/TaskForm";
import { TaskCard } from "@/components/TaskCard";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calculatePriority, getSubjectGradeAverages } from "@/lib/smartPriority";
import type { DbTask } from "@/hooks/useSupabaseData";

const Homework = () => {
  const { data: tasks = [], isLoading } = useTasks();
  const { data: grades = [] } = useGrades();
  const { data: plannerSettings } = useScheduleSettings();
  const { addTask, updateTask, deleteTask } = useTaskMutations();
  const { addBlock } = usePlanBlockMutations();
  const [search, setSearch] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const handleAdd = (data: Parameters<typeof addTask.mutate>[0]) => {
    addTask.mutate(data);
  };

  const handleToggle = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (task) updateTask.mutate({ id, completed: !task.completed });
  };

  const handleDelete = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    deleteTask.mutate(id);
    toast("Taak verwijderd", {
      description: task.title,
      action: {
        label: "Ongedaan maken",
        onClick: () => {
          const { id: _id, user_id: _u, created_at: _c, ...rest } = task as DbTask & { user_id: string; created_at: string };
          addTask.mutate(rest as Parameters<typeof addTask.mutate>[0]);
        },
      },
      duration: 6000,
    });
  };

  const handleEdit = (id: string, data: Parameters<typeof addTask.mutate>[0]) => {
    updateTask.mutate({ id, ...data });
  };

  const handleManualPlan = (taskId: string, date: string, startTime: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const [hours, minutes] = startTime.split(":").map(Number);
    const end = hours * 60 + minutes + task.estimated_minutes;
    addBlock.mutate({
      task_id: task.id,
      task_title: task.title,
      subject: task.subject,
      date,
      start_time: startTime,
      end_time: `${Math.floor(end / 60).toString().padStart(2, "0")}:${(end % 60).toString().padStart(2, "0")}`,
      duration_minutes: task.estimated_minutes,
      completed: false,
      is_break: false,
      is_locked: true,
      is_manual: true,
      smart_explanation: "Handmatig ingepland en vergrendeld.",
      weather_impact: null,
    });
    toast.success("Taak handmatig ingepland en vergrendeld");
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
          priority_mode: "automatic",
          task_type: t.task_type || "homework",
          is_missing: false,
          smart_planning_enabled: true,
          is_daily_practice: t.is_daily_practice || false,
        });
      }

      toast.success(`${parsedTasks.length} ${parsedTasks.length === 1 ? "taak" : "taken"} toegevoegd!`);
      setAiText("");
      setAiOpen(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Er ging iets mis met AI");
    } finally {
      setAiLoading(false);
    }
  };

  const scoredTasks = useMemo(() => {
    const averages = getSubjectGradeAverages(grades);
    return tasks.map((task) => {
      const days = Math.max(1, Math.ceil((new Date(task.due_date).getTime() - Date.now()) / 86_400_000));
      const available = days * (plannerSettings?.max_study_minutes_per_day ?? 90);
      const workload = tasks
        .filter((item) => !item.completed && item.due_date <= task.due_date)
        .reduce((sum, item) => sum + item.estimated_minutes, 0);
      const result = calculatePriority(task, averages[task.subject], {
        smartPriorityEnabled: plannerSettings?.smart_priority_enabled ?? true,
        gradeBasedPlanning: plannerSettings?.grade_based_planning_enabled ?? true,
        availableMinutesBeforeDeadline: available,
        workloadMinutesBeforeDeadline: workload,
      });
      return {
        ...task,
        priority_score: result.score,
        priority: result.level,
        priority_explanation: result.explanation,
      };
    });
  }, [grades, plannerSettings, tasks]);

  const filtered = scoredTasks.filter(
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
          <TaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} onEdit={handleEdit} onManualPlan={handleManualPlan} />
        ))}
      </div>

      {completed.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Afgerond ({completed.length})
          </h3>
          <div className="flex flex-col gap-2">
            {completed.map((task) => (
              <TaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} onEdit={handleEdit} onManualPlan={handleManualPlan} />
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
