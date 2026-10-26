'use strict';

/* =========================================================
   Migräne-Tagebuch – alle Daten bleiben lokal auf dem Gerät
   ========================================================= */

const STORE_KEY = 'migraene-tagebuch-v1';
const PBKDF2_ITER = 310000;            // Schlüsselableitung für PIN und Backup-Passwort
const AUTOLOCK_MS = 5 * 60 * 1000;     // mit PIN: nach 5 Min. im Hintergrund wieder sperren
const STALE_MS = 24 * 3600 * 1000;     // nach 24 Std. nachfragen, ob eine Attacke noch läuft
const LONG_MS = 72 * 3600 * 1000;      // ab 72 Std. ärztlich abklären (Status migränosus)

const LOCATIONS = ['Links', 'Rechts', 'Beidseitig', 'Stirn', 'Schläfe', 'Hinter dem Auge', 'Hinterkopf', 'Nacken'];
const SYMPTOMS = ['Übelkeit', 'Erbrechen', 'Lichtempfindlich', 'Lärmempfindlich', 'Geruchsempfindlich',
  'Schwindel', 'Sehstörungen', 'Kribbeln/Taubheit', 'Pochend', 'Schlimmer bei Bewegung', 'Müdigkeit'];
const TRIGGERS = ['Schlafmangel', 'Zu viel Schlaf', 'Stress', 'Entspannung nach Stress', 'Periode', 'Alkohol',
  'Koffein', 'Mahlzeit ausgelassen', 'Zu wenig getrunken', 'Wetterwechsel', 'Bildschirm', 'Grelles Licht',
  'Lärm', 'Gerüche', 'Sport', 'Bestimmtes Essen', 'Reisen', 'Verspannung'];
const CORE_SYMPTOMS = ['Übelkeit', 'Erbrechen', 'Lichtempfindlich', 'Lärmempfindlich'];
// Was jede Stufe im Alltag bedeutet – wird beim Schieben angezeigt
const PAIN_WORDS = [null,
  ['Kaum spürbar', 'Fällt nur auf, wenn du darauf achtest'],
  ['Sehr leicht', 'Stört kaum'],
  ['Leicht', 'Lenkt etwas ab, der Alltag geht'],
  ['Spürbar', 'Stört bei der Konzentration'],
  ['Mittel', 'Der Alltag ist eingeschränkt'],
  ['Deutlich', 'Konzentrieren fällt schwer'],
  ['Stark', 'Der Alltag ist kaum noch möglich'],
  ['Sehr stark', 'Du musst dich hinlegen'],
  ['Kaum auszuhalten', 'Es geht gar nichts mehr'],
  ['Unerträglich', 'Der schlimmste Schmerz, den du dir vorstellen kannst']];
const IMPAIRMENT = ['Kaum', 'Etwas', 'Stark', 'Bettlägerig'];
const MED_TYPES = {
  triptan: 'Triptan',
  analgetikum: 'Schmerzmittel',
  antiemetikum: 'Gegen Übelkeit',
  prophylaxe: 'Prophylaxe (täglich)',
  sonstiges: 'Sonstiges'
};
// Vorschläge beim Anlegen – gängige Dosierungen, kann jederzeit angepasst werden
const MED_SUGGESTIONS = {
  triptan: ['Sumatriptan 50 mg', 'Sumatriptan 100 mg', 'Sumatriptan Nasenspray 20 mg', 'Sumatriptan Spritze 6 mg',
    'Rizatriptan 10 mg', 'Rizatriptan Schmelztablette 10 mg', 'Zolmitriptan 2,5 mg', 'Zolmitriptan 5 mg',
    'Zolmitriptan Nasenspray 5 mg', 'Naratriptan 2,5 mg', 'Eletriptan 40 mg', 'Almotriptan 12,5 mg', 'Frovatriptan 2,5 mg'],
  analgetikum: ['Ibuprofen 400 mg', 'Ibuprofen 600 mg', 'Paracetamol 500 mg', 'Paracetamol 1000 mg', 'ASS 500 mg',
    'ASS 1000 mg', 'Naproxen 500 mg', 'Diclofenac 50 mg', 'Metamizol (Novalgin) 500 mg', 'Thomapyrin (ASS + Paracetamol + Coffein)'],
  antiemetikum: ['Metoclopramid (MCP) 10 mg', 'Domperidon 10 mg', 'Dimenhydrinat (Vomex) 50 mg'],
  prophylaxe: ['Metoprolol', 'Propranolol', 'Topiramat', 'Amitriptylin', 'Flunarizin', 'Candesartan',
    'Erenumab (Aimovig)', 'Fremanezumab (Ajovy)', 'Galcanezumab (Emgality)', 'Eptinezumab (Vyepti)', 'Botox-Injektionen', 'Magnesium'],
  sonstiges: ['Rimegepant (Vydura) 75 mg', 'Lasmiditan (Rayvow) 100 mg']
};
const SUGG_GROUPS = { triptan: 'Triptane', analgetikum: 'Schmerzmittel', antiemetikum: 'Gegen Übelkeit', prophylaxe: 'Prophylaxe', sonstiges: 'Weitere Akutmittel' };

const EFFECTS = ['Keine', 'Etwas', 'Gut', 'Sehr gut'];
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/* ---------- Helfer ---------- */

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const pad = n => String(n).padStart(2, '0');
function toLocalInput(d) {
  d = new Date(d);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function dayKey(d) { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fmtDate(d) { return new Date(d).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }); }
