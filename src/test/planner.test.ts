import { describe, expect, it } from "vitest";
import type { DbPlanBlock, DbTask } from "@/hooks/useSupabaseData";
import { generateSmartPlan, isPreservedPlanBlock, type SmartPlannerSettings } from "@/lib/planner";

function task(overrides: Partial<DbTask> = {}): DbTask {
  return {
    id: "task-1",
    user_id: "user-1",
    title: "Toets leren",
    subject: "Wiskunde",
    due_date: "2026-06-24",
    estimated_minutes: 80,
    priority: "medium",
    priority_mode: "automatic",
    priority_score: 50,
    priority_explanation: "",
    task_type: "test",
    is_missing: false,
    smart_planning_enabled: true,
    completed: false,
    is_daily_practice: false,
    practice_frequency: 0,
    created_at: "2026-06-20T10:00:00Z",
    ...overrides,
  };
}

function lockedBlock(): DbPlanBlock {
  return {
    id: "block-1",
    user_id: "user-1",
    task_id: null,
    task_title: "Afspraak",
    subject: "",
    date: "2026-06-22",
    start_time: "16:00:00",
    end_time: "17:00:00",
    duration_minutes: 60,
    completed: false,
    is_break: false,
    is_locked: true,
    is_manual: true,
    smart_explanation: "",
    weather_impact: null,
  };
}

const settings: SmartPlannerSettings = {
  schoolEndTimes: {
    monday: "15:30",
    tuesday: "15:30",
    wednesday: "15:30",
    thursday: "15:30",
    friday: "15:30",
  },
  bedtime: "21:30",
  commuteMinutes: 15,
  smartPriorityEnabled: true,
  gradeBasedPlanningEnabled: true,
  weekdayStudyStart: "16:00",
  weekdayStudyEnd: "21:00",
  weekendStudyStart: "10:00",
  weekendStudyEnd: "18:00",
  wakeTime: "08:00",
  maxStudyMinutesPerDay: 60,
  breakLengthMinutes: 10,
  outdoorPreference: "balanced",
};

describe("smart schedule generation", () => {
  it("preserves past, completed, locked, and manual blocks only", () => {
    const base = lockedBlock();
    expect(isPreservedPlanBlock(base, "2026-06-22")).toBe(true);
    expect(isPreservedPlanBlock({ ...base, is_locked: false, is_manual: false, completed: true }, "2026-06-22")).toBe(true);
    expect(isPreservedPlanBlock({ ...base, date: "2026-06-21", is_locked: false, is_manual: false }, "2026-06-22")).toBe(true);
    expect(isPreservedPlanBlock({ ...base, is_locked: false, is_manual: false }, "2026-06-22")).toBe(false);
  });

  it("splits long work, avoids locked time, and respects daily limits", () => {
    const result = generateSmartPlan(
      [task()],
      [],
      [],
      [lockedBlock()],
      settings,
      undefined,
      new Date("2026-06-22T15:00:00")
    );
    const studyBlocks = result.blocks.filter((block) => !block.is_break);
    expect(studyBlocks.length).toBeGreaterThan(1);
    expect(studyBlocks.every((block) => Number(block.start_time.slice(0, 2)) >= 16)).toBe(true);
    expect(studyBlocks.some((block) => block.date === "2026-06-22" && block.start_time < "17:00")).toBe(false);

    const totals = new Map<string, number>();
    studyBlocks.forEach((block) => totals.set(block.date, (totals.get(block.date) || 0) + block.duration_minutes));
    expect([...totals.values()].every((minutes) => minutes <= 60)).toBe(true);
  });

  it("does not schedule excluded tasks", () => {
    const result = generateSmartPlan(
      [task({ smart_planning_enabled: false })],
      [],
      [],
      [],
      settings,
      undefined,
      new Date("2026-06-22T15:00:00")
    );
    expect(result.blocks).toHaveLength(0);
  });

  it("reports tasks that cannot fit in any configured study window", () => {
    const closedSettings = {
      ...settings,
      weekdayStudyEnd: settings.weekdayStudyStart,
      weekendStudyEnd: settings.weekendStudyStart,
    };
    const result = generateSmartPlan(
      [task()],
      [],
      [],
      [],
      closedSettings,
      undefined,
      new Date("2026-06-22T15:00:00")
    );
    expect(result.blocks).toHaveLength(0);
    expect(result.unscheduledTaskIds).toContain("task-1");
  });

  it("uses weekend study windows", () => {
    const result = generateSmartPlan(
      [task({ due_date: "2026-06-29", estimated_minutes: 30 })],
      [],
      [],
      [],
      settings,
      undefined,
      new Date("2026-06-27T08:00:00")
    );
    const first = result.blocks.find((block) => !block.is_break);
    expect(first?.date).toBe("2026-06-27");
    expect(first?.start_time).toBe("10:00");
  });
});
