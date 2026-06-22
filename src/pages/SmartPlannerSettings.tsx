import { useEffect, useMemo, useState } from "react";
import {
  useGradeMutations,
  useGrades,
  useScheduleSettings,
  useScheduleSettingsMutations,
  useSubjectMutations,
  useSubjects,
} from "@/hooks/useSupabaseData";
import { SUBJECTS } from "@/types";
import { loadWeatherForecast } from "@/lib/weather";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CloudSun, GraduationCap, Plus, Save, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_SCHOOL_END_TIMES = {
  monday: "15:30",
  tuesday: "15:30",
  wednesday: "15:30",
  thursday: "15:30",
  friday: "15:30",
};

const SmartPlannerSettings = () => {
  const { data: settings, isLoading } = useScheduleSettings();
  const { upsertSettings } = useScheduleSettingsMutations();
  const { data: grades = [] } = useGrades();
  const { addGrade, updateGrade, deleteGrade } = useGradeMutations();
  const { data: customSubjects = [] } = useSubjects();
  const { addSubject, deleteSubject } = useSubjectMutations();

  const [smartEnabled, setSmartEnabled] = useState(true);
  const [gradeEnabled, setGradeEnabled] = useState(true);
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [weekdayStart, setWeekdayStart] = useState("16:00");
  const [weekdayEnd, setWeekdayEnd] = useState("21:30");
  const [weekendStart, setWeekendStart] = useState("10:00");
  const [weekendEnd, setWeekendEnd] = useState("18:00");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [bedtime, setBedtime] = useState("21:30");
  const [maxMinutes, setMaxMinutes] = useState(90);
  const [breakMinutes, setBreakMinutes] = useState(10);
  const [outdoorPreference, setOutdoorPreference] = useState("balanced");
  const [weatherStatus, setWeatherStatus] = useState("Nog niet gecontroleerd");

  const [subjectName, setSubjectName] = useState("");
  const [gradeSubject, setGradeSubject] = useState("");
  const [gradeValue, setGradeValue] = useState("");
  const [gradeDate, setGradeDate] = useState(new Date().toISOString().slice(0, 10));
  const [gradeDescription, setGradeDescription] = useState("");
  const [editingGradeId, setEditingGradeId] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setSmartEnabled(settings.smart_priority_enabled);
    setGradeEnabled(settings.grade_based_planning_enabled);
    setWeatherEnabled(settings.weather_planning_enabled);
    setWeekdayStart(settings.weekday_study_start.slice(0, 5));
    setWeekdayEnd(settings.weekday_study_end.slice(0, 5));
    setWeekendStart(settings.weekend_study_start.slice(0, 5));
    setWeekendEnd(settings.weekend_study_end.slice(0, 5));
    setWakeTime(settings.wake_time.slice(0, 5));
    setBedtime(settings.bedtime.slice(0, 5));
    setMaxMinutes(settings.max_study_minutes_per_day);
    setBreakMinutes(settings.break_length_minutes);
    setOutdoorPreference(settings.outdoor_preference);
  }, [settings]);

  const subjects = useMemo(
    () => [...new Set([...SUBJECTS, ...customSubjects.map((item) => item.name), ...grades.map((item) => item.subject)])].sort(),
    [customSubjects, grades]
  );

  const groupedGrades = useMemo(() => {
    return subjects.map((subject) => ({
      subject,
      items: grades.filter((grade) => grade.subject === subject),
    })).filter((group) => group.items.length > 0);
  }, [grades, subjects]);

  const saveSettings = () => {
    upsertSettings.mutate({
      school_end_times: settings?.school_end_times || DEFAULT_SCHOOL_END_TIMES,
      bedtime,
      commute_minutes: settings?.commute_minutes ?? 15,
      smart_priority_enabled: smartEnabled,
      grade_based_planning_enabled: gradeEnabled,
      weather_planning_enabled: weatherEnabled,
      weekday_study_start: weekdayStart,
      weekday_study_end: weekdayEnd,
      weekend_study_start: weekendStart,
      weekend_study_end: weekendEnd,
      wake_time: wakeTime,
      max_study_minutes_per_day: maxMinutes,
      break_length_minutes: breakMinutes,
      outdoor_preference: outdoorPreference,
    });
    toast.success("Smart Planner-instellingen opgeslagen");
  };

  const saveGrade = () => {
    const value = Number(gradeValue.replace(",", "."));
    if (!gradeSubject || value < 1 || value > 10) {
      toast.error("Kies een vak en vul een cijfer tussen 1 en 10 in");
      return;
    }
    const payload = {
      subject: gradeSubject,
      grade: value,
      date: gradeDate,
      description: gradeDescription,
      is_final_grade: false,
    };
    if (editingGradeId) updateGrade.mutate({ id: editingGradeId, ...payload });
    else addGrade.mutate(payload);
    setEditingGradeId(null);
    setGradeValue("");
    setGradeDescription("");
  };

  const editGrade = (grade: typeof grades[number]) => {
    setEditingGradeId(grade.id);
    setGradeSubject(grade.subject);
    setGradeValue(String(grade.grade));
    setGradeDate(grade.date);
    setGradeDescription(grade.description || "");
  };

  const testWeather = async () => {
    setWeatherStatus("Locatie en weer worden opgehaald...");
    const forecast = await loadWeatherForecast(true);
    setWeatherStatus(
      forecast.source === "open-meteo"
        ? "Locatie toegestaan: echte Open-Meteo-verwachting beschikbaar"
        : forecast.message || "Voorbeeldweer actief"
    );
  };

  if (isLoading) return <div className="py-16 text-center text-muted-foreground">Laden...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Smart Planner Settings</h1>
        <p className="text-sm text-muted-foreground">Bepaal hoe StudyFlow prioriteiten en vrije tijd afweegt.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Settings2 size={18} />Slim plannen</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {[
            ["Smart Priority", smartEnabled, setSmartEnabled],
            ["Cijfers meenemen", gradeEnabled, setGradeEnabled],
            ["Weather Planning", weatherEnabled, setWeatherEnabled],
          ].map(([label, checked, setter]) => (
            <div key={label as string} className="flex items-center justify-between rounded-lg border p-3">
              <Label>{label as string}</Label>
              <Switch checked={checked as boolean} onCheckedChange={setter as (value: boolean) => void} />
            </div>
          ))}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Weekdagen vanaf</Label><Input type="time" value={weekdayStart} onChange={(e) => setWeekdayStart(e.target.value)} /></div>
              <div><Label>Tot</Label><Input type="time" value={weekdayEnd} onChange={(e) => setWeekdayEnd(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Weekend vanaf</Label><Input type="time" value={weekendStart} onChange={(e) => setWeekendStart(e.target.value)} /></div>
              <div><Label>Tot</Label><Input type="time" value={weekendEnd} onChange={(e) => setWeekendEnd(e.target.value)} /></div>
            </div>
            <div><Label>Opstaan</Label><Input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} /></div>
            <div><Label>Bedtijd</Label><Input type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} /></div>
            <div><Label>Maximaal studeren per dag</Label><Input type="number" min={15} max={480} value={maxMinutes} onChange={(e) => setMaxMinutes(Number(e.target.value))} /></div>
            <div><Label>Pauze in minuten</Label><Input type="number" min={5} max={60} value={breakMinutes} onChange={(e) => setBreakMinutes(Number(e.target.value))} /></div>
            <div>
              <Label>Voorkeur voor buiten/vrije tijd</Label>
              <Select value={outdoorPreference} onValueChange={setOutdoorPreference}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Laag</SelectItem>
                  <SelectItem value="balanced">Gebalanceerd</SelectItem>
                  <SelectItem value="high">Hoog</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={saveSettings} className="gap-2"><Save size={16} />Instellingen opslaan</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CloudSun size={18} />Weer en locatie</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{weatherStatus}</p>
          <Button variant="outline" onClick={testWeather}>Locatie toestaan en weer testen</Button>
          <p className="text-xs text-muted-foreground">Je exacte locatie wordt niet opgeslagen. Bij weigering gebruikt de planner voorbeeldweer.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Vakken</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Nieuw vak" />
            <Button onClick={() => { if (subjectName.trim()) { addSubject.mutate(subjectName); setSubjectName(""); } }}><Plus size={16} /></Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {customSubjects.map((subject) => (
              <span key={subject.id} className="flex items-center gap-1 rounded-full border bg-secondary px-3 py-1 text-xs">
                {subject.name}
                <button onClick={() => deleteSubject.mutate(subject.id)}><Trash2 size={12} /></button>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><GraduationCap size={18} />Cijfers per vak</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-5">
            <Select value={gradeSubject} onValueChange={setGradeSubject}>
              <SelectTrigger><SelectValue placeholder="Vak" /></SelectTrigger>
              <SelectContent>{subjects.map((subject) => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={gradeValue} onChange={(e) => setGradeValue(e.target.value)} placeholder="Cijfer" />
            <Input type="date" value={gradeDate} onChange={(e) => setGradeDate(e.target.value)} />
            <Input value={gradeDescription} onChange={(e) => setGradeDescription(e.target.value)} placeholder="Omschrijving" />
            <Button onClick={saveGrade}>{editingGradeId ? "Bijwerken" : "Toevoegen"}</Button>
          </div>

          {groupedGrades.map((group) => (
            <div key={group.subject}>
              <h3 className="mb-2 text-sm font-semibold">{group.subject}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.items.map((grade) => (
                  <div key={grade.id} className="flex items-center justify-between rounded-lg border p-3">
                    <button className="text-left" onClick={() => editGrade(grade)}>
                      <span className="font-semibold">{Number(grade.grade).toFixed(1)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{grade.date} {grade.description}</span>
                    </button>
                    <Button variant="ghost" size="icon" onClick={() => deleteGrade.mutate(grade.id)}><Trash2 size={14} /></Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default SmartPlannerSettings;