function fmtTime(d) { return new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }
function fmtDateTime(d) { return `${fmtDate(d)}, ${fmtTime(d)}`; }
function fmtDuration(a) {
  const end = a.end ? new Date(a.end) : new Date();
  let min = Math.max(0, Math.round((end - new Date(a.start)) / 60000));
  const h = Math.floor(min / 60); min %= 60;
  if (h >= 24) return `${Math.floor(h / 24)} T ${h % 24} Std`;
  return h ? `${h} Std ${min} Min` : `${min} Min`;
}
// Schmerz-Schieberegler: große Zahl, Wort und Beschreibung ändern sich beim Schieben
function painSliderHTML(value) {
  const v = value || 5;
  const [word, desc] = PAIN_WORDS[v];
  return `<div class="pain-slider${value ? '' : ' unset'}" style="--pc:${painColor(v)}">
    <div class="pain-readout" aria-hidden="true">
      <span class="pain-num">${value ? v : '–'}</span>
      <span class="pain-word">${value ? word : 'Regler bewegen'}</span>
      <span class="pain-desc">${value ? desc : 'Schieb oder tippe auf die Stelle, die passt'}</span>
    </div>
    <input type="range" class="pain-range" min="1" max="10" step="1" value="${v}"
      aria-label="Schmerzstärke" aria-valuetext="${value ? `${v} – ${word}` : 'noch nicht angegeben'}">
    <div class="pain-ticks" aria-hidden="true">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<span>${n}</span>`).join('')}</div>
    <div class="pain-ends" aria-hidden="true"><span>kaum spürbar</span><span>unerträglich</span></div>
  </div>`;
}

function updatePainSlider(range) {
  const v = +range.value;
  const box = range.closest('.pain-slider');
  const [word, desc] = PAIN_WORDS[v];
  box.classList.remove('unset');
  box.style.setProperty('--pc', painColor(v));
  $('.pain-num', box).textContent = v;
  $('.pain-word', box).textContent = word;
  $('.pain-desc', box).textContent = desc;
  range.setAttribute('aria-valuetext', `${v} – ${word}`);
  return v;
}

function painColor(n) {
  if (!n) return '#3a3f4e';
  const hues = [150, 135, 110, 85, 60, 45, 30, 15, 5, 350];
  return `hsl(${hues[n - 1]} 55% 68%)`;
}
const hasAura = a => a.aura === true;
const auraText = a => (a.aura === true ? 'ja' : a.aura === false ? 'nein' : '–');
const plural = (n, one, many) => (n === 1 ? one : many);

/* ---------- Prüfen aller Daten (Speicher und Backup) ----------
   Alles, was von außen kommt, wird auf erlaubte Felder, Typen und Längen
   zurechtgestutzt. So kann eine manipulierte Datei keinen Code einschleusen. */

const ID_RE = /^[a-z0-9]{4,40}$/;
function str(v, max = 200) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
function isoOrNull(v) {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
function num(v, min, max) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}
function strList(v) {
  return Array.isArray(v) ? [...new Set(v.map(x => str(x, 80)).filter(Boolean))].slice(0, 60) : [];
}
function freshId(v, used) {
  let id = typeof v === 'string' && ID_RE.test(v) ? v : uid();
  while (used.has(id)) id = uid();
  used.add(id);
  return id;
}

function defaultState() {
  return {
    version: 2,
    settings: { name: '', weather: true, onboarded: false, lastBackup: null, coords: null },
    meds: [],
    attacks: []
  };
}

function sanitizeState(raw) {
  const s = defaultState();
  if (!raw || typeof raw !== 'object') return s;
  const st = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  s.settings.name = str(st.name, 60);
  s.settings.weather = st.weather !== false;
  s.settings.onboarded = st.onboarded === true;
  s.settings.lastBackup = isoOrNull(st.lastBackup);
  const lat = num(st.coords && st.coords.lat, -90, 90), lon = num(st.coords && st.coords.lon, -180, 180);
  s.settings.coords = lat !== null && lon !== null ? { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 } : null;

  const medIds = new Set();
  s.meds = (Array.isArray(raw.meds) ? raw.meds : []).slice(0, 300).map(m => {
    if (!m || typeof m !== 'object') return null;
    const name = str(m.name, 120);
    if (!name) return null;
    return {
      id: freshId(m.id, medIds), name,
      type: Object.hasOwn(MED_TYPES, m.type) ? m.type : 'sonstiges',
      since: typeof m.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.since) ? m.since : ''
    };
  }).filter(Boolean);

  const attIds = new Set();
  let running = false;
  s.attacks = (Array.isArray(raw.attacks) ? raw.attacks : []).slice(0, 20000).map(a => {
    if (!a || typeof a !== 'object') return null;
    const start = isoOrNull(a.start);
    if (!start) return null;
    let end = isoOrNull(a.end);
    if (end && end < start) end = start;
    if (!end) { if (running) end = start; running = true; }   // höchstens eine laufende Attacke
    const meds = (Array.isArray(a.meds) ? a.meds : []).slice(0, 50).map(m => {
      if (!m || typeof m !== 'object') return null;
      const e = num(m.effect, 0, 3);
      const o = { medId: typeof m.medId === 'string' && ID_RE.test(m.medId) ? m.medId : '', time: isoOrNull(m.time) || start, effect: e === null ? null : Math.round(e) };
      if (m.name) o.name = str(m.name, 120);
      if (Object.hasOwn(MED_TYPES, m.type)) o.type = m.type;
      return o;
    }).filter(Boolean);
    let weather = null;
    if (a.weather && typeof a.weather === 'object') {
      const w = a.weather;
      weather = {
        for: typeof w.for === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(w.for) ? w.for : '',
        pressure: num(w.pressure, 800, 1100), change24: num(w.change24, -100, 100),
        temp: num(w.temp, -80, 70), humidity: num(w.humidity, 0, 100)
      };
      if (weather.pressure === null) weather = null;
    }
    const imp = num(a.impairment, 0, 3);
    const symptoms = strList(a.symptoms);
    // früher war „Aura“ ein Symptom – jetzt ein eigenes Feld (ja / nein / unbekannt)
    const aura = typeof a.aura === 'boolean' ? a.aura : (symptoms.includes('Aura') ? true : null);
    return {
      id: freshId(a.id, attIds), start, end, aura,
      checkedAt: end ? null : isoOrNull(a.checkedAt),
      intensity: Math.round(num(a.intensity, 0, 10) || 0),
      impairment: imp === null ? null : Math.round(imp),
      locations: strList(a.locations), symptoms: symptoms.filter(x => x !== 'Aura'), triggers: strList(a.triggers),
      meds, notes: str(a.notes, 4000), weather
    };
  }).filter(Boolean);
  return s;
}

/* ---------- Verschlüsselung (Web Crypto, AES-256-GCM) ---------- */

const te = new TextEncoder(), td = new TextDecoder();
function toB64(buf) {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b) {
  const s = atob(b);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
async function deriveKey(secret, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', te.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function sealJSON(obj, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj)));
  return { iv: toB64(iv), ct: toB64(ct) };
}
async function openJSON(box, key) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, key, fromB64(box.ct));
  return JSON.parse(td.decode(pt));
}
const iterOf = box => num(box.iter, 100000, 5000000) || PBKDF2_ITER;

/* ---------- Speicher ---------- */

let state = defaultState();
let vault = null;                 // { key, salt, iter } solange der PIN-Schutz aktiv und entsperrt ist
let saveChain = Promise.resolve();

function readStored() {
  let raw = null;
  try { raw = localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) {
    // Beschädigte Daten nicht stillschweigend überschreiben, sondern beiseitelegen
    try { localStorage.setItem(STORE_KEY + '-beschaedigt-' + Date.now(), raw); } catch (e2) { /* voll */ }
    return null;
  }
}

function save() {
  saveChain = saveChain.then(async () => {
    try {
      if (vault) {
        const box = await sealJSON(state, vault.key);
        localStorage.setItem(STORE_KEY, JSON.stringify({ enc: 1, salt: toB64(vault.salt), iter: vault.iter, ...box }));
      } else {
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
      }
    } catch (e) {
      toast('Speichern fehlgeschlagen – bitte ein Backup erstellen.');
    }
  });
  return saveChain;
}

try { navigator.storage?.persist?.().catch(() => {}); } catch (e) { /* nicht unterstützt */ }

/* ---------- Auswertungs-Helfer ---------- */

// Alle Kalendertage, die eine Attacke berührt
function attackDays(a) {
  const days = [];
  const d = new Date(a.start); d.setHours(0, 0, 0, 0);
  const end = new Date(a.end || (a.start > new Date().toISOString() ? a.start : new Date()));
  let guard = 0;
  while (d <= end && guard++ < 40) { days.push(dayKey(d)); d.setDate(d.getDate() + 1); }
  return days.length ? days : [dayKey(a.start)];
}

function attacksBetween(from, to) {
  return state.attacks.filter(a => new Date(a.start) <= to && new Date(a.end || Date.now()) >= from);
}

function headacheDays(from, to) {
  const set = new Set();
  const fk = dayKey(from), tk = dayKey(to);
  attacksBetween(from, to).forEach(a => attackDays(a).forEach(k => { if (k >= fk && k <= tk) set.add(k); }));
  return set.size;
}

function medType(m) {
  const med = state.meds.find(x => x.id === m.medId);
  return med ? med.type : m.type;
}
function medName(m) {
  const med = state.meds.find(x => x.id === m.medId);
  return med ? med.name : (m.name || 'Medikament');
}

// Tage mit Einnahme je Medikamententyp
function medDays(from, to) {
  const res = { triptan: new Set(), analgetikum: new Set(), acute: new Set() };
  state.attacks.forEach(a => (a.meds || []).forEach(m => {
    const t = new Date(m.time || a.start);
    if (t < from || t > to) return;
    const type = medType(m);
    const k = dayKey(t);
    if (type === 'triptan') res.triptan.add(k);
    if (type === 'analgetikum') res.analgetikum.add(k);
    if (type === 'triptan' || type === 'analgetikum') res.acute.add(k);
  }));
  return { triptan: res.triptan.size, analgetikum: res.analgetikum.size, acute: res.acute.size };
}

function last30() {
  const to = new Date();
  const from = new Date(); from.setDate(from.getDate() - 29); from.setHours(0, 0, 0, 0);
  return { from, to };
}

function overuseWarnings() {
  const { from, to } = last30();
  const d = medDays(from, to);
  const w = [];
  if (d.triptan >= 10) w.push(`An <strong>${d.triptan} Tagen</strong> in den letzten 30 Tagen wurde ein Triptan genommen (Grenze: unter 10 Tage/Monat).`);
  if (d.analgetikum >= 15) w.push(`An <strong>${d.analgetikum} Tagen</strong> in den letzten 30 Tagen wurden Schmerzmittel genommen (Grenze: unter 15 Tage/Monat).`);
  else if (d.acute >= 10 && d.triptan < 10) w.push(`An <strong>${d.acute} Tagen</strong> in den letzten 30 Tagen wurden Akutmedikamente genommen. Ab ca. 10 Tagen/Monat steigt das Risiko für Kopfschmerz durch Medikamentenübergebrauch.`);
  return w;
}

function activeAttack() { return state.attacks.find(a => !a.end); }
const byNewest = (a, b) => new Date(b.start) - new Date(a.start);

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
}

/* ---------- Eigene Dialoge (statt confirm/prompt) ---------- */

function dialog(msg, { okText = 'OK', cancelText = 'Abbrechen', danger = false, input = false } = {}) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'dlg-wrap';
    const field = !input ? ''
      : input === 'pin' ? '<input type="password" id="dlg-input" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" aria-label="PIN">'
      : input === 'password' ? '<input type="password" id="dlg-input" autocomplete="off" aria-label="Passwort">'
      : '<input type="text" id="dlg-input" autocomplete="off" maxlength="80" aria-label="Eingabe">';
    wrap.innerHTML = `<div class="dlg" role="dialog" aria-modal="true">
      <p>${esc(msg)}</p>
      ${field}
      <div class="grid2">
        <button class="btn" data-dlg="0">${esc(cancelText)}</button>
        <button class="btn ${danger ? 'danger-fill' : 'primary'}" data-dlg="1">${esc(okText)}</button>
      </div></div>`;
    document.body.appendChild(wrap);
    const inp = $('#dlg-input', wrap);
    if (inp) setTimeout(() => inp.focus(), 50);
    const done = ok => {
      wrap.remove();
      if (!input) return resolve(ok);
      const v = ok ? inp.value : '';
      resolve(input === 'pin' || input === 'password' ? v : v.trim());
    };
    wrap.addEventListener('click', e => {
      const b = e.target.closest('[data-dlg]');
      if (b) { e.stopPropagation(); done(b.dataset.dlg === '1'); }
    });
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(true); });
  });
}

/* ---------- Wetter (Open-Meteo, kostenlos, ohne Konto) ----------
   Gesendet werden nur gerundete Koordinaten (ca. 1 km) und das Datum –
   keine Namen, keine Gesundheitsdaten, kein Referrer, keine Cookies. */

function getCoords() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(state.settings.coords);
    navigator.geolocation.getCurrentPosition(
      p => {
        const c = { lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100 };
        state.settings.coords = c; save();
        resolve(c);
      },
      () => resolve(state.settings.coords),
      { timeout: 10000, maximumAge: 30 * 60000, enableHighAccuracy: false }
    );
  });
}

async function fetchWeather(when) {
  const c = await getCoords();
  if (!c) throw new Error('Kein Standort');
  const t = new Date(when);
  const prev = new Date(t); prev.setDate(prev.getDate() - 1);
  const ageDays = (Date.now() - t) / 86400000;
  const host = ageDays > 80 ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';
  const url = `${host}?latitude=${c.lat}&longitude=${c.lon}&hourly=surface_pressure,temperature_2m,relative_humidity_2m`
    + `&start_date=${dayKey(prev)}&end_date=${dayKey(t)}&timezone=auto`;
  const res = await fetch(url, { referrerPolicy: 'no-referrer', credentials: 'omit', cache: 'no-store' });
  if (!res.ok) throw new Error('Wetterdienst nicht erreichbar');
  const data = await res.json();
  const H = data && data.hourly;
  if (!H || !Array.isArray(H.time) || !Array.isArray(H.surface_pressure)) throw new Error('Unerwartete Antwort');
  const target = `${dayKey(t)}T${pad(t.getHours())}:00`;
  const i = H.time.indexOf(target);
  const p = i >= 0 ? num(H.surface_pressure[i], 800, 1100) : null;
  if (p === null) throw new Error('Keine Daten');
  const p24 = i >= 24 ? num(H.surface_pressure[i - 24], 800, 1100) : null;
  const tmp = num(H.temperature_2m && H.temperature_2m[i], -80, 70);
  const hum = num(H.relative_humidity_2m && H.relative_humidity_2m[i], 0, 100);
  return {
    for: target,
    pressure: Math.round(p),
    change24: p24 !== null ? Math.round((p - p24) * 10) / 10 : null,
    temp: tmp === null ? null : Math.round(tmp),
    humidity: hum === null ? null : Math.round(hum)
  };
}

async function attachWeather(attack, silent) {
  if (!state.settings.weather) return;
  try {
    const w = await fetchWeather(attack.start);
    const a = state.attacks.find(x => x.id === attack.id);
    if (!a) return;
    a.weather = w; save();
    if (!silent) toast('Wetterdaten gespeichert');
    if ($('#sheet').hidden) render();
  } catch (e) {
    if (!silent) toast('Wetter konnte nicht geladen werden');
  }
}

function weatherHTML(w) {
  if (!w) return '<span class="muted">Keine Wetterdaten</span>';
  const ch = w.change24;
  const trend = ch === null ? '' : ch <= -3 ? ' · stark fallend' : ch >= 3 ? ' · stark steigend' : ' · stabil';
  return `<div class="weather">
    <span>Luftdruck <b>${w.pressure} hPa</b></span>
    ${ch !== null ? `<span>24 h: <b>${ch > 0 ? '+' : ''}${ch} hPa</b>${trend}</span>` : ''}
    ${w.temp !== null ? `<span><b>${w.temp} °C</b></span>` : ''}
    ${w.humidity !== null ? `<span>Feuchte <b>${w.humidity} %</b></span>` : ''}
  </div>`;
}

/* ---------- Navigation ---------- */

let tab = 'home';
const TITLES = { home: 'Heute', diary: 'Tagebuch', stats: 'Auswertung', settings: 'Einstellungen' };

$$('.tabbar button').forEach(b => b.addEventListener('click', () => {
  tab = b.dataset.tab;
  render();
  window.scrollTo(0, 0);
}));

function render() {
  $('#title').textContent = TITLES[tab];
  $$('.tabbar button').forEach(x => {
    const on = x.dataset.tab === tab;
    x.classList.toggle('active', on);
    if (on) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current');
  });
  $('#view').innerHTML = { home: viewHome, diary: viewDiary, stats: viewStats, settings: viewSettings }[tab]();
}

/* ---------- Ansicht: Heute ---------- */

function greeting() {
  const h = new Date().getHours();
  const g = h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 17 ? 'Hallo' : h < 22 ? 'Guten Abend' : 'Gute Nacht';
  const n = state.settings.name;
  return n ? `${g}, ${esc(n)}` : g;
}

function viewHome() {
  const act = activeAttack();
  const { from, to } = last30();
  const days = headacheDays(from, to);
  const md = medDays(from, to);
  const warns = overuseWarnings();
  const last = state.attacks.filter(a => a.end).sort(byNewest)[0];
  let sinceText = '';
  if (!act && last) {
    const d = Math.floor((Date.now() - new Date(last.end)) / 86400000);
    sinceText = d <= 0 ? 'Letzte Attacke: heute' : d === 1 ? 'Seit 1 Tag ohne Attacke' : `Seit ${d} Tagen ohne Attacke`;
  }
  const backupDue = state.attacks.length >= 3 &&
    (!state.settings.lastBackup || Date.now() - new Date(state.settings.lastBackup) > 30 * 86400000);

  return `
    <div class="greet">
      <p>${greeting()}</p>
      <p class="muted">${act ? 'Gute Besserung. Ruh dich aus – Details kannst du später ergänzen.' : sinceText || 'Schön, dass du da bist.'}</p>
    </div>

    ${act ? `
      <div class="card running">
        <div class="row"><h2>Attacke läuft</h2><span class="muted">${fmtDuration(act)}</span></div>
        <p class="muted small">Seit ${fmtDateTime(act.start)}${act.intensity ? ` · Stärke ${act.intensity}/10` : ''}${hasAura(act) ? ' · mit Aura' : ''}</p>
        <div class="grid2">
          <button class="btn" data-act="edit" data-id="${act.id}">Details ergänzen</button>
          <button class="btn" data-act="addmed" data-id="${act.id}">Medikament</button>
        </div>
        <button class="big-btn active" data-act="end" data-id="${act.id}">Attacke beenden</button>
      </div>` : `
      <button class="big-btn" data-act="start">Attacke beginnt jetzt</button>
      <button class="btn block" data-act="new">Vergangene Attacke nachtragen</button>`}

    ${warns.map(w => `<div class="card warn"><p>⚠︎ ${w}</p><p class="small muted">Bitte mit der Ärztin oder dem Arzt besprechen.</p></div>`).join('')}

    <button class="card card-link" data-act="goto" data-tab="diary">
      <span class="row"><span class="h3">Letzte 30 Tage</span><span class="muted">Kalender ›</span></span>
      <span class="grid2">
        <span class="stat"><b>${days}</b><span>${plural(days, 'Kopfschmerztag', 'Kopfschmerztage')}</span></span>
        <span class="stat"><b>${md.acute}</b><span>${plural(md.acute, 'Tag', 'Tage')} mit Akutmittel</span></span>
      </span>
    </button>

    ${backupDue ? `<div class="card"><p>Zeit für ein Backup? Deine Einträge liegen nur auf diesem Handy.</p>
      <button class="btn" data-act="backup">Jetzt sichern</button></div>` : ''}
  `;
}

/* ---------- Ansicht: Tagebuch (Kalender + Liste) ---------- */

let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let calDay = null;

function dayInfo() {
  const map = {};
  state.attacks.forEach(a => attackDays(a).forEach(k => {
    const o = map[k] || (map[k] = { max: 0, aura: false });
    o.max = Math.max(o.max, a.intensity || 0);
    o.aura = o.aura || hasAura(a);
  }));
  return map;
}

function entryHTML(a) {
  const meds = (a.meds || []).map(medName).join(', ');
  const imp = a.impairment !== null && a.impairment !== undefined ? ` · ${IMPAIRMENT[a.impairment]} eingeschränkt` : '';
  return `<button class="entry" data-act="edit" data-id="${a.id}">
    <span class="pain" style="background:${painColor(a.intensity)}">${a.intensity || '–'}</span>
    <span class="entry-main">
      <span class="t">${fmtDate(a.start)} ${hasAura(a) ? '<span class="tag on">Aura</span>' : ''}</span>
      <span class="s">${fmtTime(a.start)} · ${a.end ? fmtDuration(a) : 'läuft noch'}${imp}</span>
      ${meds ? `<span class="s">💊 ${esc(meds)}</span>` : ''}
    </span>
    <span class="muted">›</span>
  </button>`;
}

function viewDiary() {
  const info = dayInfo();
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;   // Woche beginnt Montag
  const nDays = new Date(y, m + 1, 0).getDate();
  const today = dayKey(new Date());
  let cells = '';
  for (let i = 0; i < offset; i++) cells += '<span></span>';
  for (let d = 1; d <= nDays; d++) {
    const k = `${y}-${pad(m + 1)}-${pad(d)}`;
    const o = info[k];
    const cls = ['cal-day', k === today && 'today', k === calDay && 'sel', o && 'has', k > today && 'future'].filter(Boolean).join(' ');
    cells += `<button class="${cls}" data-act="calday" data-day="${k}" ${o ? `style="--pc:${painColor(o.max)}"` : ''}
      aria-label="${d}. ${MONTHS[m]}${o ? (o.aura ? ', Kopfschmerz mit Aura' : ', Kopfschmerz') : ''}" aria-pressed="${k === calDay}">
      <span>${d}</span>${o && o.aura ? '<i class="aura-dot"></i>' : ''}</button>`;
  }
  const from = new Date(y, m, 1), to = new Date(y, m + 1, 0, 23, 59, 59);
  const md = medDays(from, to);
  const hd = headacheDays(from, to);
  let list = attacksBetween(from, to);
  if (calDay) list = list.filter(a => attackDays(a).includes(calDay));
  list.sort(byNewest);
  const isCurrent = y === new Date().getFullYear() && m === new Date().getMonth();
  const dayLabel = calDay ? new Date(calDay + 'T12:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }) : '';

  return `
    <div class="card cal">
      <div class="cal-head">
        <button class="icon-btn" data-act="calprev" aria-label="Vorheriger Monat">‹</button>
        <h2>${MONTHS[m]} ${y}</h2>
        <button class="icon-btn" data-act="calnext" aria-label="Nächster Monat" ${isCurrent ? 'disabled' : ''}>›</button>
      </div>
      <div class="cal-grid cal-wd" aria-hidden="true">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(w => `<span>${w}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
      <div class="cal-sum">
        <span><b>${hd}</b> ${plural(hd, 'Kopfschmerztag', 'Kopfschmerztage')}</span>
        <span><b>${md.acute}</b> ${plural(md.acute, 'Tag', 'Tage')} mit Akutmittel</span>
      </div>
      <p class="small muted cal-legend"><i class="aura-dot"></i> mit Aura · Farbe zeigt die Stärke · Tag antippen für Details</p>
    </div>

    <div class="row list-head">
      <h3>${calDay ? esc(dayLabel) : `Einträge im ${MONTHS[m]}`}</h3>
      ${calDay ? '<button class="btn ghost" data-act="calall">Ganzer Monat</button>' : ''}
    </div>
    <div class="list">${list.length ? list.map(entryHTML).join('')
      : `<p class="muted small empty-small">${calDay ? 'An diesem Tag ist nichts eingetragen.' : 'In diesem Monat ist nichts eingetragen.'}</p>`}</div>
    ${calDay && calDay > today ? '' : `<button class="btn primary block" data-act="new" ${calDay ? `data-day="${calDay}"` : ''}>+ ${calDay ? 'Attacke für diesen Tag eintragen' : 'Attacke eintragen'}</button>`}
  `;
}

