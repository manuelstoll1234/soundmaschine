import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ==========================================================================
   MUNDART-SPRACHASSISTENT
   Push-to-Talk -> STT (Schweizerdeutsch) -> Claude (Mundart) -> TTS (Mundart)

   Einzelne JSX-Datei, React + Tailwind, keine weiteren Abhaengigkeiten.
   API-Schluessel werden NIE im Code abgelegt, sondern in den Einstellungen
   eingegeben (nur im Browser gespeichert).

   Dienste:
     - fhnw    : FHNW stt4sg.fhnw.ch (Gradio-API, kostenlos, experimentell)
     - suisse  : Suisse Line Speech API (mit API-Schluessel)
     - browser : Web-Speech-API des Browsers (Notbehelf, de-CH)
   ========================================================================== */

/* -------------------------------------------------------------------------
   Daten: Dialekte & Stimmen
   ------------------------------------------------------------------------- */

const REGIONS = {
  ostschweiz: "Ostschweiz",
  zuerich: "Zürich",
  bern: "Bern",
  basel: "Basel",
  innerschweiz: "Innerschweiz",
  wallis: "Wallis",
};

const DIALECTS = [
  { id: "zuerich", name: "Zürich", region: "zuerich", label: "Züritüütsch",
    hint: "Typische Wörter und Schreibweise: «gsi», «chli», «guet», «nöd», «öppis», «mir händ», «ich han», «Chind», «Znüni», «Züri», «gäll», «hüt». Endung -ed bei der Mehrzahl (mir händ, ihr sind → send). Verneinung «nöd», nicht «nid»." },
  { id: "bern", name: "Bern", region: "bern", label: "Bärndütsch",
    hint: "Typische Wörter und Schreibweise: «nid», «gäng» (immer), «chly», «ig» (ich), «mir hei», «gseh», «Bärn», «Zmorge», «louft», «gäu» (gell). L-Vokalisierung: «Schueu» (Schule), «Miuch» (Milch), «viu» (viel), «Ghöuz». Gemächlicher, melodiöser Ton." },
  { id: "basel", name: "Basel", region: "basel", label: "Baseldytsch",
    hint: "Typische Wörter und Schreibweise: «nit», «ych», «Dytsch», «Zyt», «mir hänn», «e bitzeli», «Bebbi», «Drämmli», «Fasnacht», «Rhy», «Mäss», «gäll», «Baasel». Langes «y» für ei/î (Zyt, myy), «Mänsch» wird «Mensch» gesprochen." },
  { id: "luzern", name: "Luzern", region: "innerschweiz", label: "Luzärnerdütsch",
    hint: "Typische Wörter und Schreibweise: «ned», «gsi», «Chind», «mir hend», «Luzärn», «öppis», «Liäbi», «guet» als «guät»; Diphthonge «iä», «uä», «öi». Verniedlichungen auf -li («Chätzli»)." },
  { id: "stgallen", name: "St. Gallen", region: "ostschweiz", label: "Sanggallerisch",
    hint: "Typische Wörter und Schreibweise: «nöd», «ond» (und), «mer händ», «öpper», «hesch», «gsee», «e chli», «s'isch», «Hoi», «Sanggale». Ostschweizer Färbung, oft «o» statt «u» (ond, Honds)." },
  { id: "aargau", name: "Aargau", region: "zuerich", label: "Aargauerdütsch",
    hint: "Typische Wörter und Schreibweise: «nöd»/«ned», «i ha», «mir hei»/«mer händ», «gäu»/«gäll», «Chind», «e chli», «Aarau», «gsi», «chönnt». Mischung aus Zürcher und Berner Einflüssen, eher zügig und trocken." },
  { id: "thurgau", name: "Thurgau", region: "ostschweiz", label: "Thurgauerisch",
    hint: "Typische Wörter und Schreibweise: «nöd», «ond», «mer händ», «Moscht» (Most), «Öpfel», «Bodesee», «gsee», «ischs», «Hoi». Ostschweizer Klang mit Obst- und Seethemen." },
  { id: "schaffhausen", name: "Schaffhausen", region: "ostschweiz", label: "Schaffhuuserisch",
    hint: "Typische Wörter und Schreibweise: «nöd», «mer händ», «Schaffhuuse», «Rhii», «Chnüü», «hööch», «ä chli», «gsi», «ich han». Nahe am Zürcher und Thurgauer Dialekt, Rhein-Bezüge." },
  { id: "solothurn", name: "Solothurn", region: "bern", label: "Soledurnerdütsch",
    hint: "Typische Wörter und Schreibweise: «nid», «gäng», «mir hei», «Soledurn», «Chind», «gäu». Übergangsdialekt zwischen Bern und Basel/Aargau, ruhig und bodenständig." },
  { id: "wallis", name: "Wallis", region: "wallis", label: "Wallisertitsch",
    hint: "Höchstalemannisch: «Grüessech», «nit», «gäng», «Lüägu» (schauen), «Chind», «Bärg», «ds Wätter», Endungen auf -u/-ä/-i («Gassu», «guätä»), volle Nebensilben, singender Tonfall. Alte Formen, die sonst im Deutschschweizer Raum kaum noch vorkommen." },
  { id: "graubuenden", name: "Graubünden", region: "ostschweiz", label: "Bündnertütsch",
    hint: "Typische Wörter und Schreibweise: «nöd», «Tschau»/«Ciao»/«Adiö», «Chur», «Pizokel», «Capuns», «Maluns», romanische Lehnwörter, «gsi», «e chli». Walserdialekte und Churer Dialekt klingen verschieden; hier der Churer/Bündner Alltagston." },
  { id: "uri", name: "Uri", region: "innerschweiz", label: "Urnerdütsch",
    hint: "Typische Wörter und Schreibweise: «ned»/«nid», «ä», «Chind», «Gotthard», «Altdorf», «Reiss», Diphthonge «iä», «uä», kräftige Kehllaute (ch), oft knappe, trockene Sprechweise." },
  { id: "schwyz", name: "Schwyz", region: "innerschweiz", label: "Schwyzerdütsch",
    hint: "Typische Wörter und Schreibweise: «ned», «Chind», «Bärg», «Mythen», «Chlaus», «Chäs», «iä», «uä», «mir hend». Innerschweizer Klang, bodenständig." },
  { id: "zug", name: "Zug", region: "innerschweiz", label: "Zugerdütsch",
    hint: "Typische Wörter und Schreibweise: «ned», «Chriesi» (Kirschen), «Zugersee», «Chäsi», «mir hend», «gsi», «Chind». Innerschweizer Einschlag mit leichter Zürcher Nähe." },
  { id: "glarus", name: "Glarus", region: "ostschweiz", label: "Glarnerdütsch",
    hint: "Typische Wörter und Schreibweise: «nöd»/«ned», «Ziger», «Schabziger», «Chnüü», «gsii», «Landsgmeind», «Chlöntal», «Chind». Eigenständiger Bergdialekt zwischen Zürich und Ostschweiz." },
  { id: "appenzell", name: "Appenzell", region: "ostschweiz", label: "Appezöllerisch",
    hint: "Typische Wörter und Schreibweise: «nöd», «ond», «mer händ», «Appezöll», «Alpstei», «Sönd», «Chäs», «Wie gohts?», «gsee». Singender, humorvoller Ton mit vielen Verkleinerungen." },
  { id: "freiburg", name: "Freiburg", region: "bern", label: "Senslerdütsch",
    hint: "Senslerdeutsch (Deutschfreiburg): nah am Berndeutschen, «nid», «gäng», «ig», «mir hei», mit französischen Einsprengseln wie «Merci vöu mau», «adiö», «Fribourg»/«Frybùrg». Freundlich und gemütlich." },
  { id: "nidwalden", name: "Nidwalden", region: "innerschweiz", label: "Nidwaldnerdütsch",
    hint: "Typische Wörter und Schreibweise: «ned», «Stans», «Pilatus», «Vierwaldstättersee», «iä», «uä», «Chind», «mir hend». Innerschweizer Klang, ruhig." },
  { id: "obwalden", name: "Obwalden", region: "innerschweiz", label: "Obwaldnerdütsch",
    hint: "Typische Wörter und Schreibweise: «ned», «Sarnen», «Sachsle», «Bruder Chlaus», «Chäs», «iä», «uä», «Chind». Innerschweizer Klang mit eigenen Eigenheiten gegenüber Nidwalden." },
  { id: "baselland", name: "Baselland", region: "basel", label: "Baselbieterdütsch",
    hint: "Typische Wörter und Schreibweise: «nit»/«nid», «Baselbieter», «Liestal», «Chriesi» (Kirschen), «Chilbi», «mir hänn», «Zyt». Ländlicher als Basel-Stadt, dennoch verwandt." },
];

