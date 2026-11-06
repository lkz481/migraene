# Migräne-Tagebuch

Kostenlose Web-App fürs iPhone. Keine Werbung, kein Konto. Alle Daten bleiben auf dem Handy.

**App:** https://lkz481.github.io/migraene/

## Installieren (iPhone)

1. Den Link in **Safari** öffnen (nicht in Chrome oder WhatsApp).
2. Unten auf **Teilen** (Quadrat mit Pfeil) tippen → **„Zum Home-Bildschirm“** → „Hinzufügen“.
3. Die App ab jetzt immer über das Mond-Symbol auf dem Home-Bildschirm öffnen.
   Nur so speichert iOS die Daten dauerhaft.
4. Beim ersten Start den Namen eingeben und den Standort für die Wetterdaten erlauben.

## Was die App kann

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

## Wichtig

- **Regelmäßig ein Backup machen.** Löscht man die App vom Home-Bildschirm oder die
  Safari-Websitedaten, sind die Einträge weg. Die App erinnert alle 30 Tage daran.
- Die App ersetzt keine ärztliche Beratung.

## Datenschutz & Sicherheit

- Alle Einträge liegen **nur auf dem Handy** (Browser-Speicher). Kein Konto, kein Server, kein Tracking.
  Dieses Repository enthält nur den App-Code, keine Tagebuch-Einträge.
- Eine Content Security Policy verhindert, dass fremder Code geladen wird.
- Einzige Verbindung nach außen: der optionale Wetterabruf bei Open-Meteo (gerundeter Ort ca. 1 km und Datum,
  ohne Namen, ohne Gesundheitsdaten, ohne Referrer).
- **Optionaler PIN-Schutz** (Einstellungen): Daten werden mit AES-256-GCM verschlüsselt (Schlüssel per PBKDF2 aus der PIN).
  Nach 5 Minuten im Hintergrund sperrt sich die App. PIN vergessen = Daten nur noch über ein Backup wiederherstellbar.
- **Backups sind immer mit Passwort verschlüsselt.** Beim Wiederherstellen werden alle Inhalte geprüft und bereinigt.
- Hinweis: Alle Seiten unter derselben github.io-Adresse teilen sich den Browser-Speicher. Daher keine fremden
  Seiten im selben GitHub-Konto veröffentlichen – oder den PIN-Schutz nutzen.

## Für Entwickler: Updates veröffentlichen

Geänderte Dateien auf GitHub hochladen. Damit iPhones das Update sicher bekommen, in `sw.js`
die Zeile `const VERSION = 'migraene-v…'` hochzählen. Der Service Worker löscht nur eigene alte Caches (`migraene-…`), damit die Zyklus-App unter derselben Adresse nicht betroffen ist.

## Schrift

Lexend (© The Lexend Project Authors), lizenziert unter der SIL Open Font License 1.1 – siehe `fonts/OFL-Lexend.txt`.
Die Schrift liegt lokal in der App; es wird nichts von externen Servern geladen.
