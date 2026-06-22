import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import type {
  DbActivity,
  DbGrade,
  DbPlanBlock,
  DbTask,
  DbTimeTracking,
} from "@/hooks/useSupabaseData";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { calculatePriority, getSubjectGradeAverages } from "@/lib/smartPriority";
import { getWeatherImpact, type WeatherForecast } from "@/lib/weather";

export interface SmartPlannerSettings {
  schoolEndTimes: Record<string, string>;
  bedtime: string;
  commuteMinutes: number;
  smartPriorityEnabled: boolean;
  gradeBasedPlanningEnabled: boolean;
  weekdayStudyStart: string;
  weekdayStudyEnd: string;
  weekendStudyStart: string;
  weekendStudyEnd: string;
  wakeTime: string;
  maxStudyMinutesPerDay: number;
  breakLengthMinutes: number;
  outdoorPreference: string;
}

interface TimeSlot {
  start: number;
  end: number;
}

interface DayPlan {
  date: Date;
  dateStr: string;
  slots: TimeSlot[];
  totalMinutes: number;
  usedMinutes: number;
}

interface TaskChunk {
  task: DbTask;
  minutes: number;
  score: number;
  explanation: string;
  targetDate?: string;
}

export interface SmartPlanResult {
  blocks: Omit<TablesInsert<"plan_blocks">, "user_id">[];
  taskUpdates: Array<TablesUpdate<"tasks"> & { id: string }>;
  unscheduledTaskIds: string[];
}

export function isPreservedPlanBlock(block: DbPlanBlock, today: string): boolean {
  return block.date < today || block.completed || block.is_locked || block.is_manual;
}

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const normalized = Math.max(0, Math.min(minutes, 24 * 60 - 1));
  const hours = Math.floor(normalized / 60);
  const rest = normalized % 60;
  return `${hours.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`;
}

function subtractInterval(slots: TimeSlot[], blocked: TimeSlot): TimeSlot[] {
  return slots.flatMap((slot) => {
    if (blocked.end <= slot.start || blocked.start >= slot.end) return [slot];
    const pieces: TimeSlot[] = [];
    if (blocked.start > slot.start) pieces.push({ start: slot.start, end: blocked.start });
    if (blocked.end < slot.end) pieces.push({ start: blocked.end, end: slot.end });
    return pieces;
  });
}

function getDaySlots(
  date: Date,
  settings: SmartPlannerSettings,
  activities: DbActivity[],
  preservedBlocks: DbPlanBlock[],
  now: Date
): TimeSlot[] {
  const dayName = DAY_NAMES[date.getDay()];
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const dateStr = format(date, "yyyy-MM-dd");
  const preferredStart = timeToMinutes(
    weekend ? settings.weekendStudyStart : settings.weekdayStudyStart
  );
  const preferredEnd = timeToMinutes(
    weekend ? settings.weekendStudyEnd : settings.weekdayStudyEnd
  );
  const sleepEnd = timeToMinutes(settings.bedtime);
  let start = preferredStart;
  const end = Math.min(preferredEnd, sleepEnd);

  if (!weekend) {
    const schoolEnd = timeToMinutes(settings.schoolEndTimes[dayName] || "15:30");
    start = Math.max(start, schoolEnd + settings.commuteMinutes);
  } else {
    start = Math.max(start, timeToMinutes(settings.wakeTime));
  }

  if (dateStr === format(now, "yyyy-MM-dd")) {
    start = Math.max(start, now.getHours() * 60 + now.getMinutes());
  }
  if (start >= end) return [];

  let slots: TimeSlot[] = [{ start, end }];
  for (const activity of activities.filter((item) => item.weekday === dayName)) {
    slots = subtractInterval(slots, {
      start: timeToMinutes(activity.start_time),
      end: timeToMinutes(activity.end_time),
    });
  }
  for (const block of preservedBlocks.filter((item) => item.date === dateStr)) {
    slots = subtractInterval(slots, {
      start: timeToMinutes(block.start_time),
      end: timeToMinutes(block.end_time),
    });
  }
  return slots.filter((slot) => slot.end - slot.start >= 10);
}

function splitDuration(minutes: number): number[] {
  if (minutes <= 45) return [Math.max(10, minutes)];
  const count = Math.ceil(minutes / 45);
  const base = Math.floor(minutes / count);
  let remainder = minutes - base * count;
  return Array.from({ length: count }, () => base + (remainder-- > 0 ? 1 : 0));
}