// Stimmen: je Region männlich/weiblich. `id` wird an den Dienst weitergegeben
// ({{voice}}, {{region}}, {{gender}} in den Vorlagen der Einstellungen).
const VOICES = Object.entries(REGIONS).flatMap(([region, regionName]) => [
  { id: `${region}_m`, region, regionName, gender: "m", label: `${regionName} – männlich` },
  { id: `${region}_w`, region, regionName, gender: "w", label: `${regionName} – weiblich` },
]);

const MODELS = [
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (ausgewogen)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (schnell, günstig)" },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (stärkstes Modell)" },
];

function buildSystemPrompt(d) {
  return [
    `Du bist ein freundlicher, hilfsbereiter Sprachassistent und sprichst ausschliesslich ${d.label} (Mundart des Kantons ${d.name}).`,
    `Antworte IMMER in dieser Mundart, nie auf Hochdeutsch – auch dann, wenn die Frage hochdeutsch oder in einem anderen Dialekt eintrifft (die Spracherkennung liefert Mundart oft als Schriftdeutsch).`,
    `Schreibe so, wie man den Dialekt in Chats schreibt (Dialektschreibweise, Schweizer Rechtschreibung ohne «ß»). ${d.hint}`,
    `Deine Antwort wird laut vorgelesen. Darum: kurz und natürlich (meist 1–3 Sätze, höchstens 5), keine Aufzählungen, kein Markdown, keine Emojis, keine Sonderzeichen, Zahlen und Abkürzungen so ausschreiben, wie man sie sagt.`,
    `Bleibe sachlich korrekt. Wenn du etwas nicht weisst, sag es ehrlich in der Mundart. Sei warm und ein bisschen urchig, aber nicht übertrieben und nie karikierend.`,
  ].join("\n\n");
}

/* -------------------------------------------------------------------------
   Einstellungen & Speicher
   ------------------------------------------------------------------------- */

const DEFAULTS = {
  service: "fhnw", // fhnw | suisse | browser
  dialect: "zuerich",
  voice: "auto-m", // auto-m | auto-w | random | <voice id>
  model: "claude-sonnet-5-5",
  pttMode: "hold", // hold | toggle
  autoSpeak: true,
  browserFallback: true,
  fhnw: {
    base: "https://stt4sg.fhnw.ch",
    sttApi: "/predict",
    ttsApi: "/predict_1",
    // Platzhalter: {{audio}} {{text}} {{voice}} {{region}} {{gender}} {{dialect}}
    sttTemplate: '["{{audio}}"]',
    ttsTemplate: '["{{text}}", "{{region}}"]',
  },
  suisse: {
    base: "https://api.suisse-line.ch",
    sttPath: "/v1/stt",
    ttsPath: "/v1/tts",
    authStyle: "bearer", // bearer | x-api-key
    language: "de-CH",
    dialect: "auto",
  },
};

const LS_SETTINGS = "mundart.settings.v1";
const LS_KEYS = "mundart.keys.v1";

function safeGet(store, key) {
  try { return store.getItem(key); } catch { return null; }
}
function safeSet(store, key, val) {
  try { store.setItem(key, val); } catch { /* ignorieren */ }
}
function safeRemove(store, key) {
  try { store.removeItem(key); } catch { /* ignorieren */ }
}
function getStore(name) {
  try { return window[name]; } catch { return null; }
}

function mergeDeep(base, extra) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  if (!extra || typeof extra !== "object") return out;
  for (const k of Object.keys(extra)) {
    if (base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) out[k] = mergeDeep(base[k], extra[k]);
    else out[k] = extra[k];
  }
  return out;
}

function loadSettings() {
  const ls = getStore("localStorage");
  if (!ls) return DEFAULTS;
  try { return mergeDeep(DEFAULTS, JSON.parse(safeGet(ls, LS_SETTINGS) || "{}")); } catch { return DEFAULTS; }
}

// Schlüssel: optional dauerhaft (localStorage) oder nur für diesen Tab (sessionStorage).
function loadKeys() {
  const ls = getStore("localStorage");
  const ss = getStore("sessionStorage");
  const fromLs = ls ? safeGet(ls, LS_KEYS) : null;
  const fromSs = ss ? safeGet(ss, LS_KEYS) : null;
  try {
    if (fromLs) return { anthropic: "", suisse: "", ...JSON.parse(fromLs), remember: true };
    if (fromSs) return { anthropic: "", suisse: "", ...JSON.parse(fromSs), remember: false };
  } catch { /* leer */ }
  return { anthropic: "", suisse: "", remember: false };
}

