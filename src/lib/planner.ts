import { DbTask, DbActivity, DbPlanBlock, DbTimeTracking, getSubjectAverages } from "@/hooks/useSupabaseData";
import { format, addDays, startOfDay } from "date-fns";
import type { TablesInsert } from "@/integrations/supabase/types";

function timeToMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
const WEEKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];

function getWeekday(date: Date): Weekday | null {
  const day = date.getDay();
  if (day === 0 || day === 6) return null;
  return WEEKDAYS[day - 1];
}

interface TimeSlot {
  start: number;
  end: number;
}

function getAvailableSlots(
  date: Date,
  schoolEndTimes: Record<string, string>,
  bedtime: string,
  commuteMinutes: number,
  activities: DbActivity[]
): TimeSlot[] {
  const weekday = getWeekday(date);
  if (!weekday) return [];

  const schoolEnd = timeToMinutes(schoolEndTimes[weekday] || "15:30") + (commuteMinutes || 0);
  const bed = timeToMinutes(bedtime || "21:30");

  if (schoolEnd >= bed) return [];

  const dayActivities = activities
    .filter((a) => a.weekday === weekday)
    .map((a) => ({ start: timeToMinutes(a.start_time), end: timeToMinutes(a.end_time) }))
    .sort((a, b) => a.start - b.start);

  const slots: TimeSlot[] = [];
  let cursor = schoolEnd;

  for (const act of dayActivities) {
    if (act.start > cursor) {
      slots.push({ start: cursor, end: Math.min(act.start, bed) });
    }
    cursor = Math.max(cursor, act.end);
  }

  if (cursor < bed) {
    slots.push({ start: cursor, end: bed });
  }

  return slots;
}

interface TaskChunk {
  taskId: string;
  taskTitle: string;
  subject: string;
  minutes: number;
}

function splitIntoChunks(task: DbTask, adjustedMinutes: number): TaskChunk[] {
  const chunks: TaskChunk[] = [];
  let remaining = adjustedMinutes;

  if (remaining <= 45) {
    chunks.push({ taskId: task.id, taskTitle: task.title, subject: task.subject, minutes: remaining });
  } else {
    while (remaining > 0) {
      const chunk = remaining > 45 ? 35 : remaining;
      chunks.push({ taskId: task.id, taskTitle: task.title, subject: task.subject, minutes: Math.min(chunk, 45) });
      remaining -= chunk;
    }
  }

  return chunks;
}