/* ---------- Ansicht: Auswertung ---------- */

function countBy(list) {
  const c = {};
  list.forEach(x => { c[x] = (c[x] || 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}

function barsHTML(entries, total, max = 8) {
  if (!entries.length) return '<p class="muted small">Noch keine Daten.</p>';
  const top = entries.slice(0, max);
  const m = Math.max(...top.map(e => e[1]));
  return `<div class="bars">${top.map(([k, n]) => `
    <div class="bar"><span>${esc(k)}</span>
      <span class="track"><span class="fill" style="width:${(n / m) * 100}%"></span></span>
      <span class="n">${total ? Math.round((n / total) * 100) + '%' : n}</span></div>`).join('')}</div>`;
}

function viewStats() {
  const reportCard = `<div class="card">
      <h3>Für den Arzttermin</h3>
      <p class="small muted">Kopfschmerzkalender mit allen Attacken, Medikamenten und Auffälligkeiten – zum Drucken, als PDF oder zum Teilen.</p>
      <button class="btn primary" data-act="report">Arztbericht erstellen</button>
    </div>`;
  const A = state.attacks.filter(a => a.end || a.intensity);
  if (A.length < 2) {
    return `${reportCard}<div class="empty"><span class="ico">◔</span>Ab zwei Einträgen zeigt dir die App hier,<br>welche Muster es gibt.</div>`;
  }
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59);
    months.push({ label: MONTHS[from.getMonth()].slice(0, 3), n: headacheDays(from, to) });
  }
  const mMax = Math.max(1, ...months.map(m => m.n));

  const total = A.length;
  const withInt = A.filter(a => a.intensity);
  const avg = withInt.length ? (withInt.reduce((s, a) => s + a.intensity, 0) / withInt.length).toFixed(1).replace('.', ',') : '–';
  const durs = A.filter(a => a.end).map(a => (new Date(a.end) - new Date(a.start)) / 3600000);
  const avgDur = durs.length ? (durs.reduce((s, x) => s + x, 0) / durs.length).toFixed(1).replace('.', ',') : '–';
  const auraN = A.filter(hasAura).length;
  const noAuraN = A.filter(a => a.aura === false).length;

  const triggers = countBy(A.flatMap(a => a.triggers || []));
  const symptoms = countBy(A.flatMap(a => a.symptoms || []));
  const weekdays = WEEKDAYS.map((w, i) => [w, A.filter(a => new Date(a.start).getDay() === i).length]);
  const wdOrdered = [...weekdays.slice(1), weekdays[0]];
  const wdMax = Math.max(1, ...wdOrdered.map(w => w[1]));
  const tod = [['Nacht (0–6)', 0], ['Morgen (6–12)', 0], ['Nachmittag (12–18)', 0], ['Abend (18–24)', 0]];
  A.forEach(a => { tod[Math.floor(new Date(a.start).getHours() / 6)][1]++; });
  const imp = countBy(A.filter(a => a.impairment !== null && a.impairment !== undefined).map(a => IMPAIRMENT[a.impairment]));

  const W = A.filter(a => a.weather && a.weather.change24 !== null);
  let weatherCard = '';
  if (W.length) {
    const falling = W.filter(a => a.weather.change24 <= -3).length;
    const rising = W.filter(a => a.weather.change24 >= 3).length;
    weatherCard = `<div class="card"><h3>Luftdruck bei Beginn</h3>
      ${barsHTML([['Stark fallend', falling], ['Stabil', W.length - falling - rising], ['Stark steigend', rising]], W.length)}
      <p class="small muted">„Stark“ = mehr als 3 hPa Änderung in 24 Std. Basis: ${W.length} Attacken mit Wetterdaten.</p></div>`;
  }

  const eff = {};
  A.forEach(a => (a.meds || []).forEach(m => {
    if (m.effect === null || m.effect === undefined) return;
    const n = medName(m);
    (eff[n] = eff[n] || []).push(m.effect);
  }));
  const effRows = Object.entries(eff).map(([n, v]) => {
    const av = v.reduce((s, x) => s + x, 0) / v.length;
    return `<div class="bar"><span>${esc(n)}</span>
      <span class="track"><span class="fill" style="width:${(av / 3) * 100}%;background:var(--ok)"></span></span>
      <span class="n">${v.length}×</span></div>`;
  }).join('');

  return `
    ${reportCard}
    <div class="card">
      <h3>Kopfschmerztage pro Monat</h3>
      <div class="cols">${months.map(m => `<div class="col"><span class="v">${m.n}</span>
        <span class="b" style="height:${(m.n / mMax) * 100}px"></span><span>${m.label}</span></div>`).join('')}</div>
    </div>
    <div class="card">
      <div class="grid2">
        <div class="stat"><b>${total}</b><span>Attacken gesamt</span></div>
        <div class="stat"><b>${auraN} / ${noAuraN}</b><span>mit / ohne Aura</span></div>
        <div class="stat"><b>${avg}</b><span>Ø Stärke (1–10)</span></div>
        <div class="stat"><b>${avgDur}</b><span>Ø Dauer (Std)</span></div>
      </div>
    </div>
    <div class="card"><h3>Häufigste Auslöser</h3>${barsHTML(triggers, total)}
      <p class="small muted">Anteil der Attacken, bei denen der Auslöser notiert wurde.</p></div>
    ${weatherCard}
    ${imp.length ? `<div class="card"><h3>Einschränkung im Alltag</h3>${barsHTML(imp, total)}</div>` : ''}
    <div class="card"><h3>Wochentage</h3>
      <div class="cols">${wdOrdered.map(([w, n]) => `<div class="col"><span class="v">${n}</span>
        <span class="b" style="height:${(n / wdMax) * 100}px"></span><span>${w}</span></div>`).join('')}</div></div>
    <div class="card"><h3>Tageszeit des Beginns</h3>${barsHTML(tod.filter(t => t[1]), total)}</div>
    <div class="card"><h3>Begleitsymptome</h3>${barsHTML(symptoms, total)}</div>
    ${effRows ? `<div class="card"><h3>Wirkung der Medikamente</h3><div class="bars">${effRows}</div>
      <p class="small muted">Balken = durchschnittliche Wirkung (voll = sehr gut).</p></div>` : ''}
  `;
}

/* ---------- Ansicht: Einstellungen ---------- */

function viewSettings() {
  const meds = state.meds.map(m => `
    <button class="entry entry-plain" data-act="editmed" data-id="${m.id}">
      <span class="entry-main"><span class="t">${esc(m.name)}</span><span class="s">${MED_TYPES[m.type]}${m.since ? ' · seit ' + new Date(m.since).toLocaleDateString('de-DE') : ''}</span></span>
      <span class="muted">›</span></button>`).join('');
  const lb = state.settings.lastBackup ? new Date(state.settings.lastBackup).toLocaleDateString('de-DE') : 'noch nie';
  return `
    <div class="card">
      <h3>Über dich</h3>
      <div class="field"><label for="set-name">Dein Vorname (für die Begrüßung und den Arztbericht)</label>
        <input type="text" id="set-name" value="${esc(state.settings.name)}" placeholder="Vorname" autocomplete="given-name" maxlength="60"></div>
    </div>

    <div class="card">
      <div class="row"><h3>Meine Medikamente</h3><button class="btn ghost" data-act="newmed">+ Hinzufügen</button></div>
      <div class="list">${meds || '<p class="muted small">Noch keine. Beim Eintragen einer Attacke kannst du Mittel direkt aus einer Liste wählen – sie erscheinen dann hier.</p>'}</div>
    </div>

    <div class="card">
      <h3>Datenschutz & Sicherheit</h3>
      <div class="set-row">
        <span><b>PIN-Schutz</b><br><span class="small muted">${vault ? 'An – Daten sind verschlüsselt gespeichert' : 'Aus'}</span></span>
        <button class="btn" data-act="${vault ? 'pinoff' : 'pinon'}">${vault ? 'Ausschalten' : 'Einrichten'}</button>
      </div>
      ${vault ? '<button class="btn block" data-act="locknow">Jetzt sperren</button>' : ''}
      <div class="set-row">
        <span><b>Luftdruck speichern</b><br><span class="small muted">Sendet nur den ungefähren Ort (ca. 1 km) und das Datum an Open-Meteo</span></span>
        <button class="switch" role="switch" data-act="toggleweather" aria-checked="${state.settings.weather}" aria-label="Luftdruck speichern"><span></span></button>
      </div>
      <details class="fold">
        <summary><span>So sind deine Daten geschützt</span></summary>
        <ul class="small privacy">
          <li>Alle Einträge liegen <b>nur auf diesem Handy</b>. Es gibt kein Konto, keinen Server, keine Werbung und kein Tracking.</li>
          <li>Die App lädt keinen Code von fremden Servern. Das ist technisch festgeschrieben (Content Security Policy).</li>
          <li>Einzige Verbindung nach außen: der Wetterabruf, wenn eingeschaltet – ohne Namen und ohne Gesundheitsdaten.</li>
          <li>Mit PIN-Schutz werden alle Daten mit AES-256 verschlüsselt. Nach 5 Minuten im Hintergrund sperrt sich die App wieder.</li>
          <li>Backups sind immer mit einem Passwort verschlüsselt.</li>
          <li>Der Arztbericht verlässt das Handy nur, wenn du ihn selbst teilst.</li>
        </ul>
      </details>
    </div>

    <div class="card">
      <h3>Backup</h3>
      <p class="small muted">Deine Daten gibt es nur auf diesem Handy. Sichere sie regelmäßig, z. B. in „Dateien“ → iCloud Drive. Das Backup wird mit einem Passwort verschlüsselt. Letztes Backup: <b>${lb}</b>.</p>
      <div class="grid2">
        <button class="btn" data-act="backup">Sichern</button>
        <button class="btn" data-act="restore">Wiederherstellen</button>
      </div>
      <input type="file" id="restore-file" accept=".json,application/json" hidden>
    </div>

    <div class="card">
      <h3>Hinweise</h3>
      <p class="small muted">Diese App ersetzt keine ärztliche Beratung. Die Warnungen zum Medikamentengebrauch orientieren sich an den Kriterien der Internationalen Kopfschmerzgesellschaft (Triptane ≥ 10, einfache Schmerzmittel ≥ 15 Tage/Monat).</p>
      <button class="btn danger" data-act="wipe">Alle Daten löschen</button>
    </div>
  `;
}

/* ---------- Formular: Attacke ---------- */

let draft = null;

function openAttack(id, focusMeds, day) {
  const existing = state.attacks.find(a => a.id === id);
  if (existing) {
    draft = JSON.parse(JSON.stringify(existing));
  } else {
    let start = new Date();
    if (day && day !== dayKey(start)) start = new Date(day + 'T12:00');
    draft = {
      id: uid(), start: start.toISOString(), end: start.toISOString(), aura: null, intensity: 0, impairment: null,
      locations: [], symptoms: [], triggers: [], meds: [], notes: '', weather: null
    };
  }
  draft._new = !existing;
  draft._open = {};
  renderAttackSheet();
  if (focusMeds) setTimeout(() => $('#meds-anchor')?.scrollIntoView({ behavior: 'smooth' }), 50);
}

function chipsHTML(group, options, selected) {
  const extra = selected.filter(s => !options.includes(s));
  return `<div class="chips" data-group="${group}">${[...options, ...extra].map(o =>
    `<button type="button" class="chip" aria-pressed="${selected.includes(o)}" data-val="${esc(o)}">${esc(o)}</button>`).join('')}
    <button type="button" class="chip chip-add" data-addchip="${group}">+ Eigenes</button></div>`;
}

function renderAttackSheet() {
  const d = draft;
  const running = !d.end;
  const medOpts = state.meds.filter(m => m.type !== 'prophylaxe');
  const sheet = $('#sheet');
  const scroll = sheet.hidden ? 0 : sheet.scrollTop;
  sheet.innerHTML = `<div class="sheet-inner">
    <div class="sheet-head"><h2>${d._new ? 'Attacke eintragen' : 'Attacke bearbeiten'}</h2>
      <button class="btn ghost" data-act="close">Abbrechen</button></div>

    <section class="form-sec">
      <span class="lbl">Aura <span class="muted">(z. B. Flimmern, Sehstörungen, Kribbeln vor dem Schmerz)</span></span>
      <div class="seg">
        <button type="button" data-aura="1" aria-pressed="${d.aura === true}">Mit Aura</button>
        <button type="button" data-aura="0" aria-pressed="${d.aura === false}">Ohne Aura</button>
      </div>
    </section>

    <section class="form-sec">
      <span class="lbl">Beschwerden</span>${chipsHTML('symptoms', SYMPTOMS, d.symptoms)}
    </section>

    <section class="form-sec">
      <span class="lbl">Stärke</span>
      ${painSliderHTML(d.intensity)}
      <span class="lbl">Wie sehr schränkt es dich ein?</span>
      <div class="effect">${IMPAIRMENT.map((t, i) => `<button type="button" data-imp="${i}" aria-pressed="${d.impairment === i}">${t}</button>`).join('')}</div>
    </section>

    <section class="form-sec">
      <div class="grid2 time-grid">
        <div class="field"><label for="f-start">Beginn</label>
          <input type="datetime-local" id="f-start" value="${toLocalInput(d.start)}"></div>
        <div class="field"><label for="f-end">Ende</label>
          <input type="datetime-local" id="f-end" value="${d.end ? toLocalInput(d.end) : ''}" ${running ? 'hidden' : ''}>
          ${running ? '<span class="running-note">läuft noch</span>' : ''}</div>
      </div>
      <div class="chips"><button type="button" class="chip" id="f-running" aria-pressed="${running}">Attacke läuft noch</button></div>
    </section>

    <section class="form-sec" id="meds-anchor">
      <span class="lbl">Medikamente</span>
      ${d.meds.length ? `<div class="list">${d.meds.map((m, i) => `
        <div class="med-row">
          <div class="row"><b>${esc(medName(m))}</b><button type="button" class="btn ghost" data-delmed="${i}">Entfernen</button></div>
          <label class="small muted" for="mt-${i}">Eingenommen um</label>
          <input type="datetime-local" id="mt-${i}" data-medtime="${i}" value="${toLocalInput(m.time)}">
          <span class="small muted">Wie gut hat es geholfen?</span>
          <div class="effect">${EFFECTS.map((e, j) => `<button type="button" data-medeff="${i}" data-v="${j}" aria-pressed="${m.effect === j}">${e}</button>`).join('')}</div>
        </div>`).join('')}</div>` : ''}
      ${addMedSelectHTML(medOpts)}
    </section>

    <details class="fold" data-fold="where" ${d._open.where ? 'open' : ''}>
      <summary><span>Wo sitzt der Schmerz?</span><span class="fold-info" id="fold-locations">${d.locations.length ? esc(d.locations.join(', ')) : ''}</span></summary>
      ${chipsHTML('locations', LOCATIONS, d.locations)}
    </details>

    <details class="fold" data-fold="triggers" ${d._open.triggers ? 'open' : ''}>
      <summary><span>Mögliche Auslöser</span><span class="fold-info" id="fold-triggers">${d.triggers.length ? d.triggers.length + ' gewählt' : ''}</span></summary>
      ${chipsHTML('triggers', TRIGGERS, d.triggers)}
    </details>

    <details class="fold" data-fold="extra" ${d._open.extra ? 'open' : ''}>
      <summary><span>Wetter & Notizen</span><span class="fold-info">${d.notes ? 'Notiz vorhanden' : ''}</span></summary>
      <div class="field"><span class="lbl">Wetter beim Beginn</span>
        <div id="f-weather">${weatherHTML(d.weather)}</div>
        ${state.settings.weather ? '<button type="button" class="btn ghost" data-act="loadweather" style="justify-self:start">Wetter jetzt laden</button>' : ''}</div>
      <div class="field"><label for="f-notes">Notizen</label>
        <textarea id="f-notes" maxlength="4000" placeholder="Was war heute anders? Was hat geholfen?">${esc(d.notes)}</textarea></div>
    </details>

    ${!d._new ? '<button type="button" class="btn danger" data-act="delete">Eintrag löschen</button>' : ''}
  </div>
  <div class="sheet-foot"><button class="btn primary" data-act="saveattack">Speichern</button></div>`;
  sheet.hidden = false;
  sheet.scrollTop = scroll;
  document.body.style.overflow = 'hidden';
}

// Auswahl beim Eintragen: eigene Mittel zuerst, dann alle gängigen Akutmittel
function addMedSelectHTML(own, selId = 'f-addmed') {
  const have = new Set(state.meds.map(m => m.name.toLowerCase()));
  const groups = ['triptan', 'analgetikum', 'antiemetikum', 'sonstiges'].map(type => {
    const opts = MED_SUGGESTIONS[type].filter(n => !have.has(n.toLowerCase()))
      .map(n => `<option value="sugg:${type}:${esc(n)}">${esc(n)}</option>`).join('');
    return opts ? `<optgroup label="${SUGG_GROUPS[type]}">${opts}</optgroup>` : '';
  }).join('');
  return `<select id="${selId}" aria-label="Medikament hinzufügen"><option value="">${selId === 'f-addmed' ? '+ Medikament hinzufügen …' : 'Anderes Mittel wählen …'}</option>
    ${own.length ? `<optgroup label="Meine Medikamente">${own.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</optgroup>` : ''}
    ${groups}
    <optgroup label="Nicht dabei?"><option value="__new">Anderes Medikament anlegen …</option></optgroup></select>`;
}

function readAttackForm() {
  const start = $('#f-start').value;
  if (start) draft.start = new Date(start).toISOString();
  const running = $('#f-running').getAttribute('aria-pressed') === 'true';
  const end = $('#f-end').value;
  draft.end = running ? null : (end ? new Date(end).toISOString() : new Date().toISOString());
  draft.notes = $('#f-notes').value.trim().slice(0, 4000);
  $$('[data-medtime]').forEach(inp => {
    const i = +inp.dataset.medtime;
    if (inp.value) draft.meds[i].time = new Date(inp.value).toISOString();
  });
}

function saveAttack() {
  readAttackForm();
  if (draft.end && new Date(draft.end) < new Date(draft.start)) { toast('Das Ende liegt vor dem Beginn.'); return; }
  if (new Date(draft.start) > new Date(Date.now() + 5 * 60000)) { toast('Der Beginn liegt in der Zukunft.'); return; }
  if (!draft.end && state.attacks.some(a => !a.end && a.id !== draft.id)) {
    toast('Es läuft schon eine andere Attacke.'); return;
  }
  const { _new, _open, ...clean } = draft;
  const idx = state.attacks.findIndex(a => a.id === clean.id);
  const startHour = `${dayKey(clean.start)}T${pad(new Date(clean.start).getHours())}:00`;
  const needWeather = !clean.weather || clean.weather.for !== startHour;
  if (idx >= 0) state.attacks[idx] = clean; else state.attacks.push(clean);
  save();
  closeSheet();
  toast('Gespeichert');
  if (needWeather) attachWeather(clean, true);
}

function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheet').innerHTML = '';
  document.body.style.overflow = '';
  draft = null;
  render();
}

/* ---------- Geführte Erfassung (eine Frage pro Bildschirm) ---------- */

const FLOWS = {
  start: ['aura', 'pain', 'meds', 'symptoms'],     // beim Start einer Attacke
  end: ['impairment', 'where', 'triggers', 'notes'], // beim Beenden, wenn ergänzt werden soll
  meds: ['meds']                                     // nur Medikament nachtragen
};
let flow = null;   // { id, kind, step, more }

function flowAttack() { return flow && state.attacks.find(a => a.id === flow.id); }

function openFlow(id, kind) {
  flow = { id, kind, step: 0, more: false };
  renderFlow();
}

function flowChips(group, options, a) {
  const extra = (a[group] || []).filter(x => !options.includes(x));
  return `<div class="chips flow-chips">${[...options, ...extra].map(o =>
    `<button type="button" class="chip" data-fchip="${group}" data-val="${esc(o)}" aria-pressed="${(a[group] || []).includes(o)}">${esc(o)}</button>`).join('')}</div>`;
}

function flowStep(a, key) {
  const own = state.meds.filter(m => m.type !== 'prophylaxe');
  const taken = new Set(a.meds.map(m => m.medId));
  switch (key) {
    case 'aura': return {
      q: 'Hast du eine Aura?', sub: 'Zum Beispiel Flimmern, Zickzack-Linien, Sehstörungen oder Kribbeln vor oder während des Schmerzes.',
      body: `<div class="flow-choices">
        <button class="choice" data-fset="aura" data-v="1" aria-pressed="${a.aura === true}">Ja, mit Aura</button>
        <button class="choice" data-fset="aura" data-v="0" aria-pressed="${a.aura === false}">Nein, ohne Aura</button>
        <button class="choice" data-fset="aura" data-v="" aria-pressed="false">Weiß ich noch nicht</button></div>`
    };
    case 'pain': return {
      q: 'Wie stark ist der Schmerz?', sub: '',
      body: painSliderHTML(a.intensity),
      next: 'Weiter'
    };
    case 'meds': return {
      q: 'Hast du schon etwas genommen?', sub: own.length ? 'Antippen zum Auswählen – mehrere sind möglich.' : 'Wähle dein Mittel aus der Liste.',
      body: `${own.length ? `<div class="flow-choices">${own.map(m =>
          `<button class="choice" data-fmed="${m.id}" aria-pressed="${taken.has(m.id)}">${esc(m.name)}</button>`).join('')}</div>` : ''}
        ${addMedSelectHTML([], 'flow-addmed')}
        ${a.meds.length ? `<p class="small muted">Gewählt: ${esc(a.meds.map(medName).join(', '))}</p>` : ''}`,
      next: flow.kind === 'meds' ? 'Fertig' : a.meds.length ? 'Weiter' : 'Nein, noch nichts genommen'
    };
    case 'symptoms': {
      const rest = SYMPTOMS.filter(x => !CORE_SYMPTOMS.includes(x));
      const showMore = flow.more || a.symptoms.some(x => rest.includes(x));
      return {
        q: 'Welche Beschwerden hast du?', sub: 'Alles antippen, was passt.',
        body: `${flowChips('symptoms', CORE_SYMPTOMS, { symptoms: a.symptoms.filter(x => CORE_SYMPTOMS.includes(x)) })}
          ${showMore ? flowChips('symptoms', rest, { symptoms: a.symptoms.filter(x => !CORE_SYMPTOMS.includes(x)) })
            : '<button class="btn ghost" data-fmore="1">Weitere Beschwerden anzeigen</button>'}`,
        next: 'Fertig'
      };
    }
    case 'impairment': return {
      q: 'Wie sehr hat dich die Attacke eingeschränkt?', sub: 'Im Alltag, bei der Arbeit oder in der Freizeit.',
      body: `<div class="flow-choices">${IMPAIRMENT.map((t, i) =>
        `<button class="choice" data-fset="impairment" data-v="${i}" aria-pressed="${a.impairment === i}">${t}</button>`).join('')}</div>`
    };
    case 'where': return {
      q: 'Wo saß der Schmerz?', sub: 'Mehrere Antworten möglich.',
      body: flowChips('locations', LOCATIONS, a),
      next: 'Weiter'
    };
    case 'triggers': return {
      q: 'Gab es mögliche Auslöser?', sub: 'Mehrere Antworten möglich – oder einfach weiter.',
      body: flowChips('triggers', TRIGGERS, a),
      next: 'Weiter'
    };
    case 'notes': return {
      q: 'Möchtest du noch etwas notieren?', sub: 'Zum Beispiel, was geholfen hat.',
      body: `<textarea id="flow-notes" maxlength="4000" placeholder="Notiz (freiwillig)">${esc(a.notes)}</textarea>`,
      next: 'Fertig'
    };
  }
  return null;
}

function renderFlow() {
  const a = flowAttack();
  if (!a) { closeSheet(); return; }
  const steps = FLOWS[flow.kind];
  const sheet = $('#sheet');
  if (flow.step >= steps.length) {
    // Abschluss
    const done = flow.kind === 'start';
    sheet.innerHTML = `<div class="sheet-inner flow flow-done">
      <svg class="done-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>
      <h2>${done ? 'Gespeichert. Gute Besserung.' : 'Alles gespeichert.'}</h2>
      <p class="muted">${done ? 'Ruh dich aus. Wenn die Attacke vorbei ist, tippe auf der Startseite auf „Attacke beenden“.' : 'Gute Erholung!'}</p>
      <div class="flow-summary">
        <span>Aura: <b>${auraText(a)}</b></span>
        <span>Stärke: <b>${a.intensity || '–'}</b></span>
        ${a.meds.length ? `<span>Medikamente: <b>${esc(a.meds.map(medName).join(', '))}</b></span>` : ''}
        ${a.symptoms.length ? `<span>Beschwerden: <b>${esc(a.symptoms.join(', '))}</b></span>` : ''}
        ${a.impairment !== null ? `<span>Einschränkung: <b>${IMPAIRMENT[a.impairment]}</b></span>` : ''}
      </div>
      <button class="btn primary block" data-flow="close">Schließen</button>
      <button class="btn ghost" data-flow="full">Alles ansehen und bearbeiten</button>
    </div>`;
    sheet.hidden = false;
    return;
  }
  const st = flowStep(a, steps[flow.step]);
  const multi = steps.length > 1;
  sheet.innerHTML = `<div class="sheet-inner flow">
    <div class="flow-head">
      ${flow.step > 0 ? '<button class="btn ghost" data-flow="back">‹ Zurück</button>' : '<span></span>'}
      ${multi ? `<span class="flow-count">Schritt ${flow.step + 1} von ${steps.length}</span>` : '<span></span>'}
      <button class="icon-btn" data-flow="close" aria-label="Schließen – Eingaben sind gespeichert">✕</button>
    </div>
    ${multi ? `<div class="flow-dots" aria-hidden="true">${steps.map((_, i) => `<i class="${i <= flow.step ? 'on' : ''}"></i>`).join('')}</div>` : ''}
    <h2 class="flow-q">${st.q}</h2>
    ${st.sub ? `<p class="muted">${st.sub}</p>` : ''}
    ${st.body}
  </div>
  <div class="sheet-foot">
    ${st.next ? `<button class="btn primary" data-flow="next">${st.next}</button>` : '<button class="btn" data-flow="next">Überspringen</button>'}
  </div>`;
  sheet.hidden = false;
  sheet.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}

function flowNext() {
  const a = flowAttack();
  const note = $('#flow-notes');
  if (a && note) { a.notes = note.value.trim().slice(0, 4000); save(); }
  flow.step++;
  flow.more = false;
  if (flow.kind === 'meds' && flow.step >= FLOWS.meds.length) { const f = flow; flow = null; closeSheet(); if (f) toast('Gespeichert'); return; }
  renderFlow();
}

function flowClick(t) {
  const a = flowAttack();
  if (!a) return false;
  if (t.dataset.fset) {
    const k = t.dataset.fset, v = t.dataset.v;
    if (k === 'aura') a.aura = v === '' ? null : v === '1';
    else a[k] = +v;
    save();
    $$(`[data-fset="${k}"]`).forEach(b => b.setAttribute('aria-pressed', b === t && v !== ''));
    setTimeout(flowNext, 180);   // kurze Rückmeldung, dann automatisch weiter
    return true;
  }
  if (t.dataset.fchip) {
    const g = t.dataset.fchip, v = t.dataset.val;
    const on = !a[g].includes(v);
    a[g] = on ? [...a[g], v] : a[g].filter(x => x !== v);
    t.setAttribute('aria-pressed', on);
    save();
    return true;
  }
  if (t.dataset.fmed) {
    const i = a.meds.findIndex(m => m.medId === t.dataset.fmed);
    if (i >= 0) a.meds.splice(i, 1); else a.meds.push({ medId: t.dataset.fmed, time: new Date().toISOString(), effect: null });
    save(); renderFlow();
    return true;
  }
  if (t.dataset.fmore) { flow.more = true; renderFlow(); return true; }
  switch (t.dataset.flow) {
    case 'next': flowNext(); return true;
    case 'back': flow.step = Math.max(0, flow.step - 1); renderFlow(); return true;
    case 'close': {
      const note = $('#flow-notes');
      if (note) { a.notes = note.value.trim().slice(0, 4000); save(); }
      flow = null; closeSheet(); return true;
    }
    case 'full': flow = null; $('#sheet').hidden = true; openAttack(a.id); return true;
  }
  return false;
}

/* ---------- Vergessene Attacken abfangen ----------
   Läuft eine Attacke seit über 24 Std. (bzw. 24 Std. seit der letzten Bestätigung),
   fragt die App beim Öffnen nach. Nichts wird ohne Rückfrage automatisch beendet. */

let stale = null;   // { id, step: 'ask' | 'when' }

function fmtSpan(ms) {
  const h = Math.floor(ms / 3600000);
  if (h < 24) return `${h} ${plural(h, 'Stunde', 'Stunden')}`;
  const d = Math.floor(h / 24), r = h % 24;
  return `${d} ${plural(d, 'Tag', 'Tagen')}${r ? ` ${r} Std.` : ''}`;
}

function checkStale() {
  if (stale || flow || draft || !$('#sheet').hidden || $('.dlg-wrap') || $('.lock') || !$('#report').hidden) return;
  const a = activeAttack();
  if (!a) return;
  const since = new Date(a.checkedAt || a.start).getTime();
  if (Date.now() - since < STALE_MS) return;
  stale = { id: a.id, step: 'ask' };
  renderStale();
}

function renderStale() {
  const a = state.attacks.find(x => x.id === stale.id);
  if (!a) { stale = null; closeSheet(); return; }
  const startMs = new Date(a.start).getTime();
  const sheet = $('#sheet');
  if (stale.step === 'ask') {
    sheet.innerHTML = `<div class="sheet-inner flow">
      <h2 class="flow-q">Läuft deine Attacke noch?</h2>
      <p class="muted">Begonnen ${fmtDateTime(a.start)} – das ist ${fmtSpan(Date.now() - startMs)} her. Vielleicht wurde vergessen, sie zu beenden.</p>
      <div class="flow-choices">
        <button class="choice" data-stale="over">Nein, ist schon vorbei</button>
        <button class="choice" data-stale="still">Ja, sie läuft noch</button>
      </div>
    </div>`;
  } else {
    // Vorschläge: typische Dauern ab Beginn, nur wenn sie schon in der Vergangenheit liegen
    const opts = [[2, '2 Std.'], [4, '4 Std.'], [8, '8 Std.'], [12, '12 Std.'], [24, '1 Tag'], [48, '2 Tage'], [72, '3 Tage']]
      .map(([h, label]) => ({ t: startMs + h * 3600000, label }))
      .filter(o => o.t < Date.now() - 30 * 60000);
    sheet.innerHTML = `<div class="sheet-inner flow">
      <div class="flow-head"><button class="btn ghost" data-stale="back">‹ Zurück</button><span></span><span></span></div>
      <h2 class="flow-q">Wann ungefähr war sie vorbei?</h2>
      <p class="muted">Begonnen ${fmtDateTime(a.start)}. Wie lange hat sie ungefähr gedauert?</p>
      <div class="flow-choices stale-grid">${opts.map(o =>
        `<button class="choice" data-stale="end" data-t="${o.t}">${o.label}<small>bis ${fmtDate(o.t)}, ${fmtTime(o.t)}</small></button>`).join('')}</div>
      <div class="field"><label for="stale-end">Oder genaue Zeit</label>
        <input type="datetime-local" id="stale-end" min="${toLocalInput(a.start)}" max="${toLocalInput(new Date())}" value="${toLocalInput(new Date(Math.min(Date.now(), startMs + 4 * 3600000)))}"></div>
      <button class="btn block" data-stale="endexact">Diese Zeit übernehmen</button>
    </div>`;
  }
  sheet.hidden = false;
  sheet.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}

function finishStale(a, endMs) {
  const end = Math.min(Math.max(endMs, new Date(a.start).getTime()), Date.now());
  a.end = new Date(end).toISOString();
  a.checkedAt = null;
  save();
  stale = null;
  $('#sheet').hidden = true; $('#sheet').innerHTML = '';
  render();
  dialog(`Gespeichert: Dauer ${fmtDuration(a)}. Möchtest du noch etwas ergänzen – Einschränkung, Schmerzort, Auslöser, Notiz?`, { okText: 'Ja, ergänzen', cancelText: 'Nein, fertig' })
    .then(more => { if (more) openFlow(a.id, 'end'); else { document.body.style.overflow = ''; toast('Alles gespeichert'); } });
}

function staleClick(t) {
  const a = state.attacks.find(x => x.id === stale.id);
  if (!a) { stale = null; closeSheet(); return true; }
  switch (t.dataset.stale) {
    case 'still': {
      a.checkedAt = new Date().toISOString();
      save();
      stale = null;
      closeSheet();
      if (Date.now() - new Date(a.start).getTime() > LONG_MS) {
        dialog('Deine Attacke läuft seit über 72 Stunden. Eine so lange Migräne (Status migränosus) sollte ärztlich abgeklärt werden – bitte melde dich bei deiner Ärztin oder deinem Arzt oder beim ärztlichen Bereitschaftsdienst (116 117).', { okText: 'Verstanden', cancelText: 'Schließen' });
      } else toast('Okay – ich frage morgen noch einmal nach.');
      return true;
    }
    case 'over': stale.step = 'when'; renderStale(); return true;
    case 'back': stale.step = 'ask'; renderStale(); return true;
    case 'end': finishStale(a, +t.dataset.t); return true;
    case 'endexact': {
      const v = $('#stale-end').value;
      if (!v) { toast('Bitte eine Zeit wählen.'); return true; }
      const ms = new Date(v).getTime();
      if (ms < new Date(a.start).getTime()) { toast('Das Ende liegt vor dem Beginn.'); return true; }
      if (ms > Date.now()) { toast('Das Ende liegt in der Zukunft.'); return true; }
      finishStale(a, ms);
      return true;
    }
  }
  return false;
}

/* ---------- Formular: Medikament ---------- */

let medReturn = null;   // 'attack' | 'flow' – wohin nach dem Anlegen eines Medikaments

function openMed(id) {
  const m = state.meds.find(x => x.id === id) || { id: uid(), name: '', type: 'analgetikum', since: '' };
  const sheet = $('#sheet');
  sheet.innerHTML = `<div class="sheet-inner" data-medid="${m.id}">
    <div class="sheet-head"><h2>${id ? 'Medikament' : 'Medikament hinzufügen'}</h2>
      <button class="btn ghost" data-act="${medReturn ? 'backtoattack' : 'close'}">Abbrechen</button></div>
    ${id ? '' : suggestionsHTML()}
    <div class="field"><label for="m-name">Name und Dosis</label>
      <input type="text" id="m-name" value="${esc(m.name)}" placeholder="z. B. Sumatriptan 50 mg" maxlength="120"></div>
    <div class="field"><span class="lbl">Art</span>
      <div class="chips" id="m-type">${Object.entries(MED_TYPES).map(([k, v]) =>
        `<button type="button" class="chip" data-type="${k}" aria-pressed="${m.type === k}">${v}</button>`).join('')}</div></div>
    <div class="field" id="m-since-f" ${m.type === 'prophylaxe' ? '' : 'hidden'}><label for="m-since">Eingenommen seit</label>
      <input type="date" id="m-since" value="${m.since || ''}"></div>
    ${id ? `<button type="button" class="btn danger" data-act="delmedication" data-id="${m.id}">Medikament löschen</button>` : ''}
  </div>
  <div class="sheet-foot"><button class="btn primary" data-act="savemed">Speichern</button></div>`;
  sheet.hidden = false;
  sheet.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}

function suggestionsHTML() {
  const have = new Set(state.meds.map(m => m.name.toLowerCase()));
  const groups = Object.entries(MED_SUGGESTIONS).map(([type, names]) => {
    const chips = names.filter(n => !have.has(n.toLowerCase()))
      .map(n => `<button type="button" class="chip" data-sugg="${esc(n)}" data-type="${type}" aria-pressed="false">${esc(n)}</button>`).join('');
    return chips ? `<div class="sugg-group"><span class="lbl">${SUGG_GROUPS[type]}</span><div class="chips">${chips}</div></div>` : '';
  }).join('');
  return `<div class="field"><label for="m-search">Häufige Migränemittel</label>
    <input type="text" id="m-search" placeholder="Suchen, z. B. Suma …" autocomplete="off">
    <div id="m-sugg" class="sugg">${groups}</div>
    <p class="small muted">Antippen füllt Name und Art aus. Die Dosis bitte an die eigene Verordnung anpassen.</p></div>`;
}

function saveMed() {
  const id = $('.sheet-inner').dataset.medid;
  const name = $('#m-name').value.trim().slice(0, 120);
  if (!name) { toast('Bitte einen Namen eingeben.'); return; }
  const type = $('#m-type [aria-pressed=true]')?.dataset.type || 'sonstiges';
  const since = type === 'prophylaxe' ? $('#m-since').value : '';
  const existing = state.meds.find(x => x.id === id);
  if (existing) Object.assign(existing, { name, type, since });
  else state.meds.push({ id, name, type, since });
  save();
  if (medReturn === 'attack' && draft) {
    medReturn = null;
    if (type !== 'prophylaxe') draft.meds.push({ medId: id, time: new Date().toISOString(), effect: null });
    renderAttackSheet();
    return;
  }
  if (medReturn === 'flow' && flow) {
    medReturn = null;
    const a = flowAttack();
    if (a && type !== 'prophylaxe') { a.meds.push({ medId: id, time: new Date().toISOString(), effect: null }); save(); }
    renderFlow();
    return;
  }
  closeSheet();
  toast('Gespeichert');
}

/* ---------- PIN-Schutz ---------- */

async function pinOn() {
  const ok = await dialog('Mit PIN werden alle Daten verschlüsselt. Wichtig: Wer die PIN vergisst, kommt nicht mehr an die Daten – nur über ein Backup. Fortfahren?', { okText: 'Weiter' });
  if (!ok) return;
  const p1 = await dialog('Neue PIN eingeben (4–8 Ziffern, 6 sind sicherer):', { input: 'pin', okText: 'Weiter' });
  if (!p1) return;
  if (!/^\d{4,8}$/.test(p1)) { toast('Die PIN muss aus 4 bis 8 Ziffern bestehen.'); return; }
  const p2 = await dialog('PIN zur Bestätigung wiederholen:', { input: 'pin', okText: 'PIN festlegen' });
  if (p1 !== p2) { toast('Die PINs stimmen nicht überein.'); return; }
  toast('Verschlüssele …');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  vault = { key: await deriveKey(p1, salt, PBKDF2_ITER), salt, iter: PBKDF2_ITER };
  await save();
  render();
  toast('PIN-Schutz ist aktiv');
}

async function pinOff() {
  const p = await dialog('Aktuelle PIN eingeben, um den Schutz auszuschalten. Die Daten liegen danach unverschlüsselt auf dem Handy.', { input: 'pin', okText: 'Ausschalten', danger: true });
  if (!p) return;
  const stored = readStored();
  try {
    await openJSON(stored, await deriveKey(p, fromB64(stored.salt), iterOf(stored)));
  } catch (e) { toast('Falsche PIN'); return; }
  vault = null;
  await save();
  render();
  toast('PIN-Schutz ausgeschaltet');
}

// Sperren = Seite neu laden: entschlüsselte Daten verschwinden aus dem Speicher
function lockNow() { location.reload(); }

function showLock(stored) {
  const el = document.createElement('div');
  el.className = 'lock';
  el.innerHTML = `<form class="lock-inner" id="lock-form" autocomplete="off">
    <svg class="lock-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
    <h2>Tagebuch gesperrt</h2>
    <label for="lock-pin" class="muted">Gib deine PIN ein</label>
    <input type="password" id="lock-pin" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off">
    <p class="lock-msg" id="lock-msg" role="alert"></p>
    <button class="btn primary block" type="submit">Entsperren</button>
  </form>`;
  document.body.appendChild(el);
  setTimeout(() => $('#lock-pin').focus(), 50);
  let fails = 0, blockedUntil = 0;
  $('#lock-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#lock-msg');
    if (Date.now() < blockedUntil) { msg.textContent = 'Bitte kurz warten.'; return; }
    const pin = $('#lock-pin').value;
    if (!pin) return;
    msg.textContent = 'Prüfe …';
    try {
      const salt = fromB64(stored.salt), iter = iterOf(stored);
      const key = await deriveKey(pin, salt, iter);
      state = sanitizeState(await openJSON(stored, key));
      vault = { key, salt, iter };
      el.remove();
      start();
    } catch (err) {
      fails++;
      $('#lock-pin').value = '';
      if (fails >= 5) { blockedUntil = Date.now() + 30000; fails = 0; msg.textContent = 'Zu viele Versuche. Bitte 30 Sekunden warten.'; }
      else msg.textContent = 'Falsche PIN.';
    }
  });
}

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (vault && hiddenAt && Date.now() - hiddenAt > AUTOLOCK_MS) lockNow();
  else checkStale();
});