function createChunks(task: DbTask, score: number, explanation: string, dayPlans: DayPlan[]): TaskChunk[] {
  if (!task.is_daily_practice) {
    return splitDuration(task.estimated_minutes).map((minutes) => ({
      task,
      minutes,
      score,
      explanation,
    }));
  }

  const eligibleDays = dayPlans.filter((day) => day.dateStr < task.due_date);
  const requested = task.practice_frequency || eligibleDays.length;
  const count = Math.min(requested, eligibleDays.length);
  if (count === 0) return [];
  const step = eligibleDays.length / count;
  return Array.from({ length: count }, (_, index) => {
    const dayIndex = Math.min(eligibleDays.length - 1, Math.floor(index * step + step / 2));
    return {
      task,
      minutes: Math.max(5, task.estimated_minutes),
      score,
      explanation,
      targetDate: eligibleDays[dayIndex].dateStr,
    };
  });
}

function totalAvailableBefore(dayPlans: DayPlan[], deadline: string): number {
  return dayPlans
    .filter((day) => day.dateStr < deadline)
    .reduce((sum, day) => sum + day.totalMinutes, 0);
}

function workloadBefore(tasks: DbTask[], deadline: string): number {
  return tasks
    .filter((task) => !task.completed && task.smart_planning_enabled && task.due_date <= deadline)
    .reduce((sum, task) => sum + task.estimated_minutes, 0);
}

function consumeSlot(
  day: DayPlan,
  slotIndex: number,
  duration: number,
  breakMinutes: number
): { start: number; hasBreak: boolean } {
  const slot = day.slots[slotIndex];
  const start = slot.start;
  const hasBreak = slot.end - start - duration >= breakMinutes;
  const consumed = duration + (hasBreak ? breakMinutes : 0);
  slot.start += consumed;
  if (slot.end - slot.start < 10) day.slots.splice(slotIndex, 1);
  return { start, hasBreak };
}

