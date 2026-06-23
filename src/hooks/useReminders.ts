import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { usePlanBlocks } from "./useSupabaseData";

const STORAGE_KEY = "studyflow.reminders.enabled";
const FIRED_KEY = "studyflow.reminders.fired";

function getFired(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
  } catch {
    return {};
  }
}

function setFired(map: Record<string, number>) {
  localStorage.setItem(FIRED_KEY, JSON.stringify(map));
}

export function useReminders() {
  const { data: blocks = [] } = usePlanBlocks();
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  const enable = useCallback(async () => {
    if (typeof Notification === "undefined") return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    const ok = result === "granted";
    setEnabledState(ok);
    localStorage.setItem(STORAGE_KEY, ok ? "1" : "0");
    return ok;
  }, []);

  const disable = useCallback(() => {
    setEnabledState(false);
    localStorage.setItem(STORAGE_KEY, "0");
  }, []);

  // Schedule notifications for upcoming blocks today/tomorrow
  useEffect(() => {
    if (!enabled || permission !== "granted") return;
    if (typeof Notification === "undefined") return;

    const timeouts: number[] = [];
    const now = Date.now();
    const horizonMs = now + 24 * 60 * 60 * 1000;
    const fired = getFired();

    // Cleanup very old fired keys (>2 days)
    const cutoff = now - 2 * 24 * 60 * 60 * 1000;
    for (const key of Object.keys(fired)) {
      if (fired[key] < cutoff) delete fired[key];
    }
    setFired(fired);

    blocks.forEach((block) => {
      if (block.completed || block.is_break) return;
      const [h, m] = block.start_time.slice(0, 5).split(":").map(Number);
      const blockTime = new Date(`${block.date}T00:00:00`);
      blockTime.setHours(h, m, 0, 0);
      const startMs = blockTime.getTime();

      const reminders = [
        { key: `${block.id}-10`, fireAt: startMs - 10 * 60 * 1000, title: "Over 10 min", body: `${block.task_title} (${block.subject})` },
        { key: `${block.id}-0`, fireAt: startMs, title: "Tijd om te beginnen!", body: `${block.task_title} (${block.subject})` },
      ];

      reminders.forEach((reminder) => {
        if (reminder.fireAt <= now) return;
        if (reminder.fireAt > horizonMs) return;
        if (fired[reminder.key]) return;
        const delay = reminder.fireAt - now;
        const id = window.setTimeout(() => {
          try {
            new Notification(reminder.title, {
              body: reminder.body,
              icon: "/favicon.ico",
              tag: reminder.key,
            });
            const map = getFired();
            map[reminder.key] = Date.now();
            setFired(map);
          } catch {
            // ignore
          }
        }, delay);
        timeouts.push(id);
      });
    });

    return () => {
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, [enabled, permission, blocks]);

  return { enabled, permission, enable, disable };
}

export function formatNextReminder(blocks: ReturnType<typeof usePlanBlocks>["data"]): string | null {
  if (!blocks) return null;
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const upcoming = blocks
    .filter((b) => !b.completed && !b.is_break && b.date >= today)
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))[0];
  return upcoming ? `${upcoming.date} ${upcoming.start_time.slice(0, 5)}` : null;
}