/* ---------- Backup (immer verschlüsselt) ---------- */

async function shareOrDownload(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const file = new File([blob], filename, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return true;
}

async function backup() {
  const pw = await dialog('Passwort für das Backup festlegen (mind. 6 Zeichen). Ohne dieses Passwort lässt sich das Backup nicht öffnen – bitte gut merken.', { input: 'password', okText: 'Weiter' });
  if (!pw) return;
  if (pw.length < 6) { toast('Das Passwort braucht mindestens 6 Zeichen.'); return; }
  const pw2 = await dialog('Passwort wiederholen:', { input: 'password', okText: 'Backup erstellen' });
  if (pw !== pw2) { toast('Die Passwörter stimmen nicht überein.'); return; }
  toast('Verschlüssele …');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const box = await sealJSON(state, await deriveKey(pw, salt, PBKDF2_ITER));
  const content = JSON.stringify({ app: 'migraene-tagebuch', format: 2, enc: 1, salt: toB64(salt), iter: PBKDF2_ITER, ...box });
  const ok = await shareOrDownload(`migraene-backup-${dayKey(new Date())}.json`, content, 'application/json');
  if (ok) { state.settings.lastBackup = new Date().toISOString(); save(); render(); toast('Verschlüsseltes Backup erstellt'); }
}

function restore(file) {
  if (file.size > 20 * 1024 * 1024) { toast('Die Datei ist zu groß für ein Backup.'); return; }
  const r = new FileReader();
  r.onload = async () => {
    let data;
    try { data = JSON.parse(r.result); } catch (e) { toast('Diese Datei ist kein gültiges Backup.'); return; }
    if (data && data.enc === 1) {
      const pw = await dialog('Passwort des Backups eingeben:', { input: 'password', okText: 'Öffnen' });
      if (!pw) return;
      try { data = await openJSON(data, await deriveKey(pw, fromB64(data.salt), iterOf(data))); }
      catch (e) { toast('Falsches Passwort oder beschädigte Datei.'); return; }
    }
    if (!data || !Array.isArray(data.attacks) || !Array.isArray(data.meds)) { toast('Diese Datei ist kein gültiges Backup.'); return; }
    const clean = sanitizeState(data);
    clean.settings.onboarded = true;
    const ok = await dialog(`Backup mit ${clean.attacks.length} Attacken laden? Die aktuellen Daten auf diesem Handy werden ersetzt.`, { okText: 'Laden' });
    if (!ok) return;
    state = clean;
    await save();
    render();
    toast('Backup wiederhergestellt');
  };
  r.readAsText(file);
}

/* ---------- Arztbericht ---------- */

let reportMonths = 3;

function buildReport() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth() - reportMonths + 1, 1);
  const list = attacksBetween(from, to).sort((a, b) => new Date(a.start) - new Date(b.start));
  const name = state.settings.name;

  const monthRows = [];
  for (let i = 0; i < reportMonths; i++) {
    const f = new Date(from.getFullYear(), from.getMonth() + i, 1);
    const t = new Date(f.getFullYear(), f.getMonth() + 1, 0, 23, 59);
    const md = medDays(f, t);
    const atts = attacksBetween(f, t);
    monthRows.push(`<tr><td>${MONTHS[f.getMonth()]} ${f.getFullYear()}</td><td>${headacheDays(f, t)}</td><td>${atts.length}</td>
      <td>${atts.filter(hasAura).length}</td><td>${md.triptan}</td><td>${md.analgetikum}</td></tr>`);
  }
  const ints = list.filter(a => a.intensity);
  const avg = ints.length ? (ints.reduce((s, a) => s + a.intensity, 0) / ints.length).toFixed(1).replace('.', ',') : '–';
  const durs = list.filter(a => a.end).map(a => (new Date(a.end) - new Date(a.start)) / 3600000);
  const avgDur = durs.length ? (durs.reduce((s, x) => s + x, 0) / durs.length).toFixed(1).replace('.', ',') : '–';
  const triggers = countBy(list.flatMap(a => a.triggers || [])).slice(0, 6);
  const proph = state.meds.filter(m => m.type === 'prophylaxe');
  const warns = overuseWarnings();
  const severe = list.filter(a => a.impairment >= 2).length;

  return `
    <div class="r-actions">
      <button class="btn primary" data-act="print">Drucken / als PDF</button>
      <button class="btn" data-act="sharereport">Teilen</button>
      <button class="btn" data-act="closereport">Schließen</button>
    </div>
    <div class="r-period"><label for="r-months">Zeitraum:</label>
      <select id="r-months">${[1, 3, 6, 12].map(n => `<option value="${n}" ${n === reportMonths ? 'selected' : ''}>${n === 1 ? 'Aktueller Monat' : `Letzte ${n} Monate`}</option>`).join('')}</select></div>
    <div id="r-body">
    <h1>Kopfschmerzkalender${name ? ` – ${esc(name)}` : ''}</h1>
    <p>Zeitraum: ${from.toLocaleDateString('de-DE')} – ${to.toLocaleDateString('de-DE')} · erstellt am ${to.toLocaleDateString('de-DE')}</p>

    <h2>Übersicht</h2>
    <div class="kv">
      <div><b>${headacheDays(from, to)}</b>Kopfschmerztage</div>
      <div><b>${list.length}</b>Attacken</div>
      <div><b>${list.filter(hasAura).length} / ${list.filter(a => a.aura === false).length}</b>mit / ohne Aura</div>
      <div><b>${avg}</b>Ø Stärke (1–10)</div>
      <div><b>${avgDur} h</b>Ø Dauer</div>
      <div><b>${severe}</b>stark eingeschränkt / bettlägerig</div>
    </div>
    ${warns.length ? `<div class="warnbox">⚠ Letzte 30 Tage: ${warns.join(' ')}</div>` : ''}

    <h2>Pro Monat</h2>
    <div class="tbl"><table><thead><tr><th>Monat</th><th>Kopfschmerztage</th><th>Attacken</th><th>davon mit Aura</th><th>Tage Triptan</th><th>Tage Schmerzmittel</th></tr></thead>
    <tbody>${monthRows.join('')}</tbody></table></div>

    ${proph.length ? `<h2>Prophylaxe</h2><ul>${proph.map(m => `<li>${esc(m.name)}${m.since ? ` (seit ${new Date(m.since).toLocaleDateString('de-DE')})` : ''}</li>`).join('')}</ul>` : ''}

    ${triggers.length ? `<h2>Häufigste Auslöser</h2><p>${triggers.map(([k, n]) => `${esc(k)} (${n}×)`).join(', ')}</p>` : ''}

    <h2>Alle Attacken</h2>
    ${list.length ? `<div class="tbl"><table><thead><tr><th>Beginn</th><th>Dauer</th><th>Stärke</th><th>Aura</th><th>Einschränkung</th><th>Symptome / Ort</th><th>Medikamente (Wirkung)</th><th>Auslöser / Notiz</th></tr></thead><tbody>
      ${list.map(a => `<tr>
        <td>${fmtDateTime(a.start)}</td>
        <td>${a.end ? fmtDuration(a) : 'läuft'}</td>
        <td>${a.intensity || '–'}</td>
        <td>${auraText(a)}</td>
        <td>${a.impairment !== null && a.impairment !== undefined ? IMPAIRMENT[a.impairment] : '–'}</td>
        <td>${esc([...(a.symptoms || []), ...(a.locations || [])].join(', '))}</td>
        <td>${(a.meds || []).map(m => `${esc(medName(m))} ${fmtTime(m.time)}${m.effect !== null && m.effect !== undefined ? ` (${EFFECTS[m.effect]})` : ''}`).join('<br>')}</td>
        <td>${esc((a.triggers || []).join(', '))}${a.notes ? `<br><i>${esc(a.notes)}</i>` : ''}${a.weather ? `<br>${a.weather.pressure} hPa${a.weather.change24 !== null ? ` (${a.weather.change24 > 0 ? '+' : ''}${a.weather.change24}/24h)` : ''}` : ''}</td>
      </tr>`).join('')}</tbody></table></div>` : '<p>Keine Attacken im Zeitraum.</p>'}
    </div>`;
}

