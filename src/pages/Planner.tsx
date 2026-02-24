import { useTasks, useActivities, useScheduleSettings, usePlanBlocks, usePlanBlockMutations, useTimeTracking, useTimeTrackingMutations, DbPlanBlock } from "@/hooks/useSupabaseData";
import { generatePlan } from "@/lib/planner";
import { TimelineBlock } from "@/components/TimelineBlock";
import { Button } from "@/components/ui/button";
import { Wand2, CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";

const Planner = () => {
  const { data: tasks = [] } = useTasks();
  const { data: activities = [] } = useActivities();
  const { data: dbSettings } = useScheduleSettings();
  const { data: planBlocks = [] } = usePlanBlocks();
  const { savePlan, updateBlock } = usePlanBlockMutations();
  const { data: tracking = [] } = useTimeTracking();
  const { addTracking } = useTimeTrackingMutations();

  const schoolEndTimes = (dbSettings?.school_end_times as Record<string, string>) || {
    monday: "15:30", tuesday: "15:30", wednesday: "15:30", thursday: "15:30", friday: "15:30",
  };
  const bedtime = dbSettings?.bedtime?.slice(0, 5) || "21:30";
  const commuteMinutes = dbSettings?.commute_minutes ?? 15;

  const handleGenerate = () => {
    const incompleteTasks = tasks.filter((t) => !t.completed);
    if (incompleteTasks.length === 0) {
      toast.error("Geen openstaande taken om in te plannen!");
      return;
    }
    const blocks = generatePlan(tasks, activities, schoolEndTimes, bedtime, commuteMinutes, tracking);
    savePlan.mutate(blocks);
    toast.success(`Plan gegenereerd met ${blocks.length} blokken!`);
  };

  const toggleBlock = (id: string) => {
    const block = planBlocks.find((b) => b.id === id);
    if (block) {
      updateBlock.mutate({ id, completed: !block.completed });
    }
  };

  const moveBlock = (id: string, newDate: string, newStartTime: string) => {
    const block = planBlocks.find((b) => b.id === id);
    if (!block) return;

    // Calculate new end time
    const [h, m] = newStartTime.split(":").map(Number);
    const startMins = h * 60 + m;
    const endMins = startMins + block.duration_minutes;
    const endH = Math.floor(endMins / 60);
    const endM = endMins % 60;
    const newEndTime = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;

    updateBlock.mutate({ id, date: newDate, start_time: newStartTime, end_time: newEndTime });
    toast.success("Blok verplaatst!");
  };

  const handleTimerComplete = (block: DbPlanBlock, actualMinutes: number) => {
    addTracking.mutate({
      task_id: block.task_id,
      subject: block.subject,
      estimated_minutes: block.duration_minutes,
      actual_minutes: actualMinutes,
    });
    toast.success(`${actualMinutes} minuten geregistreerd voor ${block.subject}. StudyFlow leert hiervan!`);
  };

  // Group blocks by date
  const blocksByDate = planBlocks.reduce<Record<string, DbPlanBlock[]>>((acc, block) => {
    if (!acc[block.date]) acc[block.date] = [];
    acc[block.date].push(block);
    return acc;
  }, {});

  const dates = Object.keys(blocksByDate).sort();

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold">Planner</h1>
        <Button onClick={handleGenerate} className="gap-2" disabled={savePlan.isPending}>
          <Wand2 size={16} />
          {savePlan.isPending ? "Bezig..." : "Plan genereren"}
        </Button>
      </div>

      {dates.length > 0 ? (
        <div className="flex flex-col gap-6">
          {dates.map((date) => (
            <div key={date}>
              <h2 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold text-muted-foreground">
                <CalendarDays size={14} />
                {format(parseISO(date), "EEEE d MMMM", { locale: nl })}
              </h2>
              <div className="flex flex-col gap-2">
                {blocksByDate[date].map((block) => (
                  <TimelineBlock
                    key={block.id}
                    block={block}
                    onToggle={toggleBlock}
                    onMove={moveBlock}
                    onTimerComplete={handleTimerComplete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-card/50 py-16 text-center">
          <Wand2 size={40} className="mb-3 text-primary/40" />
          <h3 className="font-display text-lg font-semibold">Klaar om te plannen</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Klik op "Plan genereren" om je huiswerk automatisch in te plannen in de beschikbare tijdsloten.
          </p>
        </div>
      )}
    </div>
  );
};

export default Planner;
