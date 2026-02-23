import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { PlanBlock, Task, Activity, ScheduleSettings, DEFAULT_SCHEDULE } from "@/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { getTodayBlocks, getAvailableMinutes } from "@/lib/planner";
import { TimelineBlock } from "@/components/TimelineBlock";
import { Clock, CheckCircle2, BookOpen, Sparkles } from "lucide-react";

const Index = () => {
  const [tasks] = useLocalStorage<Task[]>("studyflow-tasks", []);
  const [schedule] = useLocalStorage<ScheduleSettings>("studyflow-schedule", DEFAULT_SCHEDULE);
  const [activities] = useLocalStorage<Activity[]>("studyflow-activities", []);
  const [planBlocks, setPlanBlocks] = useLocalStorage<PlanBlock[]>("studyflow-plan", []);

  const todayBlocks = getTodayBlocks(planBlocks);
  const availableMinutes = getAvailableMinutes(new Date(), schedule, activities);
  const completedBlocks = todayBlocks.filter((b) => b.completed && !b.isBreak).length;
  const totalBlocks = todayBlocks.filter((b) => !b.isBreak).length;
  const incompleteTasks = tasks.filter((t) => !t.completed).length;

  const toggleBlock = (id: string) => {
    setPlanBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, completed: !b.completed } : b))
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Plan van Vandaag</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE d MMMM", { locale: nl })}</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock size={16} />
            <span className="text-xs font-medium">Beschikbaar</span>
          </div>
          <p className="mt-1 font-display text-2xl font-bold">
            {Math.floor(availableMinutes / 60)}u {availableMinutes % 60}m
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 size={16} />
            <span className="text-xs font-medium">Voortgang</span>
          </div>
          <p className="mt-1 font-display text-2xl font-bold">
            {completedBlocks}/{totalBlocks}
          </p>
        </div>
        <div className="col-span-2 rounded-xl border bg-card p-4 sm:col-span-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BookOpen size={16} />
            <span className="text-xs font-medium">Openstaande Taken</span>
          </div>
          <p className="mt-1 font-display text-2xl font-bold">{incompleteTasks}</p>
        </div>
      </div>

      {/* Timeline */}
      {todayBlocks.length > 0 ? (
        <div className="flex flex-col gap-2">
          {todayBlocks.map((block) => (
            <TimelineBlock key={block.id} block={block} onToggle={toggleBlock} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-card/50 py-16 text-center">
          <Sparkles size={40} className="mb-3 text-primary/40" />
          <h3 className="font-display text-lg font-semibold">Nog geen plan gegenereerd</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Voeg huiswerk toe, stel je rooster in en ga naar de Planner om je studieplan te genereren.
          </p>
        </div>
      )}
    </div>
  );
};

export default Index;