function persistKeys(keys) {
  const ls = getStore("localStorage");
  const ss = getStore("sessionStorage");
  const payload = JSON.stringify({ anthropic: keys.anthropic, suisse: keys.suisse });
  if (keys.remember) {
    if (ls) safeSet(ls, LS_KEYS, payload);
    if (ss) safeRemove(ss, LS_KEYS);
  } else {
    if (ss) safeSet(ss, LS_KEYS, payload);
    if (ls) safeRemove(ls, LS_KEYS);
  }
}

/* -------------------------------------------------------------------------
   Audio-Helfer
   ------------------------------------------------------------------------- */

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); w(8, "WAVE");
  w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

// Aufnahme (webm/mp4) -> 16 kHz Mono-WAV; die meisten STT-Dienste erwarten das.
async function blobToWav16k(blob) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const rate = 16000;
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const rendered = await off.startRendering();
    return encodeWav(rendered.getChannelData(0), rate);
  } finally {
    ctx.close?.();
  }
}

function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function pickMime() {
  const c = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return c.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || "";
}

/* -------------------------------------------------------------------------
   Dienst: FHNW (Gradio)
   ------------------------------------------------------------------------- */

const trimSlash = (s) => (s || "").trim().replace(/\/+$/, "");
const stripSlash = (s) => (s || "").trim().replace(/^\/+/, "");

function networkHint(e, host) {
  if (e?.name === "AbortError") return e;
  if (e instanceof TypeError) {
    return new Error(`${host} nicht erreichbar (offline, gesperrt oder CORS-Sperre des Dienstes).`);
  }
  return e;
}

function parseSse(text) {
  let result = null;
  for (const block of text.split(/\n\n+/)) {
    const ev = /^event:\s*(.+)$/m.exec(block)?.[1]?.trim();
    const data = /^data:\s*(.*)$/m.exec(block)?.[1];
    if (ev === "error") throw new Error(`Gradio-Fehler${data && data !== "null" ? `: ${data}` : " (Dienst meldet einen Fehler)"}`);
    if (ev === "complete" && data !== undefined) { try { result = JSON.parse(data); } catch { result = data; } }
  }
  if (result === null) throw new Error("Gradio lieferte kein Ergebnis.");
  return result;
}

function fillTemplate(template, vars) {
  let parsed;
  try { parsed = JSON.parse(template); } catch { throw new Error("Parameter-Vorlage ist kein gültiges JSON."); }
  const walk = (node) => {
    if (typeof node === "string") {
      const only = /^\{\{(\w+)\}\}$/.exec(node.trim());
      if (only && only[1] in vars) return vars[only[1]];
      return node.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars && typeof vars[k] !== "object" ? String(vars[k]) : ""));
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v)]));
    return node;
  };
  return walk(parsed);
}

async function gradioUpload(base, blob, filename, signal) {
  const root = trimSlash(base);
  let last;
  for (const p of ["/gradio_api", ""]) {
    try {
      const fd = new FormData();
      fd.append("files", blob, filename);
      const r = await fetch(`${root}${p}/upload`, { method: "POST", body: fd, signal });
      if (r.status === 404 || r.status === 405) { last = new Error(`Upload ${r.status}`); continue; }
      if (!r.ok) throw new Error(`Upload ${r.status}`);
      const paths = await r.json();
      return { path: paths[0], orig_name: filename, mime_type: blob.type, meta: { _type: "gradio.FileData" } };
    } catch (e) {
      if (e?.name === "AbortError") throw e;
      last = networkHint(e, root);
    }
  }
  throw last || new Error("Upload fehlgeschlagen.");
}

async function gradioCall(base, apiName, data, signal) {
  const root = trimSlash(base);
  const name = stripSlash(apiName);
  let last;
  for (const p of ["/gradio_api", ""]) {
    try {
      const r = await fetch(`${root}${p}/call/${name}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }), signal,
      });
      if (r.status === 404 || r.status === 405) { last = new Error(`Endpunkt «${name}» nicht gefunden (${r.status}).`); continue; }
      if (!r.ok) throw new Error(`Gradio ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const { event_id } = await r.json();
      const s = await fetch(`${root}${p}/call/${name}/${event_id}`, { signal });
      if (!s.ok) throw new Error(`Gradio ${s.status}`);
      return { result: parseSse(await s.text()), prefix: p };
    } catch (e) {
      if (e?.name === "AbortError") throw e;
      last = networkHint(e, root);
    }
  }
  throw last || new Error("Gradio-Aufruf fehlgeschlagen.");
}

function gradioFileUrl(base, prefix, item) {
  if (!item) return null;
  if (typeof item === "string") {
    if (/^(https?:|data:|blob:)/.test(item)) return item;
    return `${trimSlash(base)}${prefix}/file=${item}`;
  }
  if (item.url) return item.url;
  if (item.path) return `${trimSlash(base)}${prefix}/file=${item.path}`;
  return null;
}

function extractText(res) {
  const flat = [res].flat(3).find((x) => typeof x === "string" && x.trim());
  return (flat || "").trim();
}

async function fhnwStt(cfg, wav, signal) {
  const file = await gradioUpload(cfg.base, wav, "aufnahme.wav", signal);
  const data = fillTemplate(cfg.sttTemplate, { audio: file });
  const { result } = await gradioCall(cfg.base, cfg.sttApi, data, signal);
  return extractText(result);
}

async function fhnwTts(cfg, text, voice, dialect, signal) {
  const data = fillTemplate(cfg.ttsTemplate, {
    text, voice: voice.id, region: voice.region, gender: voice.gender === "m" ? "male" : "female", dialect: dialect.name,
  });
  const { result, prefix } = await gradioCall(cfg.base, cfg.ttsApi, data, signal);
  const item = [result].flat(3).find((x) => x && (typeof x === "string" ? /\.(wav|mp3|ogg|flac|m4a)|^https?:|^data:audio/i.test(x) : x.url || x.path));
  const url = gradioFileUrl(cfg.base, prefix, item);
  if (!url) throw new Error("FHNW-TTS lieferte keine Audiodatei (Ausgabeformat prüfen).");
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`Audio-Download ${r.status}`);
  return await r.blob();
}

async function gradioDiscover(base) {
  const root = trimSlash(base);
  let last;
  for (const p of ["/gradio_api", ""]) {
    try {
      const r = await fetch(`${root}${p}/info`);
      if (!r.ok) { last = new Error(`/info ${r.status}`); continue; }
      const info = await r.json();
      return Object.entries(info.named_endpoints || {}).map(([name, ep]) => ({
        name,
        params: (ep.parameters || []).map((x) => `${x.parameter_name || x.label}: ${x.python_type?.type || x.type?.type || "?"}`),
        returns: (ep.returns || []).map((x) => x.label || x.type?.type || "?"),
      }));
    } catch (e) { last = networkHint(e, root); }
  }
  throw last || new Error("Keine API-Info gefunden.");
}

