import { describe, expect, it } from "vitest";
import type { DbGrade, DbTask } from "@/hooks/useSupabaseData";
import { calculatePriority, getSubjectGradeAverages } from "@/lib/smartPriority";

function task(overrides: Partial<DbTask> = {}): DbTask {
  return {
    id: "task-1",
    user_id: "user-1",
    title: "Oefenen",
    subject: "Wiskunde",
    due_date: "2026-06-22",
    estimated_minutes: 30,
    priority: "medium",
    priority_mode: "automatic",
    priority_score: 50,
    priority_explanation: "",
    task_type: "homework",
    is_missing: false,
    smart_planning_enabled: true,
    completed: false,
    is_daily_practice: false,
    practice_frequency: 0,
    created_at: "2026-06-20T10:00:00Z",
    ...overrides,
  };
}

function grade(overrides: Partial<DbGrade> = {}): DbGrade {
  return {
    id: "grade-1",
    user_id: "user-1",
    subject: "Wiskunde",
    grade: 6,
    date: "2026-06-01",
    description: null,
    is_final_grade: false,
    created_at: "2026-06-01T10:00:00Z",
    ...overrides,
  };
}

const baseContext = {
  now: new Date("2026-06-21T10:00:00"),
  smartPriorityEnabled: true,
  gradeBasedPlanning: true,
  availableMinutesBeforeDeadline: 120,
  workloadMinutesBeforeDeadline: 120,
};

describe("smart priority scoring", () => {
  it("gives a near-maximum score to a large test tomorrow in a weak subject", () => {
    const result = calculatePriority(
      task({ task_type: "test", estimated_minutes: 120 }),
      5.2,
      baseContext
    );
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.level).toBe("high");
    expect(result.explanation).toContain("5.2");
  });

  it("keeps small distant homework for a strong subject low", () => {
    const result = calculatePriority(
      task({ due_date: "2026-06-28", estimated_minutes: 15 }),
      8.1,
      { ...baseContext, availableMinutesBeforeDeadline: 600, workloadMinutesBeforeDeadline: 15 }
    );
    expect(result.score).toBeLessThan(40);
    expect(result.level).toBe("low");
  });

  it("boosts overdue and explicitly missing work", () => {
    const result = calculatePriority(
      task({ due_date: "2026-06-20", is_missing: true }),
      7,
      baseContext
    );
    expect(result.factors.missing).toBe(15);
    expect(result.factors.deadline).toBe(35);
  });

  it("uses persistent manual overrides", () => {
    const result = calculatePriority(
      task({ priority_mode: "high" }),
      9,
      baseContext
    );
    expect(result.score).toBe(85);
    expect(result.explanation).toContain("Handmatige");
  });

  it("uses regular-grade averages and falls back to the latest final grade", () => {
    const averages = getSubjectGradeAverages([
      grade({ grade: 5, date: "2026-05-01" }),
      grade({ id: "grade-2", grade: 7, date: "2026-06-01" }),
      grade({ id: "grade-3", subject: "Engels", grade: 8, is_final_grade: true, date: "2026-05-01" }),
      grade({ id: "grade-4", subject: "Engels", grade: 8.5, is_final_grade: true, date: "2026-06-01" }),
    ]);
    expect(averages.Wiskunde).toBe(6);
    expect(averages.Engels).toBe(8.5);
  });
});
