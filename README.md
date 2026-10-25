# Migräne-Tagebuch – Anleitung

Eine kostenlose Web-App fürs iPhone. Keine Werbung, kein Konto. Alle Daten bleiben auf dem Handy.

## 1. Online stellen (einmalig, ca. 10 Minuten, kostenlos)

1. Auf **github.com** ein kostenloses Konto anlegen.
2. Oben rechts **„+“ → „New repository“**.
   - Name: z. B. `migraene`
   - **Public** auswählen (Voraussetzung für kostenloses GitHub Pages)
   - „Create repository“
3. Auf der neuen Seite **„uploading an existing file“** anklicken.
   Alle Dateien aus diesem Ordner hineinziehen: `index.html`, `app.js`, `styles.css`, `sw.js`,
   `manifest.webmanifest`, `.nojekyll` und den Ordner `icons`. Dann „Commit changes“.
4. **Settings → Pages**: Bei „Branch“ `main` und `/ (root)` wählen → **Save**.
5. Nach 1–2 Minuten erscheint dort die Adresse, z. B.
   `https://DEINNAME.github.io/migraene/`. Diesen Link der Freundin schicken.

> Das Repository ist öffentlich, aber es enthält nur den **App-Code**. Die Tagebuch-Einträge
> deiner Freundin landen nie auf GitHub, sondern nur auf ihrem iPhone.

## 2. Auf dem iPhone installieren

1. Den Link in **Safari** öffnen (wichtig: nicht in Chrome oder in WhatsApp).
2. Unten auf **Teilen** (Quadrat mit Pfeil) tippen → **„Zum Home-Bildschirm“** → „Hinzufügen“.
3. Die App ab jetzt immer über das neue Mond-Symbol auf dem Home-Bildschirm öffnen.
   Nur so speichert iOS die Daten dauerhaft.
4. Beim ersten Start nach Namen fragen lassen und den Standort für die Wetterdaten erlauben.

## 3. Was die App kann

- **Heute:** ein großer Knopf „Attacke beginnt jetzt“. Alles Weitere lässt sich später ergänzen.
- **Tagebuch:** Beginn, Ende, Stärke 1–10, Ort, Symptome (Aura, Übelkeit …), Auslöser,
  Medikamente mit Uhrzeit und Wirkung, Notizen. Eigene Auslöser und Symptome sind möglich.
- **Luftdruck:** Wird automatisch zum Beginn der Attacke gespeichert, inklusive der Änderung
  über 24 Stunden. Datenquelle ist Open-Meteo (kostenlos, ohne Konto).
- **Muster:** Kopfschmerztage pro Monat, häufigste Auslöser, Wochentage, Tageszeit, Luftdruck
  und Wirkung der Medikamente.
- **Warnung bei Übergebrauch:** ab 10 Triptan-Tagen bzw. 15 Schmerzmittel-Tagen in 30 Tagen.
- **Arztbericht:** Mehr → „Arztbericht erstellen“ → „Drucken / als PDF“ oder „Teilen“.
- **Backup:** Mehr → „Sichern“ → in „Dateien“/iCloud Drive speichern. Bei einem neuen Handy
  über „Wiederherstellen“ wieder einlesen.

## 4. Wichtig

- **Regelmäßig ein Backup machen.** Löscht man die App vom Home-Bildschirm oder die
  Safari-Websitedaten, sind die Einträge weg. Die App erinnert alle 30 Tage daran.
- Die App ersetzt keine ärztliche Beratung.

## Später etwas ändern

Geänderte Dateien einfach erneut auf GitHub hochladen. Damit iPhones das Update sicher
bekommen, in `sw.js` die Zeile `const VERSION = 'migraene-v1'` hochzählen (v2, v3 …).
