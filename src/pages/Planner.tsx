import { Task, Activity, ScheduleSettings, PlanBlock, DEFAULT_SCHEDULE } from "@/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { generatePlan } from "@/lib/planner";
import { TimelineBlock } from "@/components/TimelineBlock";
import { Button } from "@/components/ui/button";
import { Wand2, CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

const Planner = () => {
  const [tasks] = useLocalStorage<Task[]>("studyflow-tasks", []);
  const [schedule] = useLocalStorage<ScheduleSettings>("studyflow-schedule", DEFAULT_SCHEDULE);
  const [activities] = useLocalStorage<Activity[]>("studyflow-activities", []);
  const [planBlocks, setPlanBlocks] = useLocalStorage<PlanBlock[]>("studyflow-plan", []);

  const handleGenerate = () => {
    const incompleteTasks = tasks.filter((t) => !t.completed);
    if (incompleteTasks.length === 0) {
      toast.error("No incomplete tasks to plan!");
      return;
    }
    const blocks = generatePlan(tasks, activities, schedule);
    setPlanBlocks(blocks);
    toast.success(`Plan generated with ${blocks.length} blocks!`);
  };

  const toggleBlock = (id: string) => {
    setPlanBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, completed: !b.completed } : b))
    );
  };

  // Group blocks by date
  const blocksByDate = planBlocks.reduce<Record<string, PlanBlock[]>>((acc, block) => {
    if (!acc[block.date]) acc[block.date] = [];
    acc[block.date].push(block);
    return acc;
  }, {});

  const dates = Object.keys(blocksByDate).sort();

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold">Planner</h1>
        <Button onClick={handleGenerate} className="gap-2">
          <Wand2 size={16} />
          Generate Plan
        </Button>
      </div>

      {dates.length > 0 ? (
        <div className="flex flex-col gap-6">
          {dates.map((date) => (
            <div key={date}>
              <h2 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold text-muted-foreground">
                <CalendarDays size={14} />
                {format(parseISO(date), "EEEE, MMM d")}
              </h2>
              <div className="flex flex-col gap-2">
                {blocksByDate[date].map((block) => (
                  <TimelineBlock key={block.id} block={block} onToggle={toggleBlock} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-card/50 py-16 text-center">
          <Wand2 size={40} className="mb-3 text-primary/40" />
          <h3 className="font-display text-lg font-semibold">Ready to plan</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Click "Generate Plan" to automatically schedule your homework into available time slots.
          </p>
        </div>
      )}
    </div>
  );
};

export default Planner;