export function generateSmartPlan(
  tasks: DbTask[],
  grades: DbGrade[],
  activities: DbActivity[],
  preservedBlocks: DbPlanBlock[],
  settings: SmartPlannerSettings,
  weather?: WeatherForecast,
  startDate = new Date()
): SmartPlanResult {
  const now = startDate;
  const today = startOfDay(now);
  const dayPlans: DayPlan[] = [];
  for (let index = 0; index < 14; index++) {
    const date = addDays(today, index);
    const slots = getDaySlots(date, settings, activities, preservedBlocks, now);
    const totalMinutes = slots.reduce((sum, slot) => sum + slot.end - slot.start, 0);
    dayPlans.push({
      date,
      dateStr: format(date, "yyyy-MM-dd"),
      slots,
      totalMinutes,
      usedMinutes: 0,
    });
  }

  const activeTasks = tasks.filter((task) => !task.completed && task.smart_planning_enabled);
  const subjectGrades = getSubjectGradeAverages(grades);
  const scoredTasks = activeTasks.map((task) => {
    const result = calculatePriority(task, subjectGrades[task.subject], {
      now,
      smartPriorityEnabled: settings.smartPriorityEnabled,
      gradeBasedPlanning: settings.gradeBasedPlanningEnabled,
      availableMinutesBeforeDeadline: totalAvailableBefore(dayPlans, task.due_date),
      workloadMinutesBeforeDeadline: workloadBefore(activeTasks, task.due_date),
    });
    return { task, result };
  });

  const taskUpdates = scoredTasks.map(({ task, result }) => ({
    id: task.id,
    priority_score: result.score,
    priority: result.level,
    priority_explanation: result.explanation,
  }));

  const chunks = scoredTasks
    .flatMap(({ task, result }) => createChunks(task, result.score, result.explanation, dayPlans))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.task.due_date.localeCompare(right.task.due_date);
    });

  const blocks: Omit<TablesInsert<"plan_blocks">, "user_id">[] = [];
  const unscheduled = new Set<string>();

  const pendingChunks = [...chunks];
  while (pendingChunks.length > 0) {
    const chunk = pendingChunks.shift()!;
    const overdue = differenceInCalendarDays(parseISO(chunk.task.due_date), today) <= 0;
    const candidates: Array<{
      dayIndex: number;
      slotIndex: number;
      duration: number;
      value: number;
      impact: ReturnType<typeof getWeatherImpact>;
    }> = [];

    dayPlans.forEach((day, dayIndex) => {
      if (chunk.targetDate && day.dateStr !== chunk.targetDate) return;
      if (!overdue && day.dateStr >= chunk.task.due_date) return;
      const remainingDaily = settings.maxStudyMinutesPerDay - day.usedMinutes;
      if (remainingDaily < 10) return;

      day.slots.forEach((slot, slotIndex) => {
        const duration = Math.min(chunk.minutes, remainingDaily, slot.end - slot.start);
        if (duration < 10) return;
        const impact = getWeatherImpact(
          weather,
          day.dateStr,
          Math.floor(slot.start / 60),
          chunk.score,
          settings.outdoorPreference
        );
        const weatherAdjustment = chunk.score >= 80
          ? Math.min(0, impact.adjustment)
          : impact.adjustment;
        candidates.push({
          dayIndex,
          slotIndex,
          duration,
          impact,
          value: -dayIndex * 8 - slot.start / 180 + weatherAdjustment,
        });
      });
    });

    candidates.sort((a, b) => b.value - a.value);
    const selected = candidates[0];
    if (!selected) {
      unscheduled.add(chunk.task.id);
      continue;
    }

    const day = dayPlans[selected.dayIndex];
    const { start, hasBreak } = consumeSlot(
      day,
      selected.slotIndex,
      selected.duration,
      settings.breakLengthMinutes
    );
    day.usedMinutes += selected.duration;
    const weatherReason = selected.impact.reason;
    const explanation = weatherReason
      ? `${chunk.explanation} ${weatherReason}`
      : chunk.explanation;

    blocks.push({
      task_id: chunk.task.id,
      task_title: chunk.task.is_daily_practice ? `${chunk.task.title} 📖` : chunk.task.title,
      subject: chunk.task.subject,
      date: day.dateStr,
      start_time: minutesToTime(start),
      end_time: minutesToTime(start + selected.duration),
      duration_minutes: selected.duration,
      completed: false,
      is_break: false,
      is_locked: false,
      is_manual: false,
      smart_explanation: explanation,
      weather_impact: selected.impact.reason ? selected.impact : null,
    });

    if (selected.duration < chunk.minutes) {
      pendingChunks.unshift({ ...chunk, minutes: chunk.minutes - selected.duration });
    }

    if (settings.breakLengthMinutes > 0 && hasBreak) {
      blocks.push({
        task_id: null,
        task_title: "Pauze 🧃",
        subject: "",
        date: day.dateStr,
        start_time: minutesToTime(start + selected.duration),
        end_time: minutesToTime(start + selected.duration + settings.breakLengthMinutes),
        duration_minutes: settings.breakLengthMinutes,
        completed: false,
        is_break: true,
        is_locked: false,
        is_manual: false,
        smart_explanation: "Herstelpauze tussen studieblokken.",
        weather_impact: null,
      });
    }
  }

  return {
    blocks: blocks.sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`)),
    taskUpdates,
    unscheduledTaskIds: [...unscheduled],
  };
}

// Backward-compatible wrapper used by older callers.
export function generatePlan(
  tasks: DbTask[],
  activities: DbActivity[],
  schoolEndTimes: Record<string, string>,
  bedtime: string,
  commuteMinutes: number,
  _tracking: DbTimeTracking[] = [],
  startDate?: Date
): Omit<TablesInsert<"plan_blocks">, "user_id">[] {
  return generateSmartPlan(
    tasks,
    [],
    activities,
    [],
    {
      schoolEndTimes,
      bedtime,
      commuteMinutes,
      smartPriorityEnabled: false,
      gradeBasedPlanningEnabled: false,
      weekdayStudyStart: "16:00",
      weekdayStudyEnd: bedtime,
      weekendStudyStart: "10:00",
      weekendStudyEnd: "18:00",
      wakeTime: "07:00",
      maxStudyMinutesPerDay: 90,
      breakLengthMinutes: 10,
      outdoorPreference: "balanced",
    },
    undefined,
    startDate
  ).blocks;
}

export function getTodayBlocks(blocks: DbPlanBlock[]): DbPlanBlock[] {
  const today = format(new Date(), "yyyy-MM-dd");
  return blocks.filter((block) => block.date === today);
}

export function getAvailableMinutesForDate(
  date: Date,
  schoolEndTimes: Record<string, string>,
  bedtime: string,
  commuteMinutes: number,
  activities: DbActivity[]
): number {
  const settings: SmartPlannerSettings = {
    schoolEndTimes,
    bedtime,
    commuteMinutes,
    smartPriorityEnabled: true,
    gradeBasedPlanningEnabled: true,
    weekdayStudyStart: "16:00",
    weekdayStudyEnd: bedtime,
    weekendStudyStart: "10:00",
    weekendStudyEnd: "18:00",
    wakeTime: "07:00",
    maxStudyMinutesPerDay: 90,
    breakLengthMinutes: 10,
    outdoorPreference: "balanced",
  };
  return getDaySlots(date, settings, activities, [], new Date())
    .reduce((sum, slot) => sum + slot.end - slot.start, 0);
}
