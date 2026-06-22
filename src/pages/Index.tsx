import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useTasks, useActivities, useScheduleSettings, usePlanBlocks, usePlanBlockMutations, useTimeTracking, useTimeTrackingMutations, DbPlanBlock } from "@/hooks/useSupabaseData";
import { getTodayBlocks, getAvailableMinutesForDate } from "@/lib/planner";
import { TimelineBlock } from "@/components/TimelineBlock";
import { Clock, CheckCircle2, BookOpen, Sparkles } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const { data: tasks = [] } = useTasks();
  const { data: activities = [] } = useActivities();
  const { data: dbSettings } = useScheduleSettings();
  const { data: planBlocks = [] } = usePlanBlocks();
  const { updateBlock } = usePlanBlockMutations();
  const { data: tracking = [] } = useTimeTracking();
  const { addTracking } = useTimeTrackingMutations();

  const schoolEndTimes = (dbSettings?.school_end_times as Record<string, string>) || {
    monday: "15:30", tuesday: "15:30", wednesday: "15:30", thursday: "15:30", friday: "15:30",
  };
  const bedtime = dbSettings?.bedtime?.slice(0, 5) || "21:30";
  const commuteMinutes = dbSettings?.commute_minutes ?? 15;

  const todayBlocks = getTodayBlocks(planBlocks);
  const availableMinutes = getAvailableMinutesForDate(new Date(), schoolEndTimes, bedtime, commuteMinutes, activities);
  const completedBlocks = todayBlocks.filter((b) => b.completed && !b.is_break).length;
  const totalBlocks = todayBlocks.filter((b) => !b.is_break).length;
  const incompleteTasks = tasks.filter((t) => !t.completed).length;

  const toggleBlock = (id: string) => {
    const block = planBlocks.find((b) => b.id === id);
    if (block) {
      updateBlock.mutate({ id, completed: !block.completed });
    }
  };

  const moveBlock = (id: string, newDate: string, newStartTime: string) => {
    const block = planBlocks.find((b) => b.id === id);
    if (!block) return;
    const [h, m] = newStartTime.split(":").map(Number);
    const startMins = h * 60 + m;
    const endMins = startMins + block.duration_minutes;
    const endH = Math.floor(endMins / 60);
    const endM = endMins % 60;
    const newEndTime = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
    updateBlock.mutate({
      id,
      date: newDate,
      start_time: newStartTime,
      end_time: newEndTime,
      is_manual: true,
      is_locked: true,
    });
    toast.success("Blok verplaatst en vergrendeld!");
  };

  const handleTimerComplete = (block: DbPlanBlock, actualMinutes: number) => {
    addTracking.mutate({
      task_id: block.task_id,
      subject: block.subject,
      estimated_minutes: block.duration_minutes,
      actual_minutes: actualMinutes,
    });
    toast.success(`${actualMinutes} minuten geregistreerd!`);
  };

  const toggleLock = (id: string) => {
    const block = planBlocks.find((item) => item.id === id);
    if (block) updateBlock.mutate({ id, is_locked: !block.is_locked });
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
            <TimelineBlock
              key={block.id}
              block={block}
              onToggle={toggleBlock}
              onMove={moveBlock}
              onTimerComplete={handleTimerComplete}
              onLock={toggleLock}
              priorityScore={tasks.find((task) => task.id === block.task_id)?.priority_score}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-card/50 py-16 text-center">
          <Sparkles size={40} className="mb-3 text-primary/40" />
          <h3 className="font-display text-lg font-semibold">Nog geen plan voor vandaag</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Voeg huiswerk toe, stel je rooster in en ga naar de Planner om je studieplan te genereren.
          </p>
        </div>
      )}
    </div>
  );
};

export default Index;
