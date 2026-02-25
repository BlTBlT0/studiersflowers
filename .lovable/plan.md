

## Ideeën voor nieuwe features in StudyFlow

Hier zijn handige en leuke toevoegingen die goed passen bij wat je al hebt:

### 1. Statistieken / Voortgangspagina
Een pagina met grafieken (je hebt Recharts al geinstalleerd) die laten zien:
- Hoeveel minuten je per vak hebt gestudeerd deze week
- Verschil tussen geschatte tijd en werkelijke tijd (uit time_tracking)
- Streak: hoeveel dagen op rij je je plan hebt afgemaakt
- Weekoverzicht: hoeveel blokken afgerond vs. gepland

### 2. AI Huiswerk Invoer
Typ je huiswerk in gewone taal, bijvoorbeeld: *"Wiskunde blz 42-45 af voor donderdag"* en laat AI het automatisch omzetten naar een taak met vak, deadline en geschatte tijd. Gebruikt een van de beschikbare AI-modellen (geen API key nodig).

### 3. Cijfers Bijhouden
Een pagina waar je je cijfers per vak kunt invoeren. Toont gemiddelde per vak en trend (stijgend/dalend). Handig om te zien welke vakken meer aandacht nodig hebben -- de planner kan hier dan ook rekening mee houden.

### 4. Weekkalender Weergave
Een visuele weekkalender die je geplande blokken, activiteiten en vrije tijd als gekleurde blokken toont in een tijdlijn per dag. Geeft snel overzicht over je hele week.

### 5. Notificaties / Herinneringen
Browsernotificaties die je waarschuwen wanneer een studieblok begint, of wanneer een deadline dichtbij komt (bijv. morgen).

---

### Technische details

| Feature | Nieuwe tabel(len) | Nieuwe pagina | AI nodig |
|---|---|---|---|
| Statistieken | Geen (gebruikt time_tracking) | `/stats` | Nee |
| AI Invoer | Geen | Geen (uitbreiding Homework) | Ja (Gemini Flash) |
| Cijfers | `grades` (user_id, subject, grade, date, description) | `/grades` | Nee |
| Weekkalender | Geen (gebruikt plan_blocks + activities) | `/week` of tab in Planner | Nee |
| Notificaties | Geen | Geen (service worker / Permission API) | Nee |

Welke wil je als eerste?

