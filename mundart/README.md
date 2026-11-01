# Mundart-Sprachassistent

Einzelne Datei: `MundartAssistent.jsx` (React + Tailwind, keine weiteren Abhängigkeiten, `export default`).

Ablauf: Push-to-Talk → STT (Schweizerdeutsch) → Claude antwortet in der gewählten Mundart → TTS liest vor → Verlauf im Chat.

- 20 Dialekte (alle Kantone), je mit eigenem Systemprompt (typische Wörter/Schreibweisen)
- 12 Stimmen (6 Regionen × männlich/weiblich) + «Auto» (passend zum Dialekt) + Zufallsstimme
- Dienste umschaltbar: **FHNW** (Gradio, kostenlos/experimentell), **Suisse Line** (REST, API-Schlüssel), **Browser** (Web Speech, Notbehelf)
- Push-to-Talk «Halten» oder «Tippen» (Auto), Leertaste, Texteingabe als Alternative
- API-Schlüssel nur über die Einstellungen (nur Tab oder optional auf dem Gerät gespeichert), nie im Code

## Einbinden

Als Komponente in ein React-Projekt mit Tailwind (v3) importieren, z. B. Vite:

```jsx
import MundartAssistent from "./MundartAssistent.jsx";
export default () => <MundartAssistent />;
```

Das Mikrofon funktioniert nur über HTTPS (oder `localhost`).

## Wichtig: ungeprüfte Dienst-Schnittstellen

Die Endpunkte von `stt4sg.fhnw.ch` und Suisse Line konnten bei der Entwicklung **nicht live getestet** werden (Netzwerk gesperrt; für Suisse Line fand sich keine öffentliche Doku). Der Ablauf wurde gegen simulierte Gradio- und Anthropic-Antworten geprüft. Deshalb sind api_name, Parameter-Vorlagen und REST-Pfade in den Einstellungen anpassbar; bei FHNW hilft «Endpunkte erkennen», die echten Namen abzurufen. Falls der Dienst keine CORS-Header sendet, braucht es einen kleinen Proxy.

Der Anthropic-Schlüssel liegt im Browser (`anthropic-dangerous-direct-browser-access`). Für öffentlichen Einsatz gehört der Aufruf auf einen eigenen Server.

Lizenz: Die Forschungsdaten hinter STT4SG-350, SDS-200 und SwissDial sind nur für Forschung lizenziert – für Kundeneinsatz die Lizenz des jeweiligen Dienstes klären.
