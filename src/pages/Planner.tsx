import { useState } from "react";
import { useTasks, useTaskMutations, useActivities, useScheduleSettings, usePlanBlocks, usePlanBlockMutations, useTimeTrackingMutations, DbPlanBlock, useGrades } from "@/hooks/useSupabaseData";
import { generateSmartPlan, isPreservedPlanBlock, type SmartPlannerSettings } from "@/lib/planner";
import { loadWeatherForecast } from "@/lib/weather";
import { TimelineBlock } from "@/components/TimelineBlock";
import { Button } from "@/components/ui/button";
import { Wand2, CalendarDays, HeartPulse, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { nl } from "date-fns/locale";
import { toast } from "sonner";
import { downloadIcs } from "@/lib/icsExport";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

const Planner = () => {
  const { data: tasks = [] } = useTasks();
  const { applyTaskScores } = useTaskMutations();
  const { data: grades = [] } = useGrades();
  const { data: activities = [] } = useActivities();
  const { data: dbSettings } = useScheduleSettings();
  const { data: planBlocks = [] } = usePlanBlocks();
  const { savePlan, updateBlock } = usePlanBlockMutations();
  const { addTracking } = useTimeTrackingMutations();
  const [activeBlock, setActiveBlock] = useState<DbPlanBlock | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sickOpen, setSickOpen] = useState(false);
  const [sickDate, setSickDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const { user } = useAuth();
  const qc = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const schoolEndTimes = (dbSettings?.school_end_times as Record<string, string>) || {
    monday: "15:30", tuesday: "15:30", wednesday: "15:30", thursday: "15:30", friday: "15:30",
  };
  const bedtime = dbSettings?.bedtime?.slice(0, 5) || "21:30";
  const commuteMinutes = dbSettings?.commute_minutes ?? 15;

  const plannerSettings: SmartPlannerSettings = {
    schoolEndTimes,
    bedtime,
    commuteMinutes,
    smartPriorityEnabled: dbSettings?.smart_priority_enabled ?? true,
    gradeBasedPlanningEnabled: dbSettings?.grade_based_planning_enabled ?? true,
    weekdayStudyStart: dbSettings?.weekday_study_start?.slice(0, 5) || "16:00",
    weekdayStudyEnd: dbSettings?.weekday_study_end?.slice(0, 5) || bedtime,
    weekendStudyStart: dbSettings?.weekend_study_start?.slice(0, 5) || "10:00",
    weekendStudyEnd: dbSettings?.weekend_study_end?.slice(0, 5) || "18:00",
    wakeTime: dbSettings?.wake_time?.slice(0, 5) || "07:00",
    maxStudyMinutesPerDay: dbSettings?.max_study_minutes_per_day ?? 90,
    breakLengthMinutes: dbSettings?.break_length_minutes ?? 10,
    outdoorPreference: dbSettings?.outdoor_preference || "balanced",
  };

  const handleGenerate = async () => {
    const incompleteTasks = tasks.filter((t) => !t.completed);
    if (incompleteTasks.length === 0) {
      toast.error("Geen openstaande taken om in te plannen!");
      return;
    }
    setGenerating(true);
    try {
      const weather = dbSettings?.weather_planning_enabled
        ? await loadWeatherForecast(true)
        : undefined;
      const today = new Date().toISOString().slice(0, 10);
      const preservedBlocks = planBlocks.filter((block) => isPreservedPlanBlock(block, today));
      const result = generateSmartPlan(
        tasks,
        grades,
        activities,
        preservedBlocks,
        plannerSettings,
        weather
      );
      await applyTaskScores.mutateAsync(result.taskUpdates);
      await savePlan.mutateAsync(result.blocks);
      if (result.unscheduledTaskIds.length > 0) {
        toast.warning(`${result.unscheduledTaskIds.length} taak/taken pasten niet vóór de deadline.`);
      }
      toast.success(`Slim plan gegenereerd met ${result.blocks.filter((block) => !block.is_break).length} studieblokken.`);
    } finally {
      setGenerating(false);
    }
  };

  const markSickDay = async () => {
    if (!user) return;
    setSickOpen(false);
    try {
      // 1. Remove generated (non-locked, non-manual, non-completed) blocks on that date
      await supabase
        .from("plan_blocks")
        .delete()
        .eq("user_id", user.id)
        .eq("date", sickDate)
        .eq("is_locked", false as never)
        .eq("is_manual", false as never)
        .eq("completed", false);

      // 2. Insert a full-day blocker block so planner skips this date
      await supabase.from("plan_blocks").insert({
        user_id: user.id,
        task_id: null,
        task_title: "🤒 Vrije dag",
        subject: "",
        date: sickDate,
        start_time: "00:00",
        end_time: "23:59",
        duration_minutes: 24 * 60 - 1,
        completed: false,
        is_break: false,
        is_locked: true,
        is_manual: true,
        smart_explanation: "Vrije/ziekendag — planner slaat deze dag over.",
        weather_impact: null,
      } as never);

      await qc.invalidateQueries({ queryKey: ["plan_blocks"] });
      toast.success(`${format(parseISO(sickDate), "EEEE d MMMM", { locale: nl })} gemarkeerd als vrije dag. Klik op "Generate Smart Plan" om taken te herverdelen.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kon vrije dag niet markeren");
    }
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

  const toggleLock = (id: string) => {
    const block = planBlocks.find((item) => item.id === id);
    if (block) updateBlock.mutate({ id, is_locked: !block.is_locked });
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

  const handleDragStart = (event: DragStartEvent) => {
    const block = planBlocks.find((b) => b.id === event.active.id);
    setActiveBlock(block || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveBlock(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedBlock = planBlocks.find((b) => b.id === active.id);
    const overBlock = planBlocks.find((b) => b.id === over.id);
    if (!draggedBlock || !overBlock) return;

    // Move the dragged block to the position/date of the target block
    moveBlock(draggedBlock.id, overBlock.date, overBlock.start_time.slice(0, 5));
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold">Planner</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            disabled={planBlocks.length === 0}
            onClick={() => {
              downloadIcs(planBlocks);
              toast.success("Kalender geëxporteerd. Open het bestand om te importeren in Google/Apple Agenda.");
            }}
          >
            <Download size={16} />
            Exporteer
          </Button>
          <Dialog open={sickOpen} onOpenChange={setSickOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <HeartPulse size={16} />
                Vrije dag
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xs">
              <DialogHeader>
                <DialogTitle>Ziek of vrije dag</DialogTitle>
                <DialogDescription>
                  Markeer een dag als vrij. Bestaande studieblokken op die dag worden verwijderd en de planner slaat de dag voortaan over.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div>
                  <Label>Welke dag?</Label>
                  <Input type="date" value={sickDate} onChange={(e) => setSickDate(e.target.value)} />
                </div>
                <Button onClick={markSickDay} className="gap-2">
                  <HeartPulse size={16} /> Markeer als vrije dag
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={handleGenerate} className="gap-2" disabled={generating}>
            <Wand2 size={16} />
            {generating ? "Slim plan maken..." : "Generate Smart Plan"}
          </Button>
        </div>
      </div>

      {dates.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col gap-6">
            {dates.map((date) => (
              <div key={date}>
                <h2 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold text-muted-foreground">
                  <CalendarDays size={14} />
                  {format(parseISO(date), "EEEE d MMMM", { locale: nl })}
                </h2>
                <SortableContext
                  items={blocksByDate[date].map((b) => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-2">
                    {blocksByDate[date].map((block) => (
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
                </SortableContext>
              </div>
            ))}
          </div>

          <DragOverlay>
            {activeBlock ? (
              <div className="rounded-xl border bg-card p-3 shadow-lg opacity-80">
                <span className="text-sm font-medium">{activeBlock.task_title}</span>
                <span className="ml-2 text-xs text-muted-foreground">{activeBlock.subject} · {activeBlock.duration_minutes} min</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
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