function openReport() {
  const r = $('#report');
  r.innerHTML = buildReport();
  r.hidden = false;
  document.body.style.overflow = 'hidden';
}

function reportFileHTML() {
  const css = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch (e) { return ''; } }).join('\n');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
    <title>Kopfschmerzkalender</title><style>${css} body{padding:0;background:#fff}.report{position:static}</style></head>
    <body><div class="report">${$('#r-body').outerHTML}</div></body></html>`;
}

/* ---------- Ereignisse ---------- */

document.addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  const act = t.dataset.act;
  const id = t.dataset.id;

  // Nachfrage zu einer vergessenen Attacke
  if (stale && t.dataset.stale && staleClick(t)) return;

  // Geführte Erfassung
  if (flow && t.closest('#sheet') && !medReturn && flowClick(t)) return;

  // Formular-Interaktionen
  if (t.closest('#sheet') && draft) {
    if (t.dataset.aura !== undefined) {
      const v = t.dataset.aura === '1';
      draft.aura = draft.aura === v ? null : v;
      $$('[data-aura]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.aura === '1') === draft.aura && draft.aura !== null));
      return;
    }
    if (t.dataset.imp !== undefined) {
      const v = +t.dataset.imp;
      draft.impairment = draft.impairment === v ? null : v;
      $$('[data-imp]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.imp === draft.impairment));
      return;
    }
    if (t.parentElement.dataset.group && t.dataset.val !== undefined) {
      const g = t.parentElement.dataset.group, v = t.dataset.val;
      const on = t.getAttribute('aria-pressed') !== 'true';
      t.setAttribute('aria-pressed', on);
      draft[g] = on ? [...draft[g], v] : draft[g].filter(x => x !== v);
      if (g === 'triggers') $('#fold-triggers').textContent = draft.triggers.length ? draft.triggers.length + ' gewählt' : '';
      if (g === 'locations') $('#fold-locations').textContent = draft.locations.join(', ');
      return;
    }
    if (t.dataset.addchip) {
      readAttackForm();
      const g = t.dataset.addchip;
      dialog('Eigener Eintrag:', { input: 'text', okText: 'Hinzufügen' }).then(v => {
        if (v && draft) { if (!draft[g].includes(v)) draft[g].push(v.slice(0, 80)); renderAttackSheet(); }
      });
      return;
    }
    if (t.id === 'f-running') {
      readAttackForm();
      draft.end = draft.end ? null : new Date().toISOString();
      renderAttackSheet(); return;
    }
    if (t.dataset.medeff !== undefined) {
      readAttackForm();
      const m = draft.meds[+t.dataset.medeff], v = +t.dataset.v;
      m.effect = m.effect === v ? null : v;
      renderAttackSheet(); return;
    }
    if (t.dataset.delmed !== undefined) {
      readAttackForm(); draft.meds.splice(+t.dataset.delmed, 1); renderAttackSheet(); return;
    }
  }
  if (t.dataset.sugg) {
    $$('#m-sugg .chip').forEach(c => c.setAttribute('aria-pressed', c === t));
    $('#m-name').value = t.dataset.sugg;
    $$('#m-type .chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.type === t.dataset.type));
    $('#m-since-f').hidden = t.dataset.type !== 'prophylaxe';
    return;
  }
  if (t.closest('#m-type') && t.dataset.type) {
    $$('#m-type .chip').forEach(c => c.setAttribute('aria-pressed', c === t));
    $('#m-since-f').hidden = t.dataset.type !== 'prophylaxe';
    return;
  }

  switch (act) {
    case 'start': {
      const a = { id: uid(), start: new Date().toISOString(), end: null, aura: null, intensity: 0, impairment: null, locations: [], symptoms: [], triggers: [], meds: [], notes: '', weather: null };
      state.attacks.push(a); save(); render();
      attachWeather(a, true);
      openFlow(a.id, 'start');
      break;
    }
    case 'end': {
      const a = state.attacks.find(x => x.id === id);
      if (!a) break;
      a.end = new Date().toISOString(); a.checkedAt = null; save(); render();
      dialog('Attacke beendet. Möchtest du noch etwas ergänzen – Einschränkung, Schmerzort, Auslöser, Notiz?', { okText: 'Ja, ergänzen', cancelText: 'Nein, fertig' })
        .then(more => { if (more) openFlow(a.id, 'end'); else toast('Alles gespeichert – gute Erholung'); });
      break;
    }
    case 'goto': tab = t.dataset.tab; render(); window.scrollTo(0, 0); break;
    case 'new': openAttack(null, false, t.dataset.day); break;
    case 'edit': openAttack(id); break;
    case 'addmed': openFlow(id, 'meds'); break;
    case 'close': closeSheet(); break;
    case 'saveattack': saveAttack(); break;
    case 'delete':
      dialog('Diesen Eintrag wirklich löschen?', { okText: 'Löschen', danger: true }).then(ok => {
        if (ok && draft) { state.attacks = state.attacks.filter(a => a.id !== draft.id); save(); closeSheet(); toast('Gelöscht'); }
      });
      break;
    case 'loadweather':
      readAttackForm();
      $('#f-weather').innerHTML = '<span class="muted">Lade …</span>';
      fetchWeather(draft.start)
        .then(w => { if (draft) { draft.weather = w; $('#f-weather').innerHTML = weatherHTML(w); } })
        .catch(() => { $('#f-weather').innerHTML = '<span class="muted">Konnte nicht geladen werden (Standort erlaubt? Internet?)</span>'; });
      break;
    case 'calprev': calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); calDay = null; render(); break;
    case 'calnext': calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); calDay = null; render(); break;
    case 'calday': calDay = calDay === t.dataset.day ? null : t.dataset.day; render(); break;
    case 'calall': calDay = null; render(); break;
    case 'backtoattack': { const r = medReturn; medReturn = null; if (r === 'flow') renderFlow(); else renderAttackSheet(); break; }
    case 'newmed': openMed(null); break;
    case 'editmed': openMed(id); break;
    case 'savemed': saveMed(); break;
    case 'delmedication':
      dialog('Medikament löschen? Bereits eingetragene Einnahmen bleiben erhalten.', { okText: 'Löschen', danger: true }).then(ok => {
        if (!ok) return;
        const m = state.meds.find(x => x.id === id);
        if (!m) return;
        state.attacks.forEach(a => (a.meds || []).forEach(x => { if (x.medId === id) { x.name = m.name; x.type = m.type; } }));
        state.meds = state.meds.filter(x => x.id !== id); save(); closeSheet();
      });
      break;
    case 'toggleweather':
      state.settings.weather = !state.settings.weather; save(); render();
      if (state.settings.weather) getCoords();
      break;
    case 'pinon': pinOn(); break;
    case 'pinoff': pinOff(); break;
    case 'locknow': lockNow(); break;
    case 'backup': backup(); break;
    case 'restore': $('#restore-file').click(); break;
    case 'wipe':
      dialog('Wirklich ALLE Daten löschen – Einträge, Medikamente, Name und PIN? Das kann nicht rückgängig gemacht werden.', { okText: 'Alles löschen', danger: true }).then(ok => {
        if (!ok) return;
        vault = null;
        try { Object.keys(localStorage).filter(k => k.startsWith(STORE_KEY)).forEach(k => localStorage.removeItem(k)); } catch (err) { /* egal */ }
        state = defaultState(); tab = 'home'; render(); onboarding(); toast('Alle Daten gelöscht');
      });
      break;
    case 'report': openReport(); break;
    case 'closereport': $('#report').hidden = true; $('#report').innerHTML = ''; document.body.style.overflow = ''; break;
    case 'print': window.print(); break;
    case 'sharereport': shareOrDownload(`kopfschmerzkalender-${dayKey(new Date())}.html`, reportFileHTML(), 'text/html'); break;
    case 'onboard-done': {
      state.settings.name = $('#ob-name').value.trim().slice(0, 60);
      state.settings.weather = $('#ob-weather').getAttribute('aria-checked') === 'true';
      state.settings.onboarded = true; save();
      $('#sheet').hidden = true; $('#sheet').innerHTML = ''; document.body.style.overflow = '';
      render();
      if (state.settings.weather) getCoords();
      break;
    }
    case 'ob-weather': t.setAttribute('aria-checked', t.getAttribute('aria-checked') !== 'true'); break;
  }
});

document.addEventListener('pointerdown', e => {
  const r = e.target.closest && e.target.closest('.pain-range');
  if (!r) return;
  const box = r.getBoundingClientRect();
  const pct = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
  r.value = Math.round(1 + pct * 9);
  r.dispatchEvent(new Event('input', { bubbles: true }));
});

document.addEventListener('toggle', e => {
  if (draft && e.target.dataset && e.target.dataset.fold) draft._open[e.target.dataset.fold] = e.target.open;
}, true);

document.addEventListener('input', e => {
  if (e.target.classList.contains('pain-range')) {
    const v = updatePainSlider(e.target);
    if (draft && e.target.closest('#sheet') && !flow) draft.intensity = v;
    const a = flow && flowAttack();
    if (a) { a.intensity = v; save(); }
    return;
  }
  if (e.target.id !== 'm-search') return;
  const q = e.target.value.trim().toLowerCase();
  $$('#m-sugg .sugg-group').forEach(g => {
    let any = false;
    $$('.chip', g).forEach(c => { const hit = c.dataset.sugg.toLowerCase().includes(q); c.hidden = !hit; any = any || hit; });
    g.hidden = !any;
  });
});

document.addEventListener('change', e => {
  if (e.target.id === 'f-addmed') {
    const v = e.target.value;
    if (!v) return;
    readAttackForm();
    if (v === '__new') { medReturn = 'attack'; openMed(null); return; }
    let medId = v;
    if (v.startsWith('sugg:')) {
      // Vorschlag gewählt: automatisch unter „Meine Medikamente“ anlegen
      const [, type, ...rest] = v.split(':');
      const name = rest.join(':');
      if (!Object.hasOwn(MED_SUGGESTIONS, type) || !MED_SUGGESTIONS[type].includes(name)) return;
      const known = state.meds.find(m => m.name.toLowerCase() === name.toLowerCase());
      if (known) medId = known.id;
      else { medId = uid(); state.meds.push({ id: medId, name, type, since: '' }); save(); }
    }
    draft.meds.push({ medId, time: new Date().toISOString(), effect: null });
    renderAttackSheet();
  }
  if (e.target.id === 'flow-addmed' && flow) {
    const v = e.target.value;
    const a = flowAttack();
    if (!v || !a) return;
    if (v === '__new') { medReturn = 'flow'; openMed(null); return; }
    const [, type, ...rest] = v.split(':');
    const name = rest.join(':');
    if (!Object.hasOwn(MED_SUGGESTIONS, type) || !MED_SUGGESTIONS[type].includes(name)) return;
    let med = state.meds.find(m => m.name.toLowerCase() === name.toLowerCase());
    if (!med) { med = { id: uid(), name, type, since: '' }; state.meds.push(med); }
    if (!a.meds.some(m => m.medId === med.id)) a.meds.push({ medId: med.id, time: new Date().toISOString(), effect: null });
    save(); renderFlow();
  }
  if (e.target.id === 'set-name') { state.settings.name = e.target.value.trim().slice(0, 60); save(); }
  if (e.target.id === 'restore-file' && e.target.files[0]) { restore(e.target.files[0]); e.target.value = ''; }
  if (e.target.id === 'r-months') { reportMonths = +e.target.value; openReport(); }
});

/* ---------- Erster Start ---------- */

function onboarding() {
  const sheet = $('#sheet');
  sheet.innerHTML = `<div class="sheet-inner" style="padding-top:30px">
    <img src="icons/icon-192.png" alt="" width="72" height="72" class="ob-icon">
    <h2 style="font-size:26px">Dein Migräne-Tagebuch</h2>
    <p class="muted">Halte Attacken, Medikamente und mögliche Auslöser fest – schnell, auch wenn's dir schlecht geht. Alles bleibt privat auf deinem Handy.</p>
    <div class="field"><label for="ob-name">Wie heißt du?</label>
      <input type="text" id="ob-name" placeholder="Vorname" autocomplete="given-name" maxlength="60"></div>
    <div class="set-row">
      <span><b>Luftdruck bei Attacken speichern</b><br><span class="small muted">Dafür werden nur der ungefähre Ort (ca. 1 km) und das Datum an den Wetterdienst Open-Meteo geschickt – sonst verlässt nichts dein Handy.</span></span>
      <button class="switch" role="switch" data-act="ob-weather" id="ob-weather" aria-checked="true" aria-label="Luftdruck speichern"><span></span></button>
    </div>
    <p class="small muted">Unter „Einstellungen“ kannst du später einen PIN-Schutz einrichten und Backups machen.</p>
    <p class="small muted">Tipp: Öffne die Seite in Safari und tippe auf „Teilen“ → „Zum Home-Bildschirm“. Dann ist das Tagebuch wie eine App da und deine Daten bleiben dauerhaft gespeichert.</p>
  </div>
  <div class="sheet-foot"><button class="btn primary" data-act="onboard-done">Los geht's</button></div>`;
  sheet.hidden = false;
  document.body.style.overflow = 'hidden';
}

/* ---------- Start ---------- */

function start() {
  render();
  if (!state.settings.onboarded) onboarding();
  else checkStale();
}

(function boot() {
  const stored = readStored();
  if (stored && stored.enc === 1 && stored.salt && stored.iv && stored.ct) { showLock(stored); return; }
  state = sanitizeState(stored);
  if (stored) save();   // alte Daten einmal im geprüften Format speichern
  start();
})();

setInterval(() => {
  if ($('.lock')) return;
  if (tab === 'home' && $('#sheet').hidden && activeAttack()) render();
  checkStale();
}, 60000);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