/* -------------------------------------------------------------------------
   Dienst: Suisse Line (REST) – Pfade/Felder in den Einstellungen anpassbar
   ------------------------------------------------------------------------- */

function suisseHeaders(cfg, key) {
  if (!key) throw new Error("Suisse-Line-API-Schlüssel fehlt (Einstellungen).");
  return cfg.authStyle === "x-api-key" ? { "x-api-key": key } : { Authorization: `Bearer ${key}` };
}

async function suisseStt(cfg, key, wav, signal) {
  const fd = new FormData();
  fd.append("file", wav, "aufnahme.wav");
  fd.append("audio", wav, "aufnahme.wav");
  fd.append("language", cfg.language);
  fd.append("dialect", cfg.dialect);
  let r;
  try {
    r = await fetch(`${trimSlash(cfg.base)}/${stripSlash(cfg.sttPath)}`, { method: "POST", headers: suisseHeaders(cfg, key), body: fd, signal });
  } catch (e) { throw networkHint(e, cfg.base); }
  if (!r.ok) throw new Error(`Suisse Line STT ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return (j.text ?? j.transcript ?? j.result?.text ?? j.results?.[0]?.text ?? j.results?.[0]?.transcript ?? "").toString().trim();
}

async function suisseTts(cfg, key, text, voice, dialect, signal) {
  let r;
  try {
    r = await fetch(`${trimSlash(cfg.base)}/${stripSlash(cfg.ttsPath)}`, {
      method: "POST", signal,
      headers: { "Content-Type": "application/json", ...suisseHeaders(cfg, key) },
      body: JSON.stringify({ text, language: cfg.language, dialect: dialect.id, region: voice.region, gender: voice.gender === "m" ? "male" : "female", voice: voice.id }),
    });
  } catch (e) { throw networkHint(e, cfg.base); }
  if (!r.ok) throw new Error(`Suisse Line TTS ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const type = r.headers.get("content-type") || "";
  if (type.startsWith("audio/") || type.includes("octet-stream")) return await r.blob();
  const j = await r.json();
  const a = j.audio_url ?? j.url ?? j.audio;
  if (!a) throw new Error("Suisse Line TTS lieferte keine Audiodaten.");
  if (/^https?:|^data:/.test(a)) { const ar = await fetch(a, { signal }); return await ar.blob(); }
  const bin = atob(a);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: j.mime_type || "audio/mpeg" });
}

/* -------------------------------------------------------------------------
   Dienst: Browser (Web Speech API) – Notbehelf
   ------------------------------------------------------------------------- */

const SpeechRec = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

function startBrowserStt() {
  if (!SpeechRec) throw new Error("Dieser Browser hat keine Spracherkennung (Web Speech API).");
  const rec = new SpeechRec();
  rec.lang = "de-CH";
  rec.interimResults = false;
  rec.continuous = true;
  let text = "";
  let done;
  const finished = new Promise((res) => { done = res; });
  let error = null;
  rec.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript + " "; };
  rec.onerror = (e) => { error = e.error; };
  rec.onend = () => done();
  rec.start();
  return {
    async stop() {
      try { rec.stop(); } catch { /* schon beendet */ }
      await finished;
      if (error && error !== "no-speech" && error !== "aborted") throw new Error(`Spracherkennung: ${error}`);
      return text.trim();
    },
    abort() { try { rec.abort(); } catch { /* egal */ } },
  };
}

function pickBrowserVoice(voice) {
  const list = window.speechSynthesis?.getVoices?.() || [];
  const ch = list.filter((v) => /de[-_]CH/i.test(v.lang));
  const de = list.filter((v) => /^de/i.test(v.lang));
  const pool = ch.length ? ch : de;
  if (!pool.length) return null;
  const fem = /(female|weiblich|anna|petra|marlene|vicki|katja|helena|amelie|sabine)/i;
  const preferred = pool.filter((v) => (voice.gender === "w") === fem.test(v.name));
  return (preferred[0] || pool[0]);
}

/* -------------------------------------------------------------------------
   Claude (Anthropic Messages API, direkt aus dem Browser)
   ------------------------------------------------------------------------- */

function buildHistory(messages) {
  const out = [];
  for (const m of messages) {
    if (m.error || !m.text) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += `\n${m.text}`;
    else out.push({ role: m.role, content: m.text });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out.slice(-14);
}

async function askClaude({ apiKey, model, system, history, signal }) {
  if (!apiKey) throw new Error("Anthropic-API-Schlüssel fehlt (Einstellungen).");
  let r;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model, max_tokens: 500, system, messages: history }),
    });
  } catch (e) { throw networkHint(e, "api.anthropic.com"); }
  if (!r.ok) {
    let msg = "";
    try { msg = (await r.json()).error?.message || ""; } catch { /* leer */ }
    throw new Error(`Claude ${r.status}${msg ? `: ${msg}` : ""}`);
  }
  const j = await r.json();
  const text = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  if (!text) throw new Error("Claude lieferte keine Antwort.");
  return text;
}

/* -------------------------------------------------------------------------
   UI-Bausteine
   ------------------------------------------------------------------------- */

const Icon = {
  mic: (c = "w-8 h-8") => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  ),
  gear: (c = "w-5 h-5") => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
  play: (c = "w-4 h-4") => (
    <svg className={c} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
  ),
  stop: (c = "w-4 h-4") => (
    <svg className={c} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
  ),
  back: (c = "w-5 h-5") => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
  ),
  send: (c = "w-5 h-5") => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  ),
};

function SwissCross({ className = "w-8 h-8" }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#dc2626" />
      <path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#fff" />
    </svg>
  );
}

const inputCls = "w-full rounded-lg bg-stone-900 border border-stone-700 px-3 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500";
const btnCls = "rounded-lg border border-stone-700 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 px-3 py-2 text-sm text-stone-100 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500";

function Field({ label, help, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-stone-200 mb-1.5">{label}</span>
      {children}
      {help && <span className="block text-xs text-stone-400 mt-1.5 leading-relaxed">{help}</span>}
    </label>
  );
}

