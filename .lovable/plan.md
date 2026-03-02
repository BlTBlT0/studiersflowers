

## Magister-integratie: haalbaarheidsanalyse

### Wat is Magister?
Magister is het leerlingvolgsysteem dat op de meeste Nederlandse middelbare scholen wordt gebruikt voor cijfers, roosters en huiswerk.

### Het probleem
Magister heeft **geen officiële publieke API**. Er is geen manier om als externe app simpel toegang te krijgen via een standaard koppeling.

### Mogelijke aanpak: Onofficiële Magister API

Er bestaan community-bibliotheken die de interne Magister API gebruiken. De flow zou zijn:

```text
Gebruiker voert in:
  - School-URL (bijv. schoolnaam.magister.net)
  - Gebruikersnaam + wachtwoord

         │
         ▼

Edge Function logt in bij Magister
  → Haalt cijfers op
  → Haalt huiswerk op

         │
         ▼

Data wordt omgezet en opgeslagen
  → Cijfers → grades tabel
  → Huiswerk → tasks tabel
```

### Wat er gebouwd moet worden

1. **Edge Function** die communiceert met de Magister API:
   - Inloggen met schoolgegevens
   - Cijfers ophalen en mappen naar het `grades` formaat
   - Huiswerk ophalen en mappen naar het `tasks` formaat

2. **Import-pagina of modal** waar de gebruiker:
   - School-URL invoert
   - Inlogt met Magister-gegevens
   - Kiest wat geïmporteerd wordt (cijfers, huiswerk, of beide)

3. **Data mapping**:
   - Magister-vaknamen → SUBJECTS lijst matchen
   - Cijfers → `grades` tabel
   - Huiswerk → `tasks` tabel met juiste deadline en vak

### Belangrijke risico's

| Risico | Impact |
|--------|--------|
| Magister kan API veranderen | Import kan plotseling stoppen werken |
| Inloggegevens nodig | Gebruiker moet wachtwoord delen |
| Niet alle scholen werken hetzelfde | Vaknamen en structuur verschillen per school |
| Geen officiële ondersteuning | Geen garantie op stabiliteit |

### Aanbeveling

De meest realistische eerste stap is een **semi-handmatige import**: een pagina waar de gebruiker Magister-gegevens invoert, en een edge function die eenmalig de data ophaalt. Geen continue sync, maar een "Importeer nu"-knop.

Wil je hiermee doorgaan, dan moet ik eerst de Magister API-documentatie onderzoeken om te bepalen welke endpoints beschikbaar zijn en hoe authenticatie werkt.

