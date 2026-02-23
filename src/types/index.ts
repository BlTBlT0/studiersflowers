export type Priority = "low" | "medium" | "high";
export type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";

export const WEEKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: "Ma",
  tuesday: "Di",
  wednesday: "Wo",
  thursday: "Do",
  friday: "Vr",
};

export interface Task {
  id: string;
  title: string;
  subject: string;
  dueDate: string; // ISO date string YYYY-MM-DD
  estimatedMinutes: number;
  priority: Priority;
  completed: boolean;
  createdAt: string;
}

export interface Activity {
  id: string;
  name: string;
  weekday: Weekday;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
}

export interface ScheduleSettings {
  schoolEndTimes: Record<Weekday, string>; // HH:MM per weekday
  bedtime: string; // HH:MM, default "21:30"
  commuteMinutes: number; // minutes to get home from school
}

export interface PlanBlock {
  id: string;
  taskId: string;
  taskTitle: string;
  subject: string;
  date: string;    // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  durationMinutes: number;
  completed: boolean;
  isBreak?: boolean;
}

export const DEFAULT_SCHEDULE: ScheduleSettings = {
  schoolEndTimes: {
    monday: "15:30",
    tuesday: "15:30",
    wednesday: "15:30",
    thursday: "15:30",
    friday: "15:30",
  },
  bedtime: "21:30",
  commuteMinutes: 15,
};

export const SUBJECTS = [
  "Kunst",
  "Biologie",
  "Aardrijkskunde",
  "Wiskunde",
  "Geschiedenis",
  "Lichamelijke Opvoeding",
  "Engels",
  "Nederlands",
  "Grieks",
  "Wetenschap",
  "Muziek",
  "Frans",
  "VVV",
];