export function generatePlan(
  tasks: DbTask[],
  activities: DbActivity[],
  schoolEndTimes: Record<string, string>,
  bedtime: string,
  commuteMinutes: number,
  tracking: DbTimeTracking[] = [],
  startDate?: Date
): Omit<TablesInsert<"plan_blocks">, "user_id">[] {
  const now = startDate || new Date();
  const today = startOfDay(now);
  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
  const subjectAverages = getSubjectAverages(tracking);

  const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
  
  // Separate daily practice tasks from regular tasks
  const dailyPracticeTasks = tasks.filter((t) => !t.completed && t.is_daily_practice);
  const regularTasks = tasks.filter((t) => !t.completed && !t.is_daily_practice);
  
  const incompleteTasks = regularTasks
    .sort((a, b) => {
      const dateCompare = a.due_date.localeCompare(b.due_date);
      if (dateCompare !== 0) return dateCompare;
      return (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2);
    });
...
  // Calculate total study needed for regular tasks
  const allChunks: TaskChunk[] = [];
  for (const task of incompleteTasks) {
    const adjusted = subjectAverages[task.subject]
      ? Math.round((subjectAverages[task.subject] / task.estimated_minutes) * task.estimated_minutes)
      : task.estimated_minutes;
    allChunks.push(...splitIntoChunks(task, Math.max(adjusted, task.estimated_minutes)));
  }

  const totalStudyMinutes = allChunks.reduce((s, c) => s + c.minutes, 0);
  const totalAvailable = daySlots.reduce((s, d) => s + d.totalMinutes, 0);

  // Target: spread evenly, but respect deadlines
  // Max study per day = total / available days, but at least enough for due-today tasks
  const daysWithTime = daySlots.length;
  const targetPerDay = daysWithTime > 0 ? Math.ceil(totalStudyMinutes / daysWithTime) : 90;
  // Hard cap: max 90 min study per day to keep it manageable
  const MAX_STUDY_PER_DAY = 90;
  const maxPerDay = Math.min(Math.max(targetPerDay, 30), MAX_STUDY_PER_DAY);

  const blocks: Omit<TablesInsert<"plan_blocks">, "user_id">[] = [];
  const remainingChunks = [...allChunks];

  // Schedule chunks respecting deadlines: for each day, pick chunks whose deadline >= this day
  for (const dayInfo of daySlots) {
    if (remainingChunks.length === 0) break;

    let studyMinutesThisDay = 0;
    let studyMinutesSinceBreak = 0;

    // Find chunks that MUST be done by today or soon (deadline pressure)
    // and chunks that CAN be done today
    const eligibleIndices: number[] = [];
    for (let i = 0; i < remainingChunks.length; i++) {
      eligibleIndices.push(i);
    }

    // Sort eligible chunks: urgent first (closest deadline), then by priority
    eligibleIndices.sort((a, b) => {
      const chunkA = remainingChunks[a];
      const chunkB = remainingChunks[b];
      const taskA = incompleteTasks.find(t => t.id === chunkA.taskId);
      const taskB = incompleteTasks.find(t => t.id === chunkB.taskId);
      const deadlineA = taskA?.due_date || "9999-12-31";
      const deadlineB = taskB?.due_date || "9999-12-31";
      const dateCompare = deadlineA.localeCompare(deadlineB);
      if (dateCompare !== 0) return dateCompare;
      return (priorityOrder[taskB?.priority || "medium"] || 2) - (priorityOrder[taskA?.priority || "medium"] || 2);
    });

    // Only schedule chunks that have deadline >= today (don't skip past-deadline tasks, still schedule them ASAP)
    // Prioritize chunks whose deadline is soon
    const scheduledIndices: number[] = [];

    for (const idx of eligibleIndices) {
      if (studyMinutesThisDay >= maxPerDay) break;

      const chunk = remainingChunks[idx];
      const task = incompleteTasks.find(t => t.id === chunk.taskId);
      const deadline = task?.due_date || "9999-12-31";

      // If deadline is before this day AND there are future days, skip to spread load
      // BUT if deadline is today or past, we must schedule it now
      if (deadline > dayInfo.dateStr && studyMinutesThisDay >= Math.floor(maxPerDay * 0.6)) {
        // We've done enough for today, save non-urgent for later
        continue;
      }

      // Find a slot to place this chunk
      let placed = false;
      for (const slot of dayInfo.slots) {
        if (placed) break;
        // Calculate cursor based on already-placed blocks for this day
        let cursor = slot.start;
        for (const b of blocks) {
          if (b.date === dayInfo.dateStr) {
            const bEnd = timeToMinutes(b.end_time);
            if (bEnd > cursor && timeToMinutes(b.start_time) < slot.end) {
              cursor = Math.max(cursor, bEnd);
            }
          }
        }

        if (cursor >= slot.end) continue;

        // Insert break if needed
        if (studyMinutesSinceBreak >= 40) {
          const breakEnd = Math.min(cursor + 10, slot.end);
          if (breakEnd > cursor) {
            blocks.push({
              task_id: null,
              task_title: "Pauze 🧃",
              subject: "",
              date: dayInfo.dateStr,
              start_time: minutesToTime(cursor),
              end_time: minutesToTime(breakEnd),
              duration_minutes: breakEnd - cursor,
              completed: false,
              is_break: true,
            });
            cursor = breakEnd;
            studyMinutesSinceBreak = 0;
          }
        }

        const available = Math.min(slot.end - cursor, maxPerDay - studyMinutesThisDay);
        if (available < 10) continue;

        const duration = Math.min(chunk.minutes, available);
        blocks.push({
          task_id: chunk.taskId,
          task_title: chunk.taskTitle,
          subject: chunk.subject,
          date: dayInfo.dateStr,
          start_time: minutesToTime(cursor),
          end_time: minutesToTime(cursor + duration),
          duration_minutes: duration,
          completed: false,
          is_break: false,
        });

        studyMinutesThisDay += duration;
        studyMinutesSinceBreak += duration;

        if (duration >= chunk.minutes) {
          scheduledIndices.push(idx);
        } else {
          remainingChunks[idx] = { ...chunk, minutes: chunk.minutes - duration };
        }
        placed = true;
      }
    }

    // Remove scheduled chunks (in reverse order to preserve indices)
    for (const idx of scheduledIndices.sort((a, b) => b - a)) {
      remainingChunks.splice(idx, 1);
    }
  }

  return blocks;
}

export function getTodayBlocks(blocks: DbPlanBlock[]): DbPlanBlock[] {
  const today = format(new Date(), "yyyy-MM-dd");
  return blocks.filter((b) => b.date === today);
}

export function getAvailableMinutesForDate(
  date: Date,
  schoolEndTimes: Record<string, string>,
  bedtime: string,
  commuteMinutes: number,
  activities: DbActivity[]
): number {
  const slots = getAvailableSlots(date, schoolEndTimes, bedtime, commuteMinutes, activities);
  return slots.reduce((sum, s) => sum + (s.end - s.start), 0);
}
