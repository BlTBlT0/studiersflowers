import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import type { DbGrade, DbTask } from "@/hooks/useSupabaseData";

export type TaskType = "homework" | "test" | "project" | "revision";
export type PriorityMode = "automatic" | "low" | "medium" | "high";

export interface PriorityContext {
  now?: Date;
  gradeBasedPlanning: boolean;
  smartPriorityEnabled: boolean;
  availableMinutesBeforeDeadline: number;
  workloadMinutesBeforeDeadline: number;
}

export interface PriorityResult {
  score: number;
  level: "low" | "medium" | "high";
  explanation: string;
  factors: {
    deadline: number;
    grade: number;
    taskType: number;
    size: number;
    missing: number;
    capacity: number;
  };
}

const MANUAL_SCORES: Record<Exclude<PriorityMode, "automatic">, number> = {
  low: 25,
  medium: 55,
  high: 85,
};

const TYPE_POINTS: Record<TaskType, number> = {
  homework: 5,
  revision: 8,
  project: 13,
  test: 15,
};

export function scoreToLevel(score: number): "low" | "medium" | "high" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function getSubjectGradeAverages(grades: DbGrade[]): Record<string, number> {
  const regular = new Map<string, number[]>();
  const latestFinal = new Map<string, DbGrade>();

  for (const grade of grades) {
    if (grade.is_final_grade) {
      const current = latestFinal.get(grade.subject);
      if (!current || grade.date > current.date) latestFinal.set(grade.subject, grade);
      continue;
    }
    const values = regular.get(grade.subject) ?? [];
    values.push(Number(grade.grade));
    regular.set(grade.subject, values);
  }

  const result: Record<string, number> = {};
  const subjects = new Set([...regular.keys(), ...latestFinal.keys()]);
  for (const subject of subjects) {
    const values = regular.get(subject);
    result[subject] = values?.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : Number(latestFinal.get(subject)!.grade);
  }
  return result;
}

function deadlinePoints(daysLeft: number): number {
  if (daysLeft <= 0) return 35;
  if (daysLeft === 1) return 32;
  if (daysLeft === 2) return 28;
  if (daysLeft === 3) return 24;
  if (daysLeft <= 7) return 16;
  if (daysLeft <= 14) return 8;
  return 2;
}

function gradePoints(grade?: number): number {
  if (grade == null) return 10;
  if (grade < 5.5) return 25;
  if (grade < 6) return 21;
  if (grade < 6.5) return 17;
  if (grade < 7) return 12;
  if (grade < 7.5) return 7;
  if (grade < 8) return 3;
  return 0;
}

function sizePoints(minutes: number): number {
  if (minutes <= 15) return 1;
  if (minutes <= 30) return 3;
  if (minutes <= 60) return 6;
  if (minutes <= 90) return 8;
  return 10;
}

function capacityPoints(workload: number, available: number): number {
  if (workload <= 0) return 0;
  if (available <= 0) return 10;
  const ratio = workload / available;
  if (ratio >= 1) return 10;
  if (ratio >= 0.75) return 7;
  if (ratio >= 0.5) return 4;
  if (ratio >= 0.25) return 2;
  return 0;
}

export function calculatePriority(
  task: DbTask,
  subjectGrade: number | undefined,
  context: PriorityContext
): PriorityResult {
  const mode = (task.priority_mode || "automatic") as PriorityMode;
  if (!context.smartPriorityEnabled || mode !== "automatic") {
    const fallbackMode = mode === "automatic"
      ? ((task.priority || "medium") as Exclude<PriorityMode, "automatic">)
      : mode;
    const score = MANUAL_SCORES[fallbackMode] ?? 55;
    return {
      score,
      level: scoreToLevel(score),
      explanation: `Handmatige prioriteit: ${fallbackMode === "high" ? "hoog" : fallbackMode === "low" ? "laag" : "gemiddeld"}.`,
      factors: { deadline: 0, grade: 0, taskType: 0, size: 0, missing: 0, capacity: 0 },
    };
  }

  const today = startOfDay(context.now ?? new Date());
  const daysLeft = differenceInCalendarDays(parseISO(task.due_date), today);
  const overdue = daysLeft < 0 && !task.completed;
  const factors = {
    deadline: deadlinePoints(daysLeft),
    grade: context.gradeBasedPlanning ? gradePoints(subjectGrade) : 0,
    taskType: TYPE_POINTS[(task.task_type || "homework") as TaskType] ?? TYPE_POINTS.homework,
    size: sizePoints(task.estimated_minutes),
    missing: task.is_missing || overdue ? 15 : 0,
    capacity: capacityPoints(
      context.workloadMinutesBeforeDeadline,
      context.availableMinutesBeforeDeadline
    ),
  };

  const score = Math.max(1, Math.min(100, Object.values(factors).reduce((sum, value) => sum + value, 0)));
  const reasons: string[] = [];
  if (overdue || task.is_missing) reasons.push("het huiswerk ontbreekt of te laat is");
  if (daysLeft <= 1) reasons.push("de deadline heel dichtbij is");
  else if (daysLeft <= 3) reasons.push("de deadline snel nadert");
  if (context.gradeBasedPlanning && subjectGrade != null && subjectGrade < 6.5) {
    reasons.push(`je gemiddelde voor ${task.subject} ${subjectGrade.toFixed(1)} is`);
  } else if (context.gradeBasedPlanning && subjectGrade == null) {
    reasons.push("er nog geen cijfergemiddelde beschikbaar is");
  }
  if (task.task_type === "test") reasons.push("het om een toets gaat");
  if (task.task_type === "project") reasons.push("het om een groot project gaat");
  if (task.estimated_minutes > 60) reasons.push("de taak veel tijd vraagt");
  if (factors.capacity >= 7) reasons.push("er weinig vrije tijd voor de deadline is");

  return {
    score,
    level: scoreToLevel(score),
    explanation: reasons.length
      ? `${task.subject} krijgt score ${score}, omdat ${reasons.join(", ")}.`
      : `${task.subject} krijgt score ${score} op basis van deadline, taaktype en beschikbare tijd.`,
    factors,
  };
}
