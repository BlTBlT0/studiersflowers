

## Plan: Kleuren weekkalender donkerder maken

### Probleem
De blokken op de weekkalender zijn nauwelijks zichtbaar. De achtergrondkleuren hebben te lage opaciteit (0.25) en de borders zijn te licht.

### Oplossing
In `src/pages/WeekCalendar.tsx` de kleuren significant donkerder maken:

**Activiteiten (`ACTIVITY_COLOR`)**:
- Achtergrond: van `0.25` opaciteit naar `0.5`
- Border: van `0.6` naar `0.85`
- Donkerdere achtergrondkleur gebruiken

**Huiswerk/Default (`DEFAULT_COLOR`)**:
- Achtergrond: van `primary/25` naar `primary/40`
- Border: van `primary/50` naar `primary/70`

**Alle vakken (`SUBJECT_COLORS`)**:
- Achtergrond opaciteit: van `0.35` naar `0.55`
- Border opaciteit: van `0.7` naar `0.9`

### Bestand
- `src/pages/WeekCalendar.tsx` — regels 17-33: kleurconstanten aanpassen