function Toggle({ checked, onChange, label, help }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input type="checkbox" className="mt-1 h-5 w-5 accent-red-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium text-stone-200">{label}</span>
        {help && <span className="block text-xs text-stone-400 mt-0.5 leading-relaxed">{help}</span>}
      </span>
    </label>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4 sm:p-5 space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">{title}</h2>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------
   Einstellungsseite
   ------------------------------------------------------------------------- */

function SettingsView({ settings, setSettings, keys, setKeys, onBack, onClear }) {
  const [disc, setDisc] = useState({ state: "idle", list: [], error: "" });
  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const setF = (patch) => setSettings((s) => ({ ...s, fhnw: { ...s.fhnw, ...patch } }));
  const setS = (patch) => setSettings((s) => ({ ...s, suisse: { ...s.suisse, ...patch } }));

  const discover = async () => {
    setDisc({ state: "loading", list: [], error: "" });
    try { setDisc({ state: "ok", list: await gradioDiscover(settings.fhnw.base), error: "" }); }
    catch (e) { setDisc({ state: "error", list: [], error: e.message }); }
  };

  const services = [
    { id: "fhnw", name: "FHNW", sub: "kostenlos, experimentell" },
    { id: "suisse", name: "Suisse Line", sub: "stabil, API-Schlüssel" },
    { id: "browser", name: "Browser", sub: "Notbehelf (de-CH)" },
  ];

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-2 px-3 py-3 border-b border-stone-800 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button onClick={onBack} className="p-2 -ml-1 rounded-lg hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-red-500" aria-label="Zurück">{Icon.back()}</button>
        <h1 className="text-lg font-semibold">Einstellungen</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 max-w-2xl w-full mx-auto">
        <Section title="Sprachdienst (STT & TTS)">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Sprachdienst">
            {services.map((s) => (
              <button key={s.id} role="radio" aria-checked={settings.service === s.id} onClick={() => set({ service: s.id })}
                className={`rounded-xl border px-2 py-3 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 ${settings.service === s.id ? "border-red-500 bg-red-600/15" : "border-stone-700 bg-stone-900 hover:bg-stone-800"}`}>
                <span className="block text-sm font-semibold">{s.name}</span>
                <span className="block text-[11px] text-stone-400 mt-0.5">{s.sub}</span>
              </button>
            ))}
          </div>

          {settings.service === "fhnw" && (
            <div className="space-y-4">
              <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 leading-relaxed">
                Experimentell: Die Gradio-Endpunktnamen von stt4sg.fhnw.ch können sich ändern. Die Standardwerte unten sind Platzhalter –
                mit «Endpunkte erkennen» die echten Namen und Parameter abrufen und mit einem Klick übernehmen.
              </p>
              <Field label="Basis-URL"><input className={inputCls} value={settings.fhnw.base} onChange={(e) => setF({ base: e.target.value })} inputMode="url" autoCapitalize="off" spellCheck={false} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="STT api_name"><input className={inputCls} value={settings.fhnw.sttApi} onChange={(e) => setF({ sttApi: e.target.value })} autoCapitalize="off" spellCheck={false} /></Field>
                <Field label="TTS api_name"><input className={inputCls} value={settings.fhnw.ttsApi} onChange={(e) => setF({ ttsApi: e.target.value })} autoCapitalize="off" spellCheck={false} /></Field>
              </div>
              <Field label="STT-Parameter (JSON)" help="Platzhalter: {{audio}}">
                <input className={`${inputCls} font-mono`} value={settings.fhnw.sttTemplate} onChange={(e) => setF({ sttTemplate: e.target.value })} spellCheck={false} />
              </Field>
              <Field label="TTS-Parameter (JSON)" help="Platzhalter: {{text}} {{voice}} {{region}} {{gender}} {{dialect}}">
                <input className={`${inputCls} font-mono`} value={settings.fhnw.ttsTemplate} onChange={(e) => setF({ ttsTemplate: e.target.value })} spellCheck={false} />
              </Field>
              <div>
                <button className={btnCls} onClick={discover} disabled={disc.state === "loading"}>{disc.state === "loading" ? "Suche…" : "Endpunkte erkennen"}</button>
                {disc.state === "error" && <p className="text-xs text-red-300 mt-2">{disc.error}</p>}
                {disc.state === "ok" && !disc.list.length && <p className="text-xs text-stone-400 mt-2">Keine benannten Endpunkte gefunden.</p>}
                {disc.list.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {disc.list.map((ep) => (
                      <li key={ep.name} className="rounded-lg border border-stone-800 bg-stone-950 p-3 text-xs">
                        <div className="font-mono text-stone-100">{ep.name}</div>
                        <div className="text-stone-400 mt-1">in: {ep.params.join(", ") || "–"}</div>
                        <div className="text-stone-400">out: {ep.returns.join(", ") || "–"}</div>
                        <div className="flex gap-2 mt-2">
                          <button className={btnCls} onClick={() => setF({ sttApi: ep.name })}>als STT</button>
                          <button className={btnCls} onClick={() => setF({ ttsApi: ep.name })}>als TTS</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {settings.service === "suisse" && (
            <div className="space-y-4">
              <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 leading-relaxed">
                Pfade und Feldnamen sind Standardannahmen für eine REST-API (STT: multipart-Upload mit language=de-CH, dialect=auto; TTS: JSON).
                Bitte mit der Dokumentation von suisse-line.ch abgleichen und hier anpassen.
              </p>
              <Field label="API-Schlüssel" help="Wird nicht im Code gespeichert, nur im Browser.">
                <input type="password" className={inputCls} value={keys.suisse} onChange={(e) => setKeys((k) => ({ ...k, suisse: e.target.value }))} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="sk-…" />
              </Field>
              <Field label="Basis-URL"><input className={inputCls} value={settings.suisse.base} onChange={(e) => setS({ base: e.target.value })} inputMode="url" autoCapitalize="off" spellCheck={false} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="STT-Pfad"><input className={inputCls} value={settings.suisse.sttPath} onChange={(e) => setS({ sttPath: e.target.value })} autoCapitalize="off" spellCheck={false} /></Field>
                <Field label="TTS-Pfad"><input className={inputCls} value={settings.suisse.ttsPath} onChange={(e) => setS({ ttsPath: e.target.value })} autoCapitalize="off" spellCheck={false} /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Sprache"><input className={inputCls} value={settings.suisse.language} onChange={(e) => setS({ language: e.target.value })} autoCapitalize="off" spellCheck={false} /></Field>
                <Field label="STT-Dialekt"><input className={inputCls} value={settings.suisse.dialect} onChange={(e) => setS({ dialect: e.target.value })} autoCapitalize="off" spellCheck={false} /></Field>
                <Field label="Auth">
                  <select className={inputCls} value={settings.suisse.authStyle} onChange={(e) => setS({ authStyle: e.target.value })}>
                    <option value="bearer">Bearer</option>
                    <option value="x-api-key">x-api-key</option>
                  </select>
                </Field>
              </div>
            </div>
          )}

          {settings.service === "browser" && (
            <p className="text-xs text-stone-400 leading-relaxed">
              Nutzt die eingebaute Spracherkennung und Sprachausgabe des Browsers (Sprache de-CH, sonst Deutsch). Das erkennt Mundart nur grob und klingt
              hochdeutsch – gedacht als Notbehelf, wenn die Dienste nicht erreichbar sind. Chrome und Safari unterstützen es am besten.
            </p>
          )}
        </Section>

        <Section title="Claude (Anthropic)">
          <Field label="API-Schlüssel" help="Der Schlüssel liegt im Browser und geht nur an api.anthropic.com. Für einen öffentlichen Einsatz gehört er auf einen eigenen Server (Proxy), nicht in den Browser.">
            <input type="password" className={inputCls} value={keys.anthropic} onChange={(e) => setKeys((k) => ({ ...k, anthropic: e.target.value }))} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="sk-ant-…" />
          </Field>
          <Field label="Modell">
            <select className={inputCls} value={settings.model} onChange={(e) => set({ model: e.target.value })}>
              {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
          <Toggle checked={keys.remember} onChange={(v) => setKeys((k) => ({ ...k, remember: v }))} label="Schlüssel auf diesem Gerät merken"
            help="Aus: Schlüssel bleibt nur in diesem Tab erhalten. Nicht auf geteilten Geräten aktivieren." />
        </Section>

        <Section title="Bedienung">
          <Field label="Push-to-Talk">
            <select className={inputCls} value={settings.pttMode} onChange={(e) => set({ pttMode: e.target.value })}>
              <option value="hold">Halten zum Sprechen, loslassen zum Senden</option>
              <option value="toggle">Tippen zum Starten, nochmals tippen zum Senden (Auto)</option>
            </select>
          </Field>
          <Toggle checked={settings.autoSpeak} onChange={(v) => set({ autoSpeak: v })} label="Antwort automatisch vorlesen" />
          <Toggle checked={settings.browserFallback} onChange={(v) => set({ browserFallback: v })} label="Browser-Stimme als Ersatz"
            help="Wenn die Sprachausgabe des Dienstes ausfällt, liest der Browser die Antwort vor." />
        </Section>

        <Section title="Daten & Lizenz">
          <button className={btnCls} onClick={onClear}>Verlauf löschen</button>
          <p className="text-xs text-stone-400 leading-relaxed">
            Aufnahmen gehen an den gewählten Sprachdienst, Texte an Anthropic. Die Forschungsdaten hinter den FHNW-Modellen (STT4SG-350, SDS-200, SwissDial)
            sind nur für Forschung lizenziert – für einen Kundeneinsatz die Lizenz des jeweiligen Dienstes klären. Das Mikrofon funktioniert im Browser nur über HTTPS.
          </p>
        </Section>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Haupt-App
   ------------------------------------------------------------------------- */

const STATUS = {
  idle: "Halten zum Sprechen",
  idleToggle: "Tippen zum Sprechen",
  recording: "Ich hör zue …",
  transcribing: "Ich verstah …",
  thinking: "Ich überleg …",
  speaking: "Ich red …",
};

let idCounter = 0;
const nextId = () => `m${Date.now().toString(36)}${idCounter++}`;

export default function MundartAssistent() {
  const [settings, setSettings] = useState(loadSettings);
  const [keys, setKeys] = useState(loadKeys);
  const [view, setView] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("idle");
  const [level, setLevel] = useState(0);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState("");
  const [speakingId, setSpeakingId] = useState(null);

  const audioEl = useRef(null);
  const abortRef = useRef(null);
  const recRef = useRef(null); // laufende Aufnahme
  const wantStopRef = useRef(false);
  const playbackRef = useRef(null);
  const finishRef = useRef(() => {});
  const scrollRef = useRef(null);
  const messagesRef = useRef(messages);
  const busyRef = useRef(false);
  messagesRef.current = messages;

  const dialect = useMemo(() => DIALECTS.find((d) => d.id === settings.dialect) || DIALECTS[0], [settings.dialect]);

  useEffect(() => { const ls = getStore("localStorage"); if (ls) safeSet(ls, LS_SETTINGS, JSON.stringify(settings)); }, [settings]);
  useEffect(() => { persistKeys(keys); }, [keys]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, status]);
  useEffect(() => {
    audioEl.current = new Audio();
    audioEl.current.preload = "auto";
    const synth = window.speechSynthesis;
    synth?.getVoices?.(); // Stimmenliste vorladen
    return () => { abortRef.current?.abort(); audioEl.current?.pause(); synth?.cancel(); };
  }, []);

  /* ---- Stimme wählen ---- */
  const resolveVoice = useCallback(() => {
    const v = settings.voice;
    if (v === "random") return VOICES[Math.floor(Math.random() * VOICES.length)];
    if (v === "auto-m" || v === "auto-w") {
      const g = v === "auto-m" ? "m" : "w";
      return VOICES.find((x) => x.region === dialect.region && x.gender === g) || VOICES[0];
    }
    return VOICES.find((x) => x.id === v) || VOICES[0];
  }, [settings.voice, dialect]);

  /* ---- Wiedergabe ---- */
  const stopSpeaking = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
  }, []);

  const playBlob = useCallback((blob) => new Promise((resolve, reject) => {
    const a = audioEl.current;
    const url = URL.createObjectURL(blob);
    const cleanup = () => { a.onended = a.onerror = null; URL.revokeObjectURL(url); playbackRef.current = null; };
    playbackRef.current = { stop: () => { a.pause(); cleanup(); resolve(); } };
    a.onended = () => { cleanup(); resolve(); };
    a.onerror = () => { cleanup(); reject(new Error("Audio konnte nicht abgespielt werden.")); };
    a.src = url;
    a.play().catch((e) => { cleanup(); reject(e); });
  }), []);

  const speakBrowser = useCallback((text, voice) => new Promise((resolve, reject) => {
    const synth = window.speechSynthesis;
    if (!synth) { reject(new Error("Dieser Browser hat keine Sprachausgabe.")); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const bv = pickBrowserVoice(voice);
    if (bv) { u.voice = bv; u.lang = bv.lang; } else u.lang = "de-CH";
    u.pitch = voice.gender === "w" ? 1.15 : 0.85;
    u.rate = 0.95;
    playbackRef.current = { stop: () => { synth.cancel(); resolve(); } };
    u.onend = () => { playbackRef.current = null; resolve(); };
    u.onerror = (e) => { playbackRef.current = null; e.error === "canceled" || e.error === "interrupted" ? resolve() : reject(new Error(`Sprachausgabe: ${e.error}`)); };
    synth.speak(u);
  }), []);

  const speak = useCallback(async (text, msgId, voice) => {
    const clean = text.replace(/[*_#`>~]/g, "").trim();
    if (!clean) return;
    stopSpeaking();
    setSpeakingId(msgId);
    setStatus("speaking");
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      if (settings.service === "browser") await speakBrowser(clean, voice);
      else {
        let blob;
        try {
          blob = settings.service === "fhnw"
            ? await fhnwTts(settings.fhnw, clean, voice, dialect, ctl.signal)
            : await suisseTts(settings.suisse, keys.suisse, clean, voice, dialect, ctl.signal);
        } catch (e) {
          if (e?.name === "AbortError") return;
          if (!settings.browserFallback) throw e;
          setNotice(`Sprachausgabe des Dienstes fehlgeschlagen (${e.message}) – Browser-Stimme als Ersatz.`);
          await speakBrowser(clean, voice);
          return;
        }
        await playBlob(blob);
      }
    } catch (e) {
      if (e?.name === "NotAllowedError") setNotice("Der Browser hat die automatische Wiedergabe blockiert. Tippe auf ▶ bei der Antwort.");
      else if (e?.name !== "AbortError") setNotice(`Sprachausgabe: ${e.message}`);
    } finally {
      setSpeakingId((cur) => (cur === msgId ? null : cur));
      setStatus((s) => (s === "speaking" ? "idle" : s));
    }
  }, [settings, keys.suisse, dialect, playBlob, speakBrowser, stopSpeaking]);

  /* ---- Nachricht senden ---- */
  const sendText = useCallback(async (text) => {
    const clean = text.trim();
    if (!clean) { setStatus("idle"); return; }
    const userMsg = { id: nextId(), role: "user", text: clean };
    const history = buildHistory([...messagesRef.current, userMsg]);
    setMessages((m) => [...m, userMsg]);
    setStatus("thinking");
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      const reply = await askClaude({ apiKey: keys.anthropic, model: settings.model, system: buildSystemPrompt(dialect), history, signal: ctl.signal });
      const voice = resolveVoice();
      const botMsg = { id: nextId(), role: "assistant", text: reply, dialect: dialect.name, voice };
      setMessages((m) => [...m, botMsg]);
      if (settings.autoSpeak) await speak(reply, botMsg.id, voice);
      else setStatus("idle");
    } catch (e) {
      if (e?.name === "AbortError") { setStatus("idle"); return; }
      setMessages((m) => [...m, { id: nextId(), role: "assistant", error: true, text: e.message }]);
      setStatus("idle");
    }
  }, [keys.anthropic, settings.model, settings.autoSpeak, dialect, resolveVoice, speak]);

  /* ---- Aufnahme ---- */
  const cleanupRec = useCallback(() => {
    const r = recRef.current;
    if (!r) return;
    cancelAnimationFrame(r.raf);
    r.stream?.getTracks().forEach((t) => t.stop());
    r.ctx?.close?.();
    recRef.current = null;
    setLevel(0);
  }, []);

  const startRecording = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    wantStopRef.current = false;
    setNotice("");
    stopSpeaking();
    abortRef.current?.abort();
    // Audio-Element durch die Nutzergeste freischalten (iOS/Safari)
    try { const a = audioEl.current; a.src = URL.createObjectURL(encodeWav(new Float32Array(160), 16000)); a.play().catch(() => {}); } catch { /* egal */ }

    try {
      if (settings.service === "browser") {
        const stt = startBrowserStt();
        recRef.current = { browser: stt, startedAt: Date.now() };
        setStatus("recording");
        if (wantStopRef.current) await finishRef.current();
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Mikrofon nicht verfügbar – die Seite muss über HTTPS geöffnet werden.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mime = pickMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const rec = { stream, mr, chunks, ctx, startedAt: Date.now(), raf: 0, mime: mr.mimeType || mime || "audio/webm" };
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x; }
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        rec.raf = requestAnimationFrame(tick);
      };
      recRef.current = rec;
      mr.start();
      tick();
      setStatus("recording");
      if (wantStopRef.current) await finishRef.current();
    } catch (e) {
      cleanupRec();
      busyRef.current = false;
      setStatus("idle");
      setNotice(e.name === "NotAllowedError" ? "Mikrofon-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben." : e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.service, stopSpeaking, cleanupRec]);

  const finishRecording = useCallback(async () => {
    const rec = recRef.current;
    if (!rec) { wantStopRef.current = true; return; } // Loslassen vor Start (Berechtigungsdialog)
    const tooShort = Date.now() - rec.startedAt < 500;
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      let text = "";
      if (rec.browser) {
        setStatus("transcribing");
        text = await rec.browser.stop();
        recRef.current = null;
      } else {
        const blob = await new Promise((resolve) => {
          rec.mr.onstop = () => resolve(new Blob(rec.chunks, { type: rec.mime }));
          if (rec.mr.state !== "inactive") rec.mr.stop(); else resolve(new Blob(rec.chunks, { type: rec.mime }));
        });
        cleanupRec();
        if (tooShort || blob.size < 1000) { setNotice("Zu kurz – bitte Taste gedrückt halten und reden."); setStatus("idle"); busyRef.current = false; return; }
        setStatus("transcribing");
        const wav = await blobToWav16k(blob);
        text = settings.service === "fhnw"
          ? await fhnwStt(settings.fhnw, wav, ctl.signal)
          : await suisseStt(settings.suisse, keys.suisse, wav, ctl.signal);
      }
      if (!text) { setNotice("Nichts verstanden – bitte nochmals versuchen."); setStatus("idle"); busyRef.current = false; return; }
      busyRef.current = false;
      await sendText(text);
    } catch (e) {
      cleanupRec();
      if (e?.name !== "AbortError") setMessages((m) => [...m, { id: nextId(), role: "assistant", error: true, text: `Spracherkennung: ${e.message}` }]);
      setStatus("idle");
    } finally {
      busyRef.current = false;
    }
  }, [settings.service, settings.fhnw, settings.suisse, keys.suisse, sendText, cleanupRec]);

  finishRef.current = finishRecording;

  const cancelAll = useCallback(() => {
    abortRef.current?.abort();
    recRef.current?.browser?.abort?.();
    recRef.current?.mr?.state === "recording" && recRef.current.mr.stop();
    cleanupRec();
    stopSpeaking();
    busyRef.current = false;
    setStatus("idle");
  }, [cleanupRec, stopSpeaking]);

  /* ---- Push-to-Talk-Bedienung ---- */
  const recording = status === "recording";
  const working = status === "transcribing" || status === "thinking";

  const onPointerDown = (e) => {
    if (settings.pttMode !== "hold" || working) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    startRecording();
  };
  const onPointerUp = () => {
    if (settings.pttMode !== "hold") return;
    if (recRef.current || busyRef.current) finishRecording();
  };
  const onClick = () => {
    if (settings.pttMode !== "toggle" || working) return;
    if (recording) finishRecording(); else startRecording();
  };

  // Leertaste als Push-to-Talk (nicht beim Tippen in Feldern)
  useEffect(() => {
    if (view !== "chat") return undefined;
    const typing = (t) => t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    const down = (e) => {
      if (e.code !== "Space" || e.repeat || typing(e.target) || working) return;
      e.preventDefault();
      if (settings.pttMode === "toggle") { if (recording) finishRecording(); else startRecording(); } else startRecording();
    };
    const up = (e) => {
      if (e.code !== "Space" || typing(e.target) || settings.pttMode !== "hold") return;
      if (recRef.current || busyRef.current) finishRecording();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [view, settings.pttMode, recording, working, startRecording, finishRecording]);

  const submitDraft = (e) => {
    e.preventDefault();
    if (working || recording || !draft.trim()) return;
    const t = draft;
    setDraft("");
    stopSpeaking();
    sendText(t);
  };

  const clearChat = () => { cancelAll(); setMessages([]); setNotice(""); };

  const statusLabel = status === "idle" ? (settings.pttMode === "hold" ? STATUS.idle : STATUS.idleToggle) : STATUS[status];
  const serviceName = { fhnw: "FHNW", suisse: "Suisse Line", browser: "Browser" }[settings.service];

  /* ---- Render ---- */
  return (
    <div className="h-[100dvh] w-full bg-stone-950 text-stone-100 antialiased overflow-hidden">
      {view === "settings" ? (
        <SettingsView settings={settings} setSettings={setSettings} keys={keys} setKeys={setKeys} onBack={() => setView("chat")} onClear={clearChat} />
      ) : (
        <div className="flex flex-col h-full max-w-2xl mx-auto">
          {/* Kopf */}
          <header className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-stone-800 space-y-3">
            <div className="flex items-center gap-3">
              <SwissCross className="w-8 h-8 shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-semibold leading-tight">Mundart-Assistent</h1>
                <p className="text-xs text-stone-400 truncate">Dienst: {serviceName} · {dialect.label}</p>
              </div>
              <button onClick={() => setView("settings")} className="p-2.5 rounded-lg hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-red-500" aria-label="Einstellungen">{Icon.gear()}</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="sr-only">Dialekt</span>
                <select className={inputCls} value={settings.dialect} onChange={(e) => setSettings((s) => ({ ...s, dialect: e.target.value }))} aria-label="Dialekt">
                  {DIALECTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="sr-only">Stimme</span>
                <select className={inputCls} value={settings.voice} onChange={(e) => setSettings((s) => ({ ...s, voice: e.target.value }))} aria-label="Stimme">
                  <option value="auto-m">Auto · männlich</option>
                  <option value="auto-w">Auto · weiblich</option>
                  <option value="random">🎲 Zufallsstimme</option>
                  {Object.entries(REGIONS).map(([rid, rname]) => (
                    <optgroup key={rid} label={rname}>
                      {VOICES.filter((v) => v.region === rid).map((v) => <option key={v.id} value={v.id}>{v.gender === "m" ? "männlich" : "weiblich"} · {rname}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>
          </header>

          {/* Verlauf */}
          <main ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" aria-live="polite">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center text-stone-400 px-6 gap-2">
                <p className="text-lg text-stone-200">Sag öppis!</p>
                <p className="text-sm leading-relaxed">
                  {settings.pttMode === "hold" ? "Taste gedrückt halten, auf Schweizerdeutsch reden und loslassen." : "Auf die Taste tippen, reden und nochmals tippen."}
                  {" "}Die Antwort kommt in {dialect.label} – geschrieben und gesprochen.
                </p>
                {!keys.anthropic && (
                  <button className="mt-3 rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-red-300" onClick={() => setView("settings")}>
                    Zuerst API-Schlüssel eintragen
                  </button>
                )}
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words ${
                  m.error ? "bg-red-950/60 border border-red-800 text-red-200"
                    : m.role === "user" ? "bg-red-600 text-white rounded-br-md" : "bg-stone-800 text-stone-100 rounded-bl-md"}`}>
                  {m.text}
                  {m.role === "assistant" && !m.error && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-stone-700/70 text-xs text-stone-400">
                      <button
                        onClick={() => (speakingId === m.id ? stopSpeaking() : speak(m.text, m.id, m.voice || resolveVoice()))}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-stone-700 hover:bg-stone-600 text-stone-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                        aria-label={speakingId === m.id ? "Wiedergabe stoppen" : "Antwort vorlesen"}>
                        {speakingId === m.id ? Icon.stop() : Icon.play()}
                      </button>
                      <span>{m.voice ? `Stimme: ${m.voice.label}` : m.dialect}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {working && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-stone-800 px-4 py-3 text-stone-400 text-sm">{STATUS[status]}</div>
              </div>
            )}
          </main>

          {/* Eingabe */}
          <footer className="border-t border-stone-800 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3 bg-stone-950">
            {notice && (
              <div role="status" className="flex items-start gap-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                <span className="flex-1 leading-relaxed">{notice}</span>
                <button onClick={() => setNotice("")} className="text-amber-300 hover:text-white px-1" aria-label="Hinweis schliessen">✕</button>
              </div>
            )}

            <div className="flex flex-col items-center gap-2">
              <div className="relative flex items-center justify-center h-32 w-32 sm:h-28 sm:w-28">
                {recording && <span className="absolute inset-0 rounded-full bg-red-500/30 transition-transform duration-75" style={{ transform: `scale(${1 + level * 0.55})` }} />}
                <button
                  onPointerDown={onPointerDown}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onClick={onClick}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={working}
                  aria-pressed={recording}
                  aria-label={statusLabel}
                  className={`relative h-28 w-28 sm:h-24 sm:w-24 rounded-full flex items-center justify-center text-white shadow-lg select-none touch-none transition-colors focus:outline-none focus:ring-4 focus:ring-red-300/50 disabled:opacity-60 ${
                    recording ? "bg-red-500" : "bg-red-600 hover:bg-red-500 active:bg-red-500"}`}>
                  {Icon.mic("w-12 h-12")}
                </button>
              </div>
              <p className="text-sm text-stone-300 h-5">{statusLabel}</p>
              {(status === "speaking" || working || recording) && (
                <button onClick={cancelAll} className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-white underline underline-offset-2">
                  {Icon.stop("w-3 h-3")} Abbrechen
                </button>
              )}
            </div>

            <form onSubmit={submitDraft} className="flex gap-2">
              <input className={inputCls} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="… oder tippen" aria-label="Nachricht tippen" enterKeyHint="send" />
              <button type="submit" disabled={!draft.trim() || working || recording} className={`${btnCls} px-3`} aria-label="Senden">{Icon.send()}</button>
            </form>
          </footer>
        </div>
      )}
    </div>
  );
}
