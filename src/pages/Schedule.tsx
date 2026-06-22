import { useState, useEffect } from "react";
import { WEEKDAYS, WEEKDAY_LABELS, Weekday } from "@/types";
import { useScheduleSettings, useScheduleSettingsMutations, useActivities, useActivityMutations } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Clock, Home } from "lucide-react";

const DEFAULT_SCHOOL_END_TIMES = {
  monday: "15:30", tuesday: "15:30", wednesday: "15:30", thursday: "15:30", friday: "15:30",
};
const SCHOOL_DAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];

const Schedule = () => {
  const { data: dbSettings, isLoading } = useScheduleSettings();
  const { upsertSettings } = useScheduleSettingsMutations();
  const { data: activities = [] } = useActivities();
  const { addActivity, deleteActivity } = useActivityMutations();

  const [schoolEndTimes, setSchoolEndTimes] = useState<Record<Weekday, string>>(DEFAULT_SCHOOL_END_TIMES);
  const [bedtime, setBedtime] = useState("21:30");
  const [commuteMinutes, setCommuteMinutes] = useState(15);

  const [actOpen, setActOpen] = useState(false);
  const [actName, setActName] = useState("");
  const [actDay, setActDay] = useState<Weekday>("monday");
  const [actStart, setActStart] = useState("16:00");
  const [actEnd, setActEnd] = useState("17:00");

  // Sync from DB
  useEffect(() => {
    if (dbSettings) {
      const times = dbSettings.school_end_times as Record<string, string>;
      setSchoolEndTimes(times as Record<Weekday, string>);
      setBedtime(dbSettings.bedtime?.slice(0, 5) || "21:30");
      setCommuteMinutes(dbSettings.commute_minutes ?? 15);
    }
  }, [dbSettings]);

  const saveSettings = () => {
    upsertSettings.mutate({
      school_end_times: schoolEndTimes,
      bedtime,
      commute_minutes: commuteMinutes,
    });
  };

  const updateSchoolEnd = (day: Weekday, time: string) => {
    setSchoolEndTimes((prev) => ({ ...prev, [day]: time }));
  };

  // Auto-save on change (debounced via blur)
  const handleBlur = () => saveSettings();

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actName) return;
    addActivity.mutate({ name: actName, weekday: actDay, start_time: actStart, end_time: actEnd });
    setActOpen(false);
    setActName("");
  };

  if (isLoading) return <div className="py-16 text-center text-muted-foreground">Laden...</div>;

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">Rooster</h1>

      {/* School end times */}
      <div className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <Clock size={18} className="text-primary" />
          Schooltijden (einde)
        </h2>
        <div className="grid gap-3 sm:grid-cols-5">
          {SCHOOL_DAYS.map((day) => (
            <div key={day} className="rounded-xl border bg-card p-3">
              <Label className="text-xs text-muted-foreground">{WEEKDAY_LABELS[day]}</Label>
              <Input
                type="time"
                value={schoolEndTimes[day]}
                onChange={(e) => updateSchoolEnd(day, e.target.value)}
                onBlur={handleBlur}
                className="mt-1"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Commute time */}
      <div className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <Home size={18} className="text-primary" />
          Reistijd naar huis
        </h2>
        <div className="max-w-xs rounded-xl border bg-card p-3">
          <Label className="text-xs text-muted-foreground">Minuten</Label>
          <Input
            type="number"
            min="0"
            max="120"
            value={commuteMinutes}
            onChange={(e) => setCommuteMinutes(parseInt(e.target.value) || 0)}
            onBlur={handleBlur}
            className="mt-1"
          />
        </div>
      </div>

      {/* Bedtime */}
      <div className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold">Bedtijd</h2>
        <div className="max-w-xs rounded-xl border bg-card p-3">
          <Label className="text-xs text-muted-foreground">Studeren stopt om</Label>
          <Input
            type="time"
            value={bedtime}
            onChange={(e) => setBedtime(e.target.value)}
            onBlur={handleBlur}
            className="mt-1"
          />
        </div>
      </div>

      {/* Activities */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Naschoolse Activiteiten</h2>
          <Dialog open={actOpen} onOpenChange={setActOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Plus size={14} /> Toevoegen
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Activiteit toevoegen</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddActivity} className="flex flex-col gap-4">
                <div>
                  <Label>Naam</Label>
                  <Input value={actName} onChange={(e) => setActName(e.target.value)} placeholder="Voetbaltraining" required />
                </div>
                <div>
                  <Label>Dag</Label>
                  <Select value={actDay} onValueChange={(v) => setActDay(v as Weekday)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d) => (
                        <SelectItem key={d} value={d}>{WEEKDAY_LABELS[d]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start</Label>
                    <Input type="time" value={actStart} onChange={(e) => setActStart(e.target.value)} />
                  </div>
                  <div>
                    <Label>Einde</Label>
                    <Input type="time" value={actEnd} onChange={(e) => setActEnd(e.target.value)} />
                  </div>
                </div>
                <Button type="submit">Toevoegen</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {WEEKDAYS.map((day) => {
          const dayActivities = activities.filter((a) => a.weekday === day);
          if (dayActivities.length === 0) return null;
          return (
            <div key={day} className="mb-3">
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">{WEEKDAY_LABELS[day]}</h3>
              <div className="flex flex-col gap-1">
                {dayActivities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 animate-fade-in"
                  >
                    <div>
                      <span className="text-sm font-medium">{act.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {act.start_time.slice(0, 5)} – {act.end_time.slice(0, 5)}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteActivity.mutate(act.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {activities.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nog geen activiteiten toegevoegd</p>
        )}
      </div>
    </div>
  );
};

export default Schedule;
