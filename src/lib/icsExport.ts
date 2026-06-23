import type { DbPlanBlock } from "@/hooks/useSupabaseData";

const pad = (n: number) => n.toString().padStart(2, "0");

function toIcsDateTime(date: string, time: string): string {
  // date: YYYY-MM-DD, time: HH:MM -> YYYYMMDDTHHMMSS (local/floating time)
  const [y, m, d] = date.split("-");
  const [hh, mm] = time.split(":");
  return `${y}${m}${d}T${pad(Number(hh))}${pad(Number(mm))}00`;
}

function nowStamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcs(blocks: DbPlanBlock[], calendarName = "StudyFlow"): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StudyFlow//Planner//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
  ];

  for (const b of blocks) {
    if (!b.date || !b.start_time || !b.end_time) continue;
    const summary = b.is_break ? "Pauze" : `${b.subject ? b.subject + ": " : ""}${b.task_title || "Studieblok"}`;
    const desc = b.smart_explanation || "";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@studyflow`,
      `DTSTAMP:${nowStamp()}`,
      `DTSTART:${toIcsDateTime(b.date, b.start_time)}`,
      `DTEND:${toIcsDateTime(b.date, b.end_time)}`,
      `SUMMARY:${escapeIcs(summary)}`,
    );
    if (desc) lines.push(`DESCRIPTION:${escapeIcs(desc)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(blocks: DbPlanBlock[], filename = "studyflow-planning.ics") {
  const ics = buildIcs(blocks);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}