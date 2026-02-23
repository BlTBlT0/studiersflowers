import { Task, Activity, ScheduleSettings, PlanBlock, Weekday, WEEKDAYS } from "@/types";
import { format, addDays, parseISO, isAfter, isBefore, startOfDay } from "date-fns";

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function getWeekday(date: Date): Weekday | null {
  const day = date.getDay(); // 0=Sun, 1=Mon...
  if (day === 0 || day === 6) return null;
  return WEEKDAYS[day - 1];
}

interface TimeSlot {
  start: number; // minutes since midnight
  end: number;
}

function getAvailableSlots(
  date: Date,
  schedule: ScheduleSettings,
  activities: Activity[]
): TimeSlot[] {
  const weekday = getWeekday(date);
  if (!weekday) return []; // weekend

  const schoolEnd = timeToMinutes(schedule.schoolEndTimes[weekday]);
  const bedtime = timeToMinutes(schedule.bedtime);

  if (schoolEnd >= bedtime) return [];

  // Get activities for this weekday, sorted by start
  const dayActivities = activities
    .filter((a) => a.weekday === weekday)
    .map((a) => ({ start: timeToMinutes(a.startTime), end: timeToMinutes(a.endTime) }))
    .sort((a, b) => a.start - b.start);

  const slots: TimeSlot[] = [];
  let cursor = schoolEnd;

  for (const act of dayActivities) {
    if (act.start > cursor) {
      slots.push({ start: cursor, end: Math.min(act.start, bedtime) });
    }
    cursor = Math.max(cursor, act.end);
  }

  if (cursor < bedtime) {
    slots.push({ start: cursor, end: bedtime });
  }

  return slots;
}

interface TaskChunk {
  taskId: string;
  taskTitle: string;
  subject: string;
  minutes: number;
}

function splitIntoChunks(task: Task): TaskChunk[] {
  const chunks: TaskChunk[] = [];
  let remaining = task.estimatedMinutes;

  if (remaining <= 45) {
    chunks.push({ taskId: task.id, taskTitle: task.title, subject: task.subject, minutes: remaining });
  } else {
    while (remaining > 0) {
      const chunk = remaining > 45 ? 35 : remaining; // 35 min chunks, last chunk gets remainder
      chunks.push({ taskId: task.id, taskTitle: task.title, subject: task.subject, minutes: Math.min(chunk, 45) });
      remaining -= chunk;
    }
  }

  return chunks;
}

export function generatePlan(
  tasks: Task[],
  activities: Activity[],
  schedule: ScheduleSettings,
  startDate?: Date
): PlanBlock[] {
  const start = startDate || new Date();
  const today = startOfDay(start);

  // Get incomplete tasks sorted by due date asc, priority desc
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  const incompleteTasks = tasks
    .filter((t) => !t.completed)
    .sort((a, b) => {
      const dateCompare = a.dueDate.localeCompare(b.dueDate);
      if (dateCompare !== 0) return dateCompare;
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

  // Create all chunks
  const allChunks: TaskChunk[] = [];
  for (const task of incompleteTasks) {
    allChunks.push(...splitIntoChunks(task));
  }

  const blocks: PlanBlock[] = [];
  let chunkIndex = 0;
  let dayOffset = 0;
  const MAX_DAYS = 14; // plan up to 2 weeks ahead

  while (chunkIndex < allChunks.length && dayOffset < MAX_DAYS) {
    const currentDate = addDays(today, dayOffset);
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const slots = getAvailableSlots(currentDate, schedule, activities);

    let studyMinutesSinceBreak = 0;

    for (const slot of slots) {
      let cursor = slot.start;

      while (cursor < slot.end && chunkIndex < allChunks.length) {
        // Insert break if needed
        if (studyMinutesSinceBreak >= 40) {
          const breakEnd = Math.min(cursor + 10, slot.end);
          if (breakEnd > cursor) {
            blocks.push({
              id: `break-${dateStr}-${cursor}`,
              taskId: "break",
              taskTitle: "Break 🧃",
              subject: "",
              date: dateStr,
              startTime: minutesToTime(cursor),
              endTime: minutesToTime(breakEnd),
              durationMinutes: breakEnd - cursor,
              completed: false,
              isBreak: true,
            });
            cursor = breakEnd;
            studyMinutesSinceBreak = 0;
          }
        }

        const chunk = allChunks[chunkIndex];
        const available = slot.end - cursor;
        if (available < 10) break; // not enough time for meaningful work

        const duration = Math.min(chunk.minutes, available);
        blocks.push({
          id: `${chunk.taskId}-${dateStr}-${cursor}`,
          taskId: chunk.taskId,
          taskTitle: chunk.taskTitle,
          subject: chunk.subject,
          date: dateStr,
          startTime: minutesToTime(cursor),
          endTime: minutesToTime(cursor + duration),
          durationMinutes: duration,
          completed: false,
        });

        cursor += duration;
        studyMinutesSinceBreak += duration;

        if (duration >= chunk.minutes) {
          chunkIndex++;
        } else {
          allChunks[chunkIndex] = { ...chunk, minutes: chunk.minutes - duration };
        }
      }
    }

    dayOffset++;
  }

  return blocks;
}

export function getTodayBlocks(blocks: PlanBlock[]): PlanBlock[] {
  const today = format(new Date(), "yyyy-MM-dd");
  return blocks.filter((b) => b.date === today);
}

export function getAvailableMinutes(
  date: Date,
  schedule: ScheduleSettings,
  activities: Activity[]
): number {
  const slots = getAvailableSlots(date, schedule, activities);
  return slots.reduce((sum, s) => sum + (s.end - s.start), 0);
}
