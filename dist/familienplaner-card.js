/*
 * Familienplaner – Lovelace-Karte für Home Assistant
 * Wochenplan nach Person (Kalender), Essensplan, Einkaufsliste (z. B. Bring!), Ämtli mit Sternen,
 * Abfall, Schulferien, Feiertage, Geburtstage/Countdowns, Wetter, Pinnwand, Bilder auf Terminen.
 * Hochformat zuerst, Querformat umschaltbar.
 * Lizenz: PolyForm Noncommercial 1.0.0 – nicht-kommerzielle Nutzung frei, Verkauf nicht erlaubt (siehe LICENSE).
 */
(() => {
  const VERSION = "1.4.2";
  if (customElements.get("familienplaner-card")) return;

  // ---------- Schrift ----------
  if (!document.getElementById("fp-fonts")) {
    const l = document.createElement("link");
    l.id = "fp-fonts";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Figtree:wght@400;500;600;700&family=Caveat:wght@500;700&display=swap";
    document.head.appendChild(l);
  }

  // ---------- Hilfen ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Für url("…") in CSS: Zeichen, die aus der Zeichenkette ausbrechen könnten, kodieren
  const cssUrl = (s) => String(s).replace(/["'()\\\s<>]/g, (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase());
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
  const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const sow = (d) => { const x = sod(d); return addDays(x, -((x.getDay() + 6) % 7)); };
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const WDL = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const MO = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const MOS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  const kw = (d) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 864e5 + 1) / 7); };
  const daysUntil = (d) => Math.round((sod(d) - sod(new Date())) / 864e5);
  const inTage = (n) => (n === 0 ? "heute" : n === 1 ? "morgen" : `in ${n} Tagen`);

  // Feiertage: Ostern wird berechnet. Welche gelten, bestimmt die Option «feiertage».
  const easter = (y) => { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return new Date(y, mo - 1, da); };
  const FEIERTAG_DEF = {
    neujahr: (y) => [new Date(y, 0, 1), "Neujahr"],
    berchtoldstag: (y) => [new Date(y, 0, 2), "Berchtoldstag"],
    heilige_drei_koenige: (y) => [new Date(y, 0, 6), "Heilige Drei Könige"],
    josefstag: (y) => [new Date(y, 2, 19), "Josefstag"],
    karfreitag: (y, e) => [addDays(e, -2), "Karfreitag"],
    ostermontag: (y, e) => [addDays(e, 1), "Ostermontag"],
    tag_der_arbeit: (y) => [new Date(y, 4, 1), "Tag der Arbeit"],
    auffahrt: (y, e) => [addDays(e, 39), "Auffahrt"],
    pfingstmontag: (y, e) => [addDays(e, 50), "Pfingstmontag"],
    fronleichnam: (y, e) => [addDays(e, 60), "Fronleichnam"],
    bundesfeier: (y) => [new Date(y, 7, 1), "Bundesfeier"],
    tag_der_deutschen_einheit: (y) => [new Date(y, 9, 3), "Tag der Deutschen Einheit"],
    nationalfeiertag_at: (y) => [new Date(y, 9, 26), "Nationalfeiertag"],
    maria_himmelfahrt: (y) => [new Date(y, 7, 15), "Mariä Himmelfahrt"],
    allerheiligen: (y) => [new Date(y, 10, 1), "Allerheiligen"],
    maria_empfaengnis: (y) => [new Date(y, 11, 8), "Mariä Empfängnis"],
    weihnachten: (y) => [new Date(y, 11, 25), "Weihnachten"],
    stephanstag: (y) => [new Date(y, 11, 26), "Stephanstag"],
  };
  let FEIERTAGE = ["neujahr", "berchtoldstag", "karfreitag", "ostermontag", "auffahrt", "pfingstmontag", "bundesfeier", "weihnachten", "stephanstag"];
  let EIGENE_FEIERTAGE = [];   // z. B. [{datum: "2026-07-03", name: "Dorffest"}]
  let holidayCache = {};
  const holidays = (y) => {
    if (holidayCache[y]) return holidayCache[y];
    const e = easter(y);
    const map = {};
    FEIERTAGE.forEach((k) => { const f = FEIERTAG_DEF[k]; if (f) { const [d, n] = f(y, e); map[ymd(d)] = n; } });
    EIGENE_FEIERTAGE.forEach((f) => { if (f && f.datum && String(f.datum).startsWith(String(y))) map[String(f.datum)] = f.name || "Feiertag"; });
    return (holidayCache[y] = map);
  };
  const holidayOn = (d) => holidays(d.getFullYear())[ymd(d)];

  // Schulferien: aus der Option «schulferien» (Liste) und/oder «schulferien_kalender» (Kalender mit ganztägigen Terminen)
  let FERIEN = [];        // [von, bis, name] als JJJJ-MM-TT, «bis» inklusive
  let FERIEN_KAL = [];    // dieselbe Form, aus Kalendern geladen
  const alleFerien = () => [...FERIEN, ...FERIEN_KAL].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const ferienOn = (d) => { const s = ymd(d); const f = alleFerien().find(([a, b]) => s >= a && s <= b); return f ? f[2] : null; };

  const ABFALL = {
    Kehricht: { icon: "mdi:trash-can", color: "#5c6573" },
    "Grüngut": { icon: "mdi:leaf", color: "#2f9e44" },
    Papier: { icon: "mdi:newspaper-variant-outline", color: "#1c7ed6" },
    Karton: { icon: "mdi:package-variant-closed", color: "#a0703c" },
    Metall: { icon: "mdi:nail", color: "#7a8796" },
    Glas: { icon: "mdi:bottle-wine-outline", color: "#0c8599" },
    Bioabfall: { icon: "mdi:leaf", color: "#2f9e44" },
    "Gelber Sack": { icon: "mdi:recycle", color: "#f08c00" },
    Restmüll: { icon: "mdi:trash-can", color: "#5c6573" },
    Altpapier: { icon: "mdi:newspaper-variant-outline", color: "#1c7ed6" },
    Sonderabfall: { icon: "mdi:biohazard", color: "#c92a2a" },
  };

  const WX = {
    "clear-night": "mdi:weather-night", cloudy: "mdi:weather-cloudy", exceptional: "mdi:alert-circle-outline", fog: "mdi:weather-fog",
    hail: "mdi:weather-hail", lightning: "mdi:weather-lightning", "lightning-rainy": "mdi:weather-lightning-rainy", partlycloudy: "mdi:weather-partly-cloudy",
    pouring: "mdi:weather-pouring", rainy: "mdi:weather-rainy", snowy: "mdi:weather-snowy", "snowy-rainy": "mdi:weather-snowy-rainy",
    sunny: "mdi:weather-sunny", windy: "mdi:weather-windy", "windy-variant": "mdi:weather-windy-variant",
  };

  // Foto-Themen (Unsplash, frei verwendbar). Reihenfolge = Vorrang: das erste passende Thema gewinnt.
  const THEMEN = [
    ["Nachtschicht", "nachtdienst|nachtschicht|\\bnacht\\b", "1506606401543-2e73709cebb4"],
    ["Laternenumzug", "laterne|räbeliechtli|räbe", "1628024564458-b3dfcceb3f34"],
    ["Weihnachten", "weihnacht|christkind|samichlaus", "1514377006585-6e7975371bd6"],
    ["1. August", "1\\.\\s?august|bundesfeier", "1549194400-06e6874c2fd1"],
    ["Ferien", "ferien|urlaub|hotel", "1531129630896-1744cab0cafd"],
    ["Elternabend / Schule", "eltern|besuchstag|schule|schulreise", "1580582932707-520aed937b7b"],
    ["Kindergarten Wald", "wald", "1647627611823-d08fa901678e"],
    ["Turnen", "turnen|kinderturnen|muki|vaki", "1655842556539-db2d2099ded1"],
    ["Ballett / Tanz", "ballett|dance|tanz", "1555656220-46e30749d330"],
    ["Kindergarten", "kindergarten|kiga|chindsgi", "1588075592446-265fd1e6e76f"],
    ["Spielgruppe", "spielgruppe", "1484820540004-14229fe36ca4"],
    ["Hüten / Grosseltern", "hüete|hueten|hüten|grosi|grossmami|grosspapi|\\boma\\b|\\bopa\\b|nonna", "1593100126453-19b562a800c1"],
    ["Haustiere füttern", "hase|kaninchen|katze|meerschwein|füttern", "1729172311760-f50e9ec48b35"],
    ["Physio / Therapie", "physio|osteo|therapie|massage", "1649751361457-01d3a696c7e6"],
    ["Zahnarzt", "zahnarzt|dentalhygiene", "1598256989800-fe5f95da9787"],
    ["Augen", "auge", "1576210117723-cd06449a467d"],
    ["Arzt", "arzt|doktor|impf|spital|klinik", "1632053002928-1919605ee6f7"],
    ["Coiffeur", "coiffeur|friseur|haare schneiden", "1704072650662-76df3af134a7"],
    ["Geburtstag", "geburi|geburtstag|🎂|🎁", "1545696563-af8f6ec2295a"],
    ["Kürbis", "kürbis", "1570586437263-ab629fccc818"],
    ["Europa-Park", "europapark|europa-park|freizeitpark", "1628835788312-41d61f5ddce8"],
    ["Reisen / Flug", "reise|flug|flughafen|airport|abreise", "1436491865332-7a61a109cc05"],
    ["Zug / Bahn", "\\bzug\\b|zugfahrt|bahnhof|\\bsbb\\b|\\bbahn\\b", "1593186344142-ef775a6e596f"],
    ["Umzug", "\\bumzug|zügeln|umziehen", "1714647211902-bb711d643a17"],
    ["Zoo / Tierpark", "zoo|tierpark|affen|wildpark", "1535489158666-8d856534a6ef"],
    ["Kino", "kino|movie|film", "1578849278619-e73505e9610f"],
    ["Jahrestag / Date", "jahrestag|\\bdate\\b|dinner|❤️|valentin", "1513279922550-250c2129b13a"],
    ["Konzert / Theater", "konzert|concert|musical|theater|\\boper\\b", "1470229722913-7c0e2dbbafd3"],
    ["Fest / Party", "fest|party|feier|apéro|apero", "1504196606672-aef5c9cefc92"],
    ["Essen", "zmittag|essen|brunch|restaurant|znacht|brötle|grill|picknick", "1600891964599-f61ba0e24092"],
    ["Garage / Werkstatt", "garage|werkstatt|reifen|pneu|\\bmfk\\b|\\btüv\\b|auto\\s*service", "1727893119356-1702fe921cf9"],
    ["Handwerker / Service", "boiler|handwerker|reparatur|installat|elektriker|zähler|monteur|sanitär|heizung|maler\\b|schreiner|service", "1426927308491-6380b6a9936f"],
    ["Auto laden", "\\bladen\\b|ladestation|wallbox|batterie|e-auto", "1593941707874-ef25b8b4a92b"],
    ["Auto", "\\bauto\\b|autowasch|waschanlage|tanken|vignette", "1683444126212-50c0aa2a421b"],
    ["Einkauf", "einkauf|ikea|migros|coop|denner|\\blidl\\b|\\baldi\\b|shopping|\\bdm\\b|baumarkt|jumbo|hornbach", "1670684684445-a4504dca0bbc"],
    ["Meeting", "meeting|sitzung|besprechung|gespräch|\\bcall\\b|teams|zoom|termin mit", "1542744173-8e7e53415bb0"],
    ["Notar / Vertrag", "notar|vertrag|unterschrift", "1450101499163-c8848c66ca85"],
    ["Büro", "büro|buero|fokus|office", "1497215728101-856f4ea42174"],
    ["Kurs / Weiterbildung", "weiterbildung|kurs|schulung|seminar|workshop|vortrag", "1524178232363-1fb2b075b655"],
    ["Schwimmen", "schwimm|badi", "1592484806287-7bc9c8af5405"],
    ["Fussball", "fussball|fußball|tschutten", "1622659097972-68f1d8c1829f"],
    ["Reiten", "reiten|pony|pferd", "1718045330352-7b800f3bba80"],
    ["Musik", "musik|klavier|gitarre|flöte|singen", "1577877777751-3f1ec20a0715"],
    ["Malen / Basteln", "\\bmalen|basteln|zeichnen|werken", "1605627079912-97c3810a11a4"],
    ["Spielplatz", "spielplatz", "1596997000103-e597b3ca50df"],
    ["Velo", "velo|fahrrad", "1629056007607-f3e5de821891"],
    ["Ski / Schnee", "\\bski|schlitteln|schnee", "1631779202803-7f1415c87a9d"],
    ["Bibliothek", "bibliothek|ludothek|bücherei", "1767356326735-2da0a10cf1f0"],
    ["Garten", "garten|rasen|dünger|hecke|mähen|pflanzen|gärtner", "1642541744624-7a2a89545a32"],
    ["Hund", "hund|gassi|tierarzt|hundeschule", "1517849845537-4d257902454a"],
    ["Wandern / Ausflug", "wander|ausflug|\\balp\\b|berg\\b|bergtour", "1527095655060-4026c4af2b25"],
    ["Fitness / Sport", "fitness|\\bgym\\b|training|joggen|\\blauf|lauf\\b|crossfit|sport", "1534438327276-14e5300c3a48"],
    ["Familie", "familie|family", "1679274742187-1aa949703203"],
    ["Putzen", "putzen|reinigung|putzfrau|fensterputz", "1563453392212-326f5e854473"],
  ].map(([name, keys, id]) => ({ name, keys, re: new RegExp(keys, "i"), url: `https://images.unsplash.com/photo-${id}?w=640&h=320&fit=crop&q=70` }));
  // Belohnungen zum schnellen Wählen: [Text, Emoji, Sterne]
  const BELOHNUNGEN = [
    ["Lolli", "🍭", 3], ["Gummibärli", "🐻", 3], ["Sticker", "⭐", 3], ["Seifenblasen", "🫧", 4], ["Ballon", "🎈", 4],
    ["Schoggi", "🍫", 4], ["Glace", "🍦", 5], ["Pommes", "🍟", 5], ["Heftli", "📖", 6], ["Malbuch", "🖍️", 6],
    ["Spielzeugauto", "🚗", 8], ["Spielfigur", "🦖", 8], ["Hörspiel", "🎧", 8], ["Puzzle", "🧩", 8], ["Buch", "📚", 10],
    ["Länger aufbleiben", "🌙", 6], ["Kuchen backen", "🧁", 8], ["Pizza essen", "🍕", 10], ["Freund einladen", "👫", 10],
    ["Spielplatz", "🛝", 6], ["Badi", "🏊", 10], ["Velotour", "🚲", 10], ["Kino", "🎬", 15], ["Zoo", "🦁", 20], ["Ausflug", "🚂", 20],
  ];
  const EMOJI_WAHL = ["🧸", "🏫", "🧩", "🌲", "🤸", "🏊", "⚽", "🩰", "🐴", "🎵", "🎨", "🦷", "🩺", "✂️", "🎂", "🎉", "👵", "👴", "🦁", "🎬", "📚", "🚲", "⛷️", "🏖️", "🚗", "🚆", "🛝", "🌙", "🍎", "🛒", "🐶", "⭐", "🍭", "🍫", "🍦", "🍟", "🍕", "🧁", "🎈", "🫧", "📖", "🖍️", "🧩", "🦖", "🎧", "👫", "🏊", "🎁"];

  const WXDE = {
    "clear-night": "Klar", cloudy: "Bewölkt", exceptional: "Unwetter", fog: "Nebel", hail: "Hagel", lightning: "Gewitter",
    "lightning-rainy": "Gewitter mit Regen", partlycloudy: "Teilweise bewölkt", pouring: "Starkregen", rainy: "Regen",
    snowy: "Schnee", "snowy-rainy": "Schneeregen", sunny: "Sonnig", windy: "Windig", "windy-variant": "Windig, bewölkt",
  };
  const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* egal */ } };

  // ---------- Karte ----------
  class FamilienplanerCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._view = lsGet("fp-view", "woche");
      this._orient = lsGet("fp-orient", "auto");
      this._anchor = sod(new Date());
      this._hidden = new Set((() => { try { const v = JSON.parse(lsGet("fp-hidden", "[]")); return Array.isArray(v) ? v : []; } catch (e) { return []; } })());
      this._events = {};       // key -> [events]
      this._range = null;
      this._todos = {};        // entity -> items
      this._forecast = [];
      this._sig = "";
      this._shopList = lsGet("fp-shop", "");
      this._suggest = [];
      this._busy = false;
      this._msg = "";
    }

    static getStubConfig() { return {}; }
    getCardSize() { return 12; }

    setConfig(config) {
      const def = {
        personen: [
          { name: "Person 1", farbe: "#d6336c", foto: "input_text.fp_foto_1", kalender: [], aemtli: "Ämtli Person 1", bilder: true },
          { name: "Person 2", farbe: "#e8590c", foto: "input_text.fp_foto_2", kalender: [], aemtli: "Ämtli Person 2", bilder: true },
          { name: "Person 3", farbe: "#2b8a3e", foto: "input_text.fp_foto_3", kalender: [], aemtli: "Ämtli Person 3", bilder: true, sterne: "counter.fp_sterne_3" },
          { name: "Person 4", farbe: "#7048e8", foto: "input_text.fp_foto_4", kalender: [], aemtli: "Ämtli Person 4", bilder: true, sterne: "counter.fp_sterne_4" },
        ],
        familie: { name: "Familie", farbe: "#1971c2", kalender: [] },
        schulferien: [],
        schulferien_kalender: [],
        feiertage: null,
        eigene_feiertage: [],
        geburtstage: ["Geburtstag"],
        essensplan: "Essensplan",
        countdowns: "Countdowns",
        bilderliste: "Planer Bilder",
        bring: [],
        wetter: "weather.forecast_home",
        abfall: "sensor.familienplaner_abfall",
        notiz: "input_text.fp_notiz",
        zuhause_link: null,
        zuhause_name: "Zuhause",
        dunkel: "auto",
      };
      this._config = { ...def, ...config };
      FERIEN = (this._config.schulferien || []).filter((f) => f && f.von && f.bis).map((f) => [String(f.von), String(f.bis), f.name || "Ferien"]);
      if (Array.isArray(this._config.feiertage)) FEIERTAGE = this._config.feiertage.map((k) => String(k).toLowerCase());
      EIGENE_FEIERTAGE = this._config.eigene_feiertage || [];
      holidayCache = {};
      // Kopien, damit Farben am Tablet geändert werden können (Original bleibt als Standard)
      this._config.personen = (this._config.personen || []).map((p) => ({ ...p, farbeStandard: p.farbe }));
      this._render();
    }

    connectedCallback() {
      this._tick = setInterval(() => this._clock(), 15000);
      this._poll = setInterval(() => { this._refreshCalendars(true); this._pollN = (this._pollN || 0) + 1; if (this._pollN % 6 === 0) this._loadExtras(); }, 5 * 60000);
      this._mq = window.matchMedia("(orientation: landscape)");
      this._mqH = () => this._render();
      this._rsH = () => this._render();
      window.addEventListener("resize", this._rsH);
      this._mq.addEventListener?.("change", this._mqH);
      if (this._hass) this._subscribeWeather();
    }

    disconnectedCallback() {
      clearInterval(this._tick); clearInterval(this._poll);
      this._mq?.removeEventListener?.("change", this._mqH);
      window.removeEventListener("resize", this._rsH);
      if (this._unsubWx) { this._unsubWx.then((u) => u && u()).catch(() => {}); this._unsubWx = null; }
    }

    set hass(hass) {
      const first = !this._hass;
      this._hass = hass;
      if (first) { this._subscribeWeather(); this._refreshAll(); }
      // Nur neu zeichnen, wenn sich etwas Relevantes geändert hat
      const ids = this._watchIds();
      const sig = ids.map((id) => { const s = hass.states[id]; return s ? s.state + "|" + (s.last_updated || "") : "-"; }).join(";");
      if (sig !== this._sig) {
        const old = this._sigMap || {};
        const map = {};
        ids.forEach((id) => (map[id] = hass.states[id]?.state));
        this._sigMap = map;
        this._sig = sig;
        if (!first) {
          // geänderte Listen neu laden
          ids.filter((id) => id.startsWith("todo.") && old[id] !== map[id]).forEach((id) => this._loadTodo(id));
          const calsNow = this._allCalendars().join(",");
          if (calsNow !== this._calSig) this._refreshCalendars(true);
        }
        this._render();
      }
    }

    // ---------- Auflösen von Entitäten ----------
    _findByName(domain, name) {
      if (!this._hass || !name) return null;
      const n0 = Object.keys(this._hass.states).length;
      if (!this._rc || this._rcN !== n0 || Date.now() - this._rcT > 60000) { this._rc = {}; this._rcN = n0; this._rcT = Date.now(); }
      const ck = domain + "|" + name;
      if (ck in this._rc) return this._rc[ck];
      return (this._rc[ck] = this._findByNameRaw(domain, name));
    }
    _findByNameRaw(domain, name) {
      if (name.startsWith(domain + ".")) return this._hass.states[name] ? name : null;
      const n = name.toLowerCase();
      const ids = Object.keys(this._hass.states).filter((id) => id.startsWith(domain + "."));
      const exact = ids.find((id) => (this._hass.states[id].attributes.friendly_name || "").toLowerCase() === n);
      if (exact) return exact;
      return ids.find((id) => (this._hass.states[id].attributes.friendly_name || "").toLowerCase().includes(n) || id.includes(n.replace(/\s+/g, "_"))) || null;
    }
    _cals(list) { return [...new Set((list || []).map((n) => this._findByName("calendar", n)).filter(Boolean))]; }
    _allCalendars() {
      const c = this._config;
      return [
        ...c.personen.flatMap((p) => this._cals(p.kalender)), ...this._cals(c.familie?.kalender),
        ...this._cals(c.geburtstage), ...this._cals([c.essensplan]),
      ];
    }
    _bringLists() {
      const c = this._config;
      if (c.bring && c.bring.length) return c.bring.filter((id) => this._hass.states[id]);
      return Object.keys(this._hass.states).filter((id) => id.startsWith("todo.") && this._hass.entities?.[id]?.platform === "bring");
    }
    _aemtliId(p) { return this._findByName("todo", p.aemtli); }
    _watchIds() {
      if (!this._hass) return [];
      const c = this._config;
      const ids = [c.wetter, c.abfall, c.notiz, "sun.sun"];
      c.personen.forEach((p) => { ids.push(p.foto); if (p.sterne) ids.push(p.sterne); const a = this._aemtliId(p); if (a) ids.push(a); });
      const cd = this._findByName("todo", c.countdowns); if (cd) ids.push(cd);
      const bl = this._bildListe(); if (bl) ids.push(bl);
      ids.push(...this._bringLists());
      ids.push(...this._allCalendars());
      return ids.filter(Boolean);
    }

    // ---------- Daten laden ----------
    _visibleRange() {
      const a = this._anchor;
      if (this._view === "tag") return [a, addDays(a, 1)];
      if (this._view === "monat") { const f = sow(new Date(a.getFullYear(), a.getMonth(), 1)); return [f, addDays(f, 42)]; }
      const today = sod(new Date());
      const s0 = sow(a);
      const s = today >= s0 && today < addDays(s0, 7) ? today : s0;   // laufende Woche: ab heute
      return [s, addDays(s, this._weekDays || 7)];
    }

    async _refreshAll() {
      this._refreshCalendars(true);
      this._loadTodos();
      this._loadExtras();
    }

    async _fetchCal(id, start, end) {
      const q = `calendars/${id}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
      try {
        const res = await this._hass.callApi("GET", q);
        return res.map((e) => this._norm(e, id));
      } catch (err) { console.warn("Familienplaner: Kalender", id, err); return []; }
    }

    _norm(e, cal) {
      const allDay = !!(e.start && e.start.date && !e.start.dateTime);
      const start = allDay ? parseYmd(e.start.date) : new Date(e.start.dateTime || e.start);
      let end = allDay ? parseYmd(e.end.date) : new Date(e.end.dateTime || e.end);
      if (!(end > start)) end = allDay ? addDays(start, 1) : new Date(start.getTime() + 30 * 60000);
      return { title: e.summary || "(ohne Titel)", start, end, allDay, cal, uid: e.uid, rid: e.recurrence_id, location: e.location, description: e.description };
    }

    async _refreshCalendars(force) {
      if (!this._hass || !this._config) return;
      const [s, e] = this._visibleRange();
      const key = `${ymd(s)}_${ymd(e)}`;
      if (!force && this._reqKey === key) return;
      this._reqKey = key;
      const c = this._config;
      const groups = { familie: this._cals(c.familie?.kalender), essen: this._cals([c.essensplan]) };
      c.personen.forEach((p, i) => (groups["p" + i] = this._cals(p.kalender)));
      this._calSig = this._allCalendars().join(",");
      const seq = (this._calSeq = (this._calSeq || 0) + 1);
      const out = {};
      await Promise.all(Object.entries(groups).map(async ([g, ids]) => {
        const lists = await Promise.all(ids.map((id) => this._fetchCal(id, s, e)));
        out[g] = lists.flat().sort((a, b) => a.start - b.start);
      }));
      if (seq !== this._calSeq) return;   // inzwischen wurde ein neuerer Bereich angefragt
      this._events = out;
      this._range = key;
      this._render();
    }

    async _loadFerienKalender() {
      const ids = this._cals(this._config.schulferien_kalender);
      if (!ids.length) { FERIEN_KAL = []; return; }
      const t = sod(new Date());
      const lists = await Promise.all(ids.map((id) => this._fetchCal(id, addDays(t, -60), addDays(t, 400))));
      FERIEN_KAL = lists.flat().filter((e) => e.allDay).map((e) => [ymd(e.start), ymd(addDays(e.end, -1)), e.title]);
    }
    async _loadExtras() {
      await this._loadFerienKalender();
      // Geburtstage/Countdowns (nächste 120 Tage) und Essensvorschläge (letzte 120 Tage)
      const c = this._config;
      const t = sod(new Date());
      // Geburtstage: eigener Kalender und Termine mit «Geburtstag» oder 🎂 in den Familien-/Personenkalendern
      const bcals = this._cals(c.geburtstage);
      const other = [...this._cals(c.familie?.kalender), ...c.personen.flatMap((p) => this._cals(p.kalender))].filter((id) => !bcals.includes(id));
      const [b1, b2] = await Promise.all([
        Promise.all(bcals.map((id) => this._fetchCal(id, t, addDays(t, 120)))),
        Promise.all(other.map((id) => this._fetchCal(id, t, addDays(t, 120)))),
      ]);
      const seen = new Set();
      this._bdays = [...b1.flat(), ...b2.flat().filter((e) => /geburtstag|geburi|🎂|🎁/i.test(e.title))]
        .filter((e) => { const k = e.title + ymd(e.start); if (seen.has(k)) return false; seen.add(k); return true; });
      const ess = this._cals([c.essensplan]);
      if (ess.length) {
        const past = await this._fetchCal(ess[0], addDays(t, -365), addDays(t, 60));
        this._mealHist = past.map((e) => ({ title: (e.title || "").trim(), d: sod(e.start) })).filter((e) => e.title);
        const cnt = {};
        past.forEach((e) => (cnt[e.title] = (cnt[e.title] || 0) + 1));
        this._suggest = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 40);
      }
      this._render();
    }

    _loadTodos() {
      const c = this._config;
      const ids = [...this._bringLists(), ...c.personen.map((p) => this._aemtliId(p)), this._findByName("todo", c.countdowns), this._bildListe()].filter(Boolean);
      ids.forEach((id) => this._loadTodo(id));
    }

    async _loadTodo(id) {
      try {
        const r = await this._hass.callWS({ type: "todo/item/list", entity_id: id });
        this._todos[id] = r.items || [];
        this._render();
      } catch (e) { console.warn("Familienplaner: Liste", id, e); }
    }

    _subscribeWeather() {
      if (!this._hass || this._unsubWx || !this._config?.wetter || !this._hass.states[this._config.wetter]) return;
      try {
        this._unsubWx = this._hass.connection.subscribeMessage((m) => { this._forecast = m.forecast || []; this._render(); },
          { type: "weather/subscribe_forecast", entity_id: this._config.wetter, forecast_type: "daily" });
        this._unsubWx.catch?.(() => { this._unsubWx = null; });
      } catch (e) { this._unsubWx = null; }
    }

    // ---------- Abfragen ----------
    _on(list, day) {
      const ds = sod(day), de = addDays(ds, 1);
      return (list || []).filter((e) => e.start < de && e.end > ds);
    }
    _ausgeblendet() {
      return (this._todos[this._bildListe()] || []).filter((i) => /^Ausgeblendet: /.test(i.summary || "")).map((i) => i.summary.slice(14));
    }
    _bildListe() { return this._findByName("todo", this._config.bilderliste); }
    _customBilder() {
      const id = this._bildListe();
      return (this._todos[id] || []).filter((i) => i.summary && i.description && !/^(Farbe |Ausgeblendet: |Belohnung |Essen [♥✗] )/.test(i.summary)).map((i) => ({ uid: i.uid, key: i.summary.trim(), val: i.description.trim() }))
        .sort((a, b) => b.key.length - a.key.length);
    }
    _themaFor(title) { return THEMEN.find((t) => t.re.test(title || "")) || null; }
    _bildFor(title) {
      const t = (title || "").toLowerCase();
      const c = this._customBilder().find((m) => t.includes(m.key.toLowerCase()));
      if (c) return c.val;
      const th = this._themaFor(title);
      return th ? "url:" + th.url : null;
    }
    _bildSrc(val) {
      if (!val) return null;
      if (val.startsWith("img:")) return `/api/image/serve/${val.slice(4)}/512x512`;
      if (val.startsWith("url:")) return val.slice(4);
      if (/^https?:\/\//.test(val)) return val;
      return null;
    }
    _bildBg(val) {
      if (!val) return "";
      const src = this._bildSrc(val);
      if (src) { const u = `background-image:url('${esc(cssUrl(src))}')`; return `<span class="bgimg" style="${u}"></span><span class="bgblur" style="${u}"></span><span class="bgtint"></span>`; }
      return `<span class="bgemo" aria-hidden="true">${esc(val)}</span>`;
    }
    _bildHtml(val, cls = "pic") {
      if (!val) return "";
      const src = this._bildSrc(val);
      if (src) return `<span class="${cls}"><img src="${esc(src)}" alt=""></span>`;
      return `<span class="${cls}">${esc(val)}</span>`;
    }
    // Für Woche und Monat: kurze Nachtdienste (über Mitternacht, < 24 h, Ende vor 12 Uhr) nur am Anfangstag zeigen
    _onChips(list, day) {
      const ds = sod(day);
      return this._on(list, day).filter((e) => {
        if (e.allDay || e.start >= ds) return true;
        const short = e.end - e.start < 864e5 && sameDay(e.end, ds) && e.end.getHours() < 12;
        return !short;
      });
    }
    _timeLabel(e, day) {
      if (e.allDay) return "";
      const ds = sod(day), de = addDays(ds, 1);
      const before = e.start < ds, after = e.end > de;
      if (before && after) return "ganztags";
      if (before) return `bis ${hm(e.end)}`;
      if (after) {
        const short = e.end - e.start < 864e5 && e.end.getHours() < 12 && sameDay(e.end, de);
        return short ? `${hm(e.start)}–${hm(e.end)}` : `ab ${hm(e.start)}`;
      }
      return hm(e.start);
    }
    _meal(day) { return this._on(this._events.essen, day).find((e) => e.allDay) || this._on(this._events.essen, day)[0]; }
    _abfall(day) {
      const t = this._hass?.states[this._config.abfall]?.attributes?.termine || [];
      const s = ymd(day);
      return t.filter((x) => x.d === s).map((x) => x.t);
    }
    _wx(day) { const s = ymd(day); return this._forecast.find((f) => ymd(new Date(f.datetime)) === s); }
    _photo(p) {
      const v = this._hass?.states[p.foto]?.state;
      if (!v || v === "unknown" || v === "unavailable") return null;
      if (v.startsWith("/") || v.startsWith("http")) return v;
      return `/api/image/serve/${v.split("|")[0]}/512x512`;
    }
    _photoInfo(p) {
      const v = this._hass?.states[p.foto]?.state || "";
      const [crop, orig, z, x, y] = v.split("|");
      if (!orig) return null;
      return { orig, z: +z || 1, x: +x || 0.5, y: +y || 0.5 };
    }
    _visiblePersons() { return this._config.personen.map((p, i) => ({ ...p, i })).filter((p) => !this._hidden.has(p.name)); }
    // Design: "sonne" = dunkel zwischen Sonnenuntergang und -aufgang, "auto" = wie Home Assistant, "hell", "dunkel"
    _isDark() {
      const m = String(this._config.dunkel || "auto").toLowerCase();
      if (m === "dunkel") return true;
      if (m === "hell") return false;
      if (m === "sonne") { const sun = this._hass?.states["sun.sun"]; if (sun) return sun.state === "below_horizon"; }
      return !!this._hass?.themes?.darkMode;
    }
    _isQuer() {
      if (this._orient === "quer") return true;
      if (this._orient === "hoch") return false;
      return window.matchMedia("(orientation: landscape)").matches;
    }

    // ---------- Zeichnen ----------
    _render() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = null; this._draw(); });
    }

    _farbenAnwenden() {
      const items = this._todos[this._bildListe()] || [];
      this._config.personen.forEach((p) => {
        const it = items.find((i) => i.summary === `Farbe ${p.name}` && /^#[0-9a-f]{6}$/i.test((i.description || "").trim()));
        p.farbe = it ? it.description.trim() : p.farbeStandard;
      });
    }
    async _setFarbe(p, farbe) {
      const h = this._hass, liste = this._bildListe();
      if (!liste) { this._flash("Zuerst oben «Jetzt anlegen» tippen (Liste «Planer Bilder»)."); return; }
      const it = (this._todos[liste] || []).find((i) => i.summary === `Farbe ${p.name}`);
      if (!farbe) { if (it) await h.callService("todo", "remove_item", { item: it.uid }, { entity_id: liste }); }
      else if (it) await h.callService("todo", "update_item", { item: it.uid, description: farbe }, { entity_id: liste });
      else await h.callService("todo", "add_item", { item: `Farbe ${p.name}`, description: farbe }, { entity_id: liste });
      await this._loadTodo(liste);
    }
    _draw() {
      if (!this._config) return;
      this._farbenAnwenden();
      const root = this.shadowRoot;
      if (!root.querySelector("#app")) {
        root.innerHTML = `<style>${STYLE}</style><div id="app" lang="de"></div><div id="modal"></div>`;
        root.querySelector("#app").addEventListener("click", (e) => this._click(e));
        root.querySelector("#modal").addEventListener("click", (e) => this._modalClick(e));
        this._bindLongPress(root.querySelector("#app"));
        this._bindSwipe(root.querySelector("#app"));
      }
      if (!this._hass) return;
      const app = root.querySelector("#app");
      const scrolls = {};
      app.querySelectorAll("[data-scroll]").forEach((el) => (scrolls[el.dataset.scroll] = el.scrollTop));
      const quer = this._isQuer();
      const dark = this._isDark();
      app.className = `fp ${quer ? "quer" : "hoch"} ${dark ? "dark" : ""}`;
      app.innerHTML = `
        ${this._header()}
        ${this._setupBanner()}
        <div class="body">
          <section class="main">${this._view === "tag" ? this._dayView() : this._view === "monat" ? this._monthView() : this._weekView()}</section>
          <aside class="side ${this._sideClass()}" data-scroll="side">${this._sidePanels()}</aside>
        </div>`;
      app.querySelectorAll("[data-scroll]").forEach((el) => { if (scrolls[el.dataset.scroll] != null) el.scrollTop = scrolls[el.dataset.scroll]; });
      if (this._slide) { const m = app.querySelector(".main"); if (m) m.classList.add(this._slide > 0 ? "slide-l" : "slide-r"); this._slide = 0; }
      if (this._view === "woche") requestAnimationFrame(() => this._fitWeek());
      if (this._needScrollNow) { this._needScrollNow = false; const nl = app.querySelector(".nowline"); if (nl) nl.closest("[data-scroll]").scrollTop = Math.max(0, nl.offsetTop - 120); }
    }

    // Woche: so viele Tage zeigen, wie auf den Bildschirm passen (mindestens 7, höchstens 21)
    _fitWeek() {
      const wb = this.shadowRoot.querySelector(".wbody");
      if (!wb || this._view !== "woche") return;
      const rows = wb.querySelectorAll(".wrow");
      if (!rows.length) return;
      const key = `${ymd(this._anchor)}|${window.innerWidth}x${window.innerHeight}|${this._orient}|${[...this._hidden].join(",")}`;
      if (key !== this._fitKey) { this._fitKey = key; this._fitN = 0; }
      if ((this._fitN || 0) >= 6) return;
      const top = wb.getBoundingClientRect().top - wb.scrollTop;
      const used = rows[rows.length - 1].getBoundingClientRect().bottom - top + 8;
      const free = wb.clientHeight - used;
      const avg = used / rows.length;
      const days = this._weekDays || 7;
      let nd = days;
      if (free > avg * 1.15) nd = Math.min(21, days + Math.max(1, Math.floor(free / (avg * 1.15))));
      else if (free < -2 && days > 7) nd = Math.max(7, days - Math.max(1, Math.floor(-free / avg)));
      if (nd === days) return;
      this._fitN = (this._fitN || 0) + 1;
      this._weekDays = nd;
      this._refreshCalendars();
      this._render();
    }

    _clock() {
      const el = this.shadowRoot.querySelector(".clock");
      const now = new Date();
      if (el) el.textContent = hm(now);
      if (this._lastDay && !sameDay(this._lastDay, now)) { this._anchor = sod(now); this._refreshAll(); }
      this._lastDay = now;
      if (this._view === "tag") this._render();
    }

    _header() {
      const now = new Date();
      this._lastDay = this._lastDay || now;
      const w = this._hass.states[this._config.wetter];
      const today = this._wx(now);
      const [s, e] = this._visibleRange();
      let label;
      if (this._view === "tag") label = `${WDL[s.getDay()]}, ${s.getDate()}. ${MO[s.getMonth()]}`;
      else if (this._view === "monat") label = `${MO[this._anchor.getMonth()]} ${this._anchor.getFullYear()}`;
      else { const l = addDays(e, -1); label = `${s.getDate()}.${s.getMonth() !== l.getMonth() ? " " + MOS[s.getMonth()] : ""} – ${l.getDate()}. ${MOS[l.getMonth()]} <span class="kw">KW ${kw(s)}${kw(l) !== kw(s) ? "–" + kw(l) : ""}</span>`; }
      const orientIcon = { auto: "mdi:phone-rotate-portrait", hoch: "mdi:tablet", quer: "mdi:tablet" }[this._orient];
      const orientLabel = { auto: "Auto", hoch: "Hoch", quer: "Quer" }[this._orient];
      return `
        <header class="hd">
          <div class="when">
            <div class="clock">${hm(now)}</div>
            <div class="date">${WDL[now.getDay()]}, ${now.getDate()}. ${MO[now.getMonth()]}</div>
          </div>
          <div class="nav">
            <div class="seg" role="tablist">
              ${["tag", "woche", "monat"].map((v) => `<button data-act="view" data-v="${v}" class="${this._view === v ? "on" : ""}">${{ tag: "Tag", woche: "Woche", monat: "Monat" }[v]}</button>`).join("")}
            </div>
            <div class="pager">
              <button class="today" data-act="heute">Heute</button>
            </div>
            <div class="range">${label}</div>
          </div>
          <div class="wx">
            ${w ? (() => {
              const tom = this._wx(addDays(now, 1));
              const rain = today && today.precipitation != null ? today.precipitation : null;
              return `<div class="wxbox"><ha-icon class="wxi" icon="${WX[w.state] || "mdi:weather-cloudy"}"></ha-icon>
                <div class="wxt"><div class="t">${Math.round(w.attributes.temperature ?? 0)}°</div><div class="cond">${esc(WXDE[w.state] || "")}</div></div>
                <div class="wxd">
                  ${today ? `<div><span class="lbl">Heute</span><b>${Math.round(today.temperature)}°</b> / ${Math.round(today.templow ?? 0)}°${rain ? ` <span class="rain"><ha-icon icon="mdi:water"></ha-icon>${rain} mm</span>` : ""}</div>` : ""}
                  ${tom ? `<div><span class="lbl">Morgen</span><ha-icon icon="${WX[tom.condition] || "mdi:weather-cloudy"}"></ha-icon><b>${Math.round(tom.temperature)}°</b> / ${Math.round(tom.templow ?? 0)}°</div>` : ""}
                </div></div>`;
            })() : ""}
            ${this._config.zuhause_link ? `<button class="homebtn" data-act="zuhause" title="Zum Dashboard «${esc(this._config.zuhause_name || "Zuhause")}»" aria-label="${esc(this._config.zuhause_name || "Zuhause")}"><ha-icon icon="mdi:home"></ha-icon><span>${esc(this._config.zuhause_name || "Zuhause")}</span></button>` : ""}
            <button class="homebtn" data-act="bilder" title="Bilder zu Terminen"><ha-icon icon="mdi:image-multiple"></ha-icon><span>Bilder</span></button>
            <button class="homebtn orient" data-act="orient" title="Format: ${orientLabel}"><ha-icon icon="${orientIcon}" class="${this._orient === "quer" ? "rot" : ""}"></ha-icon><span>${orientLabel}</span></button>
          </div>
        </header>
        ${this._alertBar()}`;
    }

    _alertBar() {
      const now = new Date();
      const items = [];
      const tom = this._abfall(addDays(now, 1));
      const tod = this._abfall(now);
      const arten = (l) => l.map((t) => { const st = ABFALL[t] || {}; return `<span class="abt" style="--c:${st.color || "#888"}"><ha-icon icon="${st.icon || "mdi:trash-can"}"></ha-icon>${esc(t)}</span>`; }).join("");
      if (tod.length && now.getHours() < 10) items.push(`<span class="al"><ha-icon icon="mdi:trash-can-outline"></ha-icon>Heute Abfuhr:${arten(tod)}</span>`);
      if (tom.length && now.getHours() >= 14) items.push(`<span class="al"><ha-icon icon="mdi:trash-can-outline"></ha-icon>Morgen rausstellen:${arten(tom)}</span>`);
      return items.length ? `<div class="alerts">${items.join("")}</div>` : "";
    }

    _setupBanner() {
      const c = this._config;
      const missing = [];
      c.personen.forEach((p) => { if (p.aemtli && !this._aemtliId(p)) missing.push({ handler: "local_todo", name: p.aemtli }); });
      if (c.countdowns && !this._findByName("todo", c.countdowns)) missing.push({ handler: "local_todo", name: c.countdowns });
      if (c.essensplan && !this._findByName("calendar", c.essensplan)) missing.push({ handler: "local_calendar", name: c.essensplan });
      if (c.bilderliste && c.personen.some((p) => p.bilder) && !this._bildListe()) missing.push({ handler: "local_todo", name: c.bilderliste });
      this._missing = missing;
      const noCal = c.personen.every((p) => !this._cals(p.kalender).length) && !this._cals(c.familie?.kalender).length;
      const parts = [];
      if (missing.length && this._hass.user?.is_admin) {
        parts.push(`<div class="setup"><ha-icon icon="mdi:playlist-plus"></ha-icon><div><b>Noch ${missing.length === 1 ? "eine Liste" : missing.length + " Listen"} anlegen:</b> ${missing.map((m) => esc(m.name)).join(", ")}</div>
          <button class="btn" data-act="setup" ${this._busy ? "disabled" : ""}>${this._busy ? "Lege an …" : "Jetzt anlegen"}</button></div>`);
      }
      if (noCal) parts.push(`<div class="setup soft"><ha-icon icon="mdi:google"></ha-icon><div><b>Noch keine Kalender verbunden.</b> Kalender in Home Assistant einbinden (z. B. «Remote Calendar») und unter «kalender» bei der Person eintragen.</div></div>`);
      if (this._msg) parts.push(`<div class="setup soft"><ha-icon icon="mdi:information-outline"></ha-icon><div>${esc(this._msg)}</div></div>`);
      return parts.join("");
    }

    _avatar(p, size = "") {
      const img = this._photo(p);
      const off = this._hidden.has(p.name);
      return `<button class="av ${size} ${off ? "off" : ""}" style="--c:${p.farbe}" data-act="person" data-name="${esc(p.name)}" data-lp="foto" title="Antippen: ein/ausblenden · Lange drücken: Foto ändern">
          <span class="ring">${img ? `<img src="${esc(img)}" alt="">` : `<span class="ini">${esc(p.name[0])}</span>`}</span>
          <span class="nm">${esc(p.name)}</span>
        </button>`;
    }

    _chip(e, color, opts = {}) {
      const time = e.allDay ? "" : `<span class="tm">${opts.day ? this._timeLabel(e, opts.day) : hm(e.start)}</span>`;
      const multi = e.allDay && (e.end - e.start) > 864e5 + 3600e3;
      const bild = opts.pic ? this._bildFor(e.title) : null;
      if (bild) {
        return `<button class="ev bg ${this._bildSrc(bild) ? "bgphoto" : "bgemoji"} ${e.allDay ? "ad" : ""}" style="--c:${color}" data-act="ev" data-key="${esc(opts.key)}" data-idx="${opts.idx}" data-lp="bild">
          ${this._bildBg(bild)}<span class="txt">${time}<span class="tt">${esc(e.title)}</span></span>
        </button>`;
      }
      return `<button class="ev ${e.allDay ? "ad" : ""} ${opts.cls || ""}" style="--c:${color}" data-act="ev" data-key="${esc(opts.key)}" data-idx="${opts.idx}" data-lp="bild">
          ${time}<span class="tt">${esc(e.title)}</span>${multi ? `<ha-icon class="mi" icon="mdi:arrow-expand-horizontal"></ha-icon>` : ""}
        </button>`;
    }

    _dayInfo(d, compact) {
      const wx = this._wx(d);
      const ab = this._abfall(d);
      const meal = this._meal(d);
      const fer = ferienOn(d);
      const today = sameDay(d, new Date());
      return `
        <div class="dnum"><span class="wd">${WD[d.getDay()]}</span><span class="n">${d.getDate()}</span>${today ? `<span class="hd-today">Heute</span>` : ""}</div>
        <div class="dmeta">
          ${wx ? `<span class="dwx"><ha-icon icon="${WX[wx.condition] || "mdi:weather-cloudy"}"></ha-icon>${Math.round(wx.temperature)}°</span>` : ""}
          ${ab.map((t) => `<ha-icon class="trash" title="${esc(t)}" style="--c:${(ABFALL[t] || {}).color || "#888"}" icon="${(ABFALL[t] || {}).icon || "mdi:trash-can"}"></ha-icon>`).join("")}
        </div>
        ${fer ? `<div class="fer">${esc(fer)}</div>` : ""}
        <button class="meal ${meal ? "" : "empty"}" data-act="meal" data-day="${ymd(d)}"><ha-icon icon="mdi:silverware-fork-knife"></ha-icon><span>${meal ? esc(meal.title) : compact ? "Essen" : "Essen planen"}</span></button>`;
    }

    _weekView() {
      const [s] = this._visibleRange();
      const all = this._config.personen.map((p, i) => ({ ...p, i }));
      const fam = this._config.familie;
      const cols = `var(--daycol) ${all.map((p) => (this._hidden.has(p.name) ? "var(--hidcol)" : "minmax(0,1fr)")).join(" ")}`;
      const today = sod(new Date());
      let rows = "";
      const nDays = this._weekDays || 7;
      for (let k = 0; k < nDays; k++) {
        const d = addDays(s, k);
        if (k > 0 && d.getDay() === 1) rows += `<div class="kwsep"><span>KW ${kw(d)}</span></div>`;
        const famEv = this._onChips(this._events.familie, d);
        const hol = holidayOn(d);
        const band = famEv.length || hol;
        const isToday = sameDay(d, today);
        rows += `<div class="wrow ${isToday ? "now" : ""} ${d < today ? "past" : ""} ${d.getDay() === 0 || d.getDay() === 6 ? "we" : ""}" style="grid-template-columns:${cols}">
          <div class="dcell" style="grid-row:1 / span ${band ? 2 : 1}">${this._dayInfo(d)}</div>
          ${band ? `<div class="band" style="grid-column:2 / -1">
            ${hol ? `<span class="hol"><ha-icon icon="mdi:flag-variant-outline"></ha-icon>${esc(hol)}</span>` : ""}
            ${famEv.map((e) => this._chip(e, fam.farbe, { key: "familie", idx: this._events.familie.indexOf(e), day: d })).join("")}
          </div>` : ""}
          ${all.map((p) => {
            if (this._hidden.has(p.name)) return `<div class="pcell hid"></div>`;
            const ev = this._onChips(this._events["p" + p.i], d).sort((a, b) => (a.start < sod(d) ? -1 : 0) - (b.start < sod(d) ? -1 : 0) || a.start - b.start);
            return `<div class="pcell" style="--c:${p.farbe}">${ev.map((e) => this._chip(e, p.farbe, { key: "p" + p.i, idx: this._events["p" + p.i].indexOf(e), day: d, pic: !!p.bilder })).join("")}</div>`;
          }).join("")}
        </div>`;
      }
      return `<div class="week">
        <div class="whead" style="grid-template-columns:${cols}">
          ${this._cals(fam.kalender).length ? `<div class="famlegend" style="--c:${fam.farbe}"><span class="dot"></span>${esc(fam.name)}</div>` : "<div></div>"}
          ${all.map((p) => `<div class="hcell">${this._avatar(p, this._hidden.has(p.name) ? "mini" : "")}</div>`).join("")}
        </div>
        <div class="wbody" data-scroll="week">${rows}</div>
      </div>`;
    }

    _dayView() {
      const d = this._anchor;
      const all = this._config.personen.map((p, i) => ({ ...p, i }));
      const fam = this._config.familie;
      const colsDef = [...(this._cals(fam.kalender).length ? [{ key: "familie", name: fam.name, farbe: fam.farbe, fam: true }] : []), ...all.filter((p) => !this._hidden.has(p.name)).map((p) => ({ ...p, key: "p" + p.i }))];
      const ds = sod(d), de = addDays(ds, 1);
      let h0 = 7, h1 = 21;
      colsDef.forEach((c) => this._on(this._events[c.key], d).filter((e) => !e.allDay).forEach((e) => {
        const a = e.start < ds ? 0 : e.start.getHours();
        const b = e.end > de ? 24 : e.end.getHours() + (e.end.getMinutes() ? 1 : 0);
        h0 = Math.min(h0, a); h1 = Math.max(h1, b);
      }));
      const PX = 60;
      const hours = [];
      for (let h = h0; h < h1; h++) hours.push(h);
      const hol = holidayOn(d), fer = ferienOn(d), meal = this._meal(d), ab = this._abfall(d), wx = this._wx(d);
      const grid = `grid-template-columns: 52px repeat(${colsDef.length}, minmax(0,1fr))`;
      const allday = colsDef.map((c) => {
        const ev = this._on(this._events[c.key], d).filter((e) => e.allDay);
        return `<div class="adcell">${ev.map((e) => this._chip(e, c.farbe, { key: c.key, idx: this._events[c.key].indexOf(e), pic: !!c.bilder })).join("")}</div>`;
      }).join("");
      const colsHtml = colsDef.map((c) => {
        const ev = this._on(this._events[c.key], d).filter((e) => !e.allDay);
        // Spuren für Überschneidungen
        const lanes = [];
        const placed = ev.map((e) => {
          let l = 0; while (lanes[l] && lanes[l] > e.start) l++; lanes[l] = e.end; return { e, l };
        });
        const n = Math.max(1, lanes.length);
        return `<div class="tcol" style="--c:${c.farbe}; height:${(h1 - h0) * PX}px">
          ${placed.map(({ e, l }) => {
            const a = Math.max(e.start, new Date(ds.getTime() + h0 * 3600e3));
            const b = Math.min(e.end, new Date(ds.getTime() + h1 * 3600e3));
            const top = ((a - ds) / 3600e3 - h0) * PX;
            const hgt = Math.max(26, ((b - a) / 3600e3) * PX - 3);
            const bild = c.bilder ? this._bildFor(e.title) : null;
            return `<button class="tev ${bild ? "bg " + (this._bildSrc(bild) ? "bgphoto" : "bgemoji") : ""}" data-act="ev" data-lp="bild" data-key="${c.key}" data-idx="${this._events[c.key].indexOf(e)}" style="top:${top}px;height:${hgt}px;left:calc(${(l / n) * 100}% + 2px);width:calc(${100 / n}% - 4px)">
              ${bild ? this._bildBg(bild) : ""}<span class="tt">${esc(e.title)}</span><span class="tm">${hm(e.start)}–${hm(e.end)}</span></button>`;
          }).join("")}
        </div>`;
      }).join("");
      const now = new Date();
      const nowTop = sameDay(now, d) && now.getHours() >= h0 && now.getHours() < h1 ? ((now - ds) / 3600e3 - h0) * PX : null;
      if (nowTop != null && this._dayScrolled !== ymd(d)) { this._dayScrolled = ymd(d); this._needScrollNow = true; }
      return `<div class="day">
        <div class="dstrip">
          ${wx ? `<span class="chipx"><ha-icon icon="${WX[wx.condition] || "mdi:weather-cloudy"}"></ha-icon>${Math.round(wx.temperature)}° / ${Math.round(wx.templow ?? 0)}°</span>` : ""}
          ${hol ? `<span class="chipx"><ha-icon icon="mdi:flag-variant-outline"></ha-icon>${esc(hol)}</span>` : ""}
          ${fer ? `<span class="chipx"><ha-icon icon="mdi:beach"></ha-icon>${esc(fer)}</span>` : ""}
          ${ab.map((t) => `<span class="chipx" style="--c:${(ABFALL[t] || {}).color}"><ha-icon icon="${(ABFALL[t] || {}).icon}"></ha-icon>${esc(t)}</span>`).join("")}
          <button class="meal big ${meal ? "" : "empty"}" data-act="meal" data-day="${ymd(d)}"><ha-icon icon="mdi:silverware-fork-knife"></ha-icon><span>${meal ? esc(meal.title) : "Essen planen"}</span></button>
        </div>
        <div class="dhead" style="${grid}">
          <div></div>
          ${colsDef.map((c) => c.fam ? `<div class="hcell"><div class="famav" style="--c:${c.farbe}"><ha-icon icon="mdi:home-heart"></ha-icon><span class="nm">${esc(c.name)}</span></div></div>` : `<div class="hcell">${this._avatar(c, "sm")}</div>`).join("")}
        </div>
        <div class="dall" style="${grid}"><div class="lbl">ganztags</div>${allday}</div>
        <div class="dbody" data-scroll="day">
          <div class="tgrid" style="${grid}">
            <div class="hours">${hours.map((h) => `<div class="hr" style="height:${PX}px"><span>${pad(h)}:00</span></div>`).join("")}</div>
            ${colsHtml}
            ${nowTop != null ? `<div class="nowline" style="top:${nowTop}px"></div>` : ""}
          </div>
        </div>
      </div>`;
    }

    _monthView() {
      const [s] = this._visibleRange();
      const m = this._anchor.getMonth();
      const today = sod(new Date());
      const ps = this._visiblePersons();
      const fam = this._config.familie;
      let cells = "";
      for (let k = 0; k < 42; k++) {
        const d = addDays(s, k);
        const list = [];
        this._onChips(this._events.familie, d).forEach((e) => list.push([e, fam.farbe]));
        ps.forEach((p) => this._onChips(this._events["p" + p.i], d).forEach((e) => list.push([e, p.farbe, p.bilder])));
        list.sort((a, b) => (b[0].allDay - a[0].allDay) || (a[0].start - b[0].start));
        const hol = holidayOn(d), fer = ferienOn(d);
        const ab = this._abfall(d);
        const max = this._isQuer() ? 3 : 4;
        cells += `<button class="mcell ${d.getMonth() !== m ? "out" : ""} ${sameDay(d, today) ? "now" : ""} ${fer ? "fer" : ""} ${d.getDay() === 0 || d.getDay() === 6 ? "we" : ""}" data-act="goday" data-day="${ymd(d)}">
          <div class="mtop"><span class="mn">${d.getDate()}</span>${ab.map((t) => `<ha-icon class="trash" style="--c:${(ABFALL[t] || {}).color}" icon="${(ABFALL[t] || {}).icon}"></ha-icon>`).join("")}</div>
          ${hol ? `<div class="mhol">${esc(hol)}</div>` : ""}
          ${list.slice(0, max).map(([e, c, pic]) => `<div class="mev ${e.allDay ? "ad" : ""}" style="--c:${c}">${pic ? this._bildHtml(this._bildFor(e.title), "mpic") : ""}${e.allDay ? "" : `<span class="tm">${this._timeLabel(e, d)}</span>`}${esc(e.title)}</div>`).join("")}
          ${list.length > max ? `<div class="more">+${list.length - max} weitere</div>` : ""}
        </button>`;
      }
      return `<div class="month">
        <div class="mlegend">${ps.map((p) => this._avatar(p, "mini")).join("")}${this._config.personen.filter((p) => this._hidden.has(p.name)).map((p) => this._avatar(p, "mini")).join("")}
          ${this._cals(fam.kalender).length ? `<span class="famlegend" style="--c:${fam.farbe}"><span class="dot"></span>${esc(fam.name)}</span>` : ""}</div>
        <div class="mhead">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => `<div>${w}</div>`).join("")}</div>
        <div class="mgrid" data-scroll="month">${cells}</div>
      </div>`;
    }

    // ---------- Seitenleiste ----------
    _hasChores() {
      return this._config.personen.some((p) => { const id = this._aemtliId(p); return id && (this._todos[id] || []).length > 0; });
    }
    _hasStars() { return this._config.personen.some((p) => p.sterne && this._hass.states[p.sterne]); }
    _sidePanels() {
      return `${this._notePanel()}${this._soonPanel()}${this._shopPanel()}${this._hasChores() ? this._choresPanel() : ""}${this._hasStars() ? this._starsPanel() : ""}`;
    }
    _sideClass() {
      const ch = this._hasChores(), stv = this._hasStars();
      return !ch && !stv ? "nochores" : ch && stv ? "both" : "";
    }

    // ---------- Sterne und Belohnungen ----------
    _rewardItem(p) { return (this._todos[this._bildListe()] || []).find((i) => i.summary === `Belohnung ${p.name}`); }
    _reward(p) {
      const it = this._rewardItem(p);
      let r = {};
      try { r = JSON.parse(it?.description || "{}") || {}; } catch (e) { r = {}; }
      return { ziel: Math.max(1, Math.min(50, +r.ziel || 10)), text: r.text || "", bild: r.bild || "" };
    }
    async _setReward(p, r) {
      const h = this._hass, liste = this._bildListe();
      if (!liste) return;
      const it = this._rewardItem(p);
      const description = JSON.stringify(r);
      if (it) await h.callService("todo", "update_item", { item: it.uid, description }, { entity_id: liste });
      else await h.callService("todo", "add_item", { item: `Belohnung ${p.name}`, description }, { entity_id: liste });
      await this._loadTodo(liste);
    }
    _starsPanel() {
      const ps = this._config.personen.map((p, i) => ({ ...p, i })).filter((p) => p.sterne && this._hass.states[p.sterne]);
      return `<div class="panel starsp">
        <div class="ph"><ha-icon icon="mdi:star-circle-outline"></ha-icon><h3>Sterne</h3></div>
        <div class="stlist">${ps.map((p) => {
          const n = Math.max(0, parseInt(this._hass.states[p.sterne].state, 10) || 0);
          const r = this._reward(p);
          const done = n >= r.ziel;
          const shown = Math.min(n, r.ziel);
          const many = r.ziel > 12;
          const track = many
            ? `<span class="stbar"><span style="width:${Math.round((shown / r.ziel) * 100)}%"></span></span><span class="stnum">${n} / ${r.ziel}</span>`
            : Array.from({ length: r.ziel }, (_, k) => `<ha-icon class="${k < shown ? "on" : ""}" icon="${k < shown ? "mdi:star" : "mdi:star-outline"}"></ha-icon>`).join("");
          return `<div class="strow ${done ? "done" : ""}" style="--c:${p.farbe}">
            <div class="sthead">${this._avatar(p, "xs")}
              <button class="stgive" data-act="stargive" data-name="${esc(p.name)}" aria-label="Stern für ${esc(p.name)}"><ha-icon icon="mdi:star-plus"></ha-icon></button></div>
            <button class="sttrack" data-act="reward" data-name="${esc(p.name)}">${track}</button>
            <button class="streward" data-act="${done ? "redeem" : "reward"}" data-name="${esc(p.name)}">
              ${r.bild ? this._bildHtml(r.bild, "rwpic") : `<span class="rwpic empty"><ha-icon icon="mdi:gift-outline"></ha-icon></span>`}
              <span class="rwtxt">${done ? `<b>Geschafft!</b> ${esc(r.text || "Belohnung")} einlösen` : r.text ? `${esc(r.text)}<small>noch ${r.ziel - n} ${r.ziel - n === 1 ? "Stern" : "Sterne"}</small>` : "Belohnung festlegen"}</span>
            </button>
          </div>`;
        }).join("")}</div>
      </div>`;
    }
    _openReward(p) {
      const h = this._hass;
      if (!this._bildListe()) { this._openConfirm("Dafür braucht es die Liste «Planer Bilder». Oben auf «Jetzt anlegen» tippen.", "OK", async () => {}); return; }
      const r = this._reward(p);
      let wahl = r.bild, ziel = r.ziel;
      const n = Math.max(0, parseInt(h.states[p.sterne]?.state, 10) || 0);
      // Für Belohnungen passende Themen zuerst, Arbeit/Arzt/Handwerker weglassen
      const PREF = ["zoo", "kino", "europa", "spielplatz", "schwimm", "ferien", "essen", "velo", "ski", "bibliothek", "reiten", "musik", "malen", "fest", "geburtstag", "wander", "fussball", "ballett", "turnen", "haustier", "zug", "reisen", "konzert", "kürbis", "weihnacht", "laterne", "familie", "einkauf"];
      const rank = (n) => { const i = PREF.findIndex((k) => n.toLowerCase().includes(k)); return i < 0 ? 99 : i; };
      const themen = THEMEN.filter((t) => rank(t.name) < 99).sort((x, y) => rank(x.name) - rank(y.name)).map((t) => ({ name: t.name, val: "url:" + t.url }));
      const prev = () => { const el = this.shadowRoot.querySelector("#fp-prev"); if (el) el.innerHTML = wahl ? this._bildHtml(wahl, "bigpic") : `<span class="bigpic empty"><ha-icon icon="mdi:gift-outline"></ha-icon></span>`; };
      const setZ = (z) => { ziel = Math.max(1, Math.min(50, z)); const el = this.shadowRoot.querySelector("#fp-ziel"); if (el) el.textContent = ziel; };
      const mark = (el) => this.shadowRoot.querySelectorAll(".emo button, .thm button").forEach((b) => b.classList.toggle("on", b === el));
      this._mh = {
        zp: () => setZ(ziel + 1), zm: () => setZ(ziel - 1),
        pick: (el) => { wahl = el.dataset.v; prev(); mark(el); },
        thema: (el) => { wahl = themen[+el.dataset.i].val; prev(); mark(el); },
        quick: (el) => {
          const [t, e, z] = BELOHNUNGEN[+el.dataset.i];
          this.shadowRoot.querySelector("#fp-in").value = t; wahl = e; setZ(z); prev();
          this.shadowRoot.querySelectorAll(".rwquick button").forEach((b) => b.classList.toggle("on", b === el));
          mark(null);
        },
        minus: async () => { await h.callService("counter", "decrement", { entity_id: p.sterne }); this._modal(""); },
        reset: () => this._openConfirm(`Sterne von ${p.name} auf 0 setzen?`, "Auf 0 setzen", () => h.callService("counter", "reset", { entity_id: p.sterne })),
        save: async () => { await this._setReward(p, { ziel, text: this.shadowRoot.querySelector("#fp-in").value.trim(), bild: wahl }); this._modal(""); },
      };
      this._modal(`
        <div class="dlg-h" style="--c:${p.farbe}"><span class="bar"></span><h2>Belohnung für ${esc(p.name)}</h2></div>
        <div class="dlg-b">
          <div class="bildtop"><div id="fp-prev"></div>
            <label class="kw">Worauf sammelt ${esc(p.name)}?<input id="fp-in" type="text" maxlength="60" placeholder="z. B. Zoo-Besuch, Glace, Kino" value="${esc(r.text)}"></label></div>
          <div class="zielrow"><span>Sterne bis zur Belohnung</span>
            <button class="add" data-m="zm" aria-label="Weniger"><ha-icon icon="mdi:minus"></ha-icon></button><b id="fp-ziel">${ziel}</b>
            <button class="add" data-m="zp" aria-label="Mehr"><ha-icon icon="mdi:plus"></ha-icon></button>
            <span class="have">aktuell ${n} ${n === 1 ? "Stern" : "Sterne"}</span></div>
          <div class="sect">Schnell wählen</div>
          <div class="rwquick">${BELOHNUNGEN.map(([t, e, z], i) => `<button data-m="quick" data-i="${i}" class="${t === r.text ? "on" : ""}"><span class="qe">${e}</span><span>${esc(t)}</span><small>${z} ★</small></button>`).join("")}</div>
          <div class="sect">Oder eigenes Bild wählen</div>
          <div class="thm">${themen.map((t, i) => `<button data-m="thema" data-i="${i}" class="${t.val === wahl ? "on" : ""}">${this._bildHtml(t.val, "thpic")}<span>${esc(t.name)}</span></button>`).join("")}</div>
          <div class="sect">Oder ein Emoji</div>
          <div class="emo">${EMOJI_WAHL.map((e) => `<button data-m="pick" data-v="${e}" class="${e === wahl ? "on" : ""}">${e}</button>`).join("")}</div>
        </div>
        <div class="dlg-f"><button class="btn ghost" data-m="minus">Stern abziehen</button><button class="btn ghost" data-m="reset">Auf 0</button><span class="sp"></span><button class="btn ghost" data-m="close">Abbrechen</button><button class="btn" data-m="save">Speichern</button></div>`);
      this.shadowRoot.querySelector("#modal .dlg").classList.add("wide");
      prev();
    }

    _notePanel() {
      const v = this._hass.states[this._config.notiz]?.state;
      const has = v && v !== "unknown" && v !== "unavailable" && v.trim();
      return `<div class="notewrap"><div class="note" data-act="note" role="button" aria-label="Pinnwand bearbeiten">
        <span class="tape" aria-hidden="true"></span>
        <p class="${has ? "" : "ph-empty"}">${has ? esc(v) : "Antippen und eine Nachricht für alle hinterlassen …"}</p>
      </div></div>`;
    }

    _soonPanel() {
      const items = [];
      const t = sod(new Date());
      (this._bdays || []).forEach((e) => { const n = daysUntil(e.start); if (n >= 0) items.push({ n, icon: "mdi:cake-variant-outline", title: e.title, key: `${e.title}|${ymd(e.start)}` }); });
      const cd = this._findByName("todo", this._config.countdowns);
      (this._todos[cd] || []).filter((i) => i.status !== "completed" && i.due).forEach((i) => {
        const n = daysUntil(parseYmd(i.due)); if (n >= 0) items.push({ n, icon: "mdi:party-popper", title: i.summary, uid: i.uid });
      });
      const nf = alleFerien().find(([a, b]) => ymd(t) <= b);
      if (nf) { const a = parseYmd(nf[0]); const n = daysUntil(a); const key = `${nf[2]}|${nf[0]}`; items.push(n <= 0 ? { n: 0, icon: "mdi:beach", title: `${nf[2]} bis ${parseYmd(nf[1]).getDate()}. ${MOS[parseYmd(nf[1]).getMonth()]}`, live: true, key } : { n, icon: "mdi:beach", title: nf[2], key }); }
      const hidden = this._ausgeblendet();
      for (let i = items.length - 1; i >= 0; i--) if (items[i].key && hidden.includes(items[i].key)) items.splice(i, 1);
      const ab = this._hass.states[this._config.abfall]?.attributes?.termine || [];
      const nextAb = ab.filter((x) => x.d >= ymd(t) && x.d <= ymd(addDays(t, 5)));
      items.sort((a, b) => a.n - b.n);
      return `<div class="panel soon">
        <div class="ph"><ha-icon icon="mdi:timer-sand"></ha-icon><h3>Bald</h3>${cd ? `<button class="add" data-act="addcd" aria-label="Countdown hinzufügen"><ha-icon icon="mdi:plus"></ha-icon></button>` : ""}</div>
        <ul class="cd">${items.slice(0, 6).map((i) => `<li ${i.uid ? `data-act="cdinfo" data-uid="${esc(i.uid)}"` : `data-act="baldweg" data-key="${esc(i.key || "")}" data-title="${esc(i.title)}"`}><ha-icon icon="${i.icon}"></ha-icon><span class="tt">${esc(i.title)}</span>${!i.live && i.n >= 1 && i.n <= 5 ? `<span class="moons" title="noch ${i.n}× schlafen">${Array.from({ length: i.n }, () => `<ha-icon icon="mdi:moon-waning-crescent"></ha-icon>`).join("")}</span>` : `<span class="n">${i.live ? "jetzt" : inTage(i.n)}</span>`}</li>`).join("") || `<li class="ph-empty">Noch nichts geplant.</li>`}</ul>
        ${nextAb.length ? `<div class="abf">${nextAb.map((x) => { const d = parseYmd(x.d); const st = ABFALL[x.t] || {}; return `<span class="abx" style="--c:${st.color}"><ha-icon icon="${st.icon}"></ha-icon><b>${esc(x.t)}</b> ${daysUntil(d) <= 1 ? inTage(daysUntil(d)) : `${WD[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`}</span>`; }).join("")}</div>` : ""}
      </div>`;
    }

    _shopPanel() {
      const lists = this._bringLists();
      if (!lists.length) return `<div class="panel shop"><div class="ph"><ha-icon icon="mdi:cart-outline"></ha-icon><h3>Einkauf</h3></div><p class="ph-empty">Bring! ist nicht verbunden.</p></div>`;
      if (!lists.includes(this._shopList)) this._shopList = lists.find((l) => l.includes("zuhause")) || lists[0];
      const items = (this._todos[this._shopList] || []).filter((i) => i.status !== "completed");
      const nm = (id) => (this._hass.states[id]?.attributes.friendly_name || id).replace(/^Bring!?\s*/i, "");
      return `<div class="panel shop">
        <div class="ph"><ha-icon icon="mdi:cart-outline"></ha-icon><h3>Einkauf</h3><span class="cnt">${items.length}</span><button class="add" data-act="addshop" aria-label="Artikel hinzufügen"><ha-icon icon="mdi:plus"></ha-icon></button></div>
        ${lists.length > 1 ? `<div class="tabs">${lists.map((l) => `<button data-act="shoplist" data-id="${l}" class="${l === this._shopList ? "on" : ""}">${esc(nm(l))}</button>`).join("")}</div>` : ""}
        <ul class="items" data-scroll="shop">${items.map((i) => `<li><button data-act="shopdone" data-uid="${esc(i.uid)}"><span class="box"></span><span class="tt">${esc(i.summary)}</span>${i.description ? `<span class="sub">${esc(i.description)}</span>` : ""}</button></li>`).join("") || `<li class="ph-empty">Die Liste ist leer.</li>`}</ul>
      </div>`;
    }

    _choresPanel() {
      const ps = this._config.personen.map((p, i) => ({ ...p, i }));
      const any = ps.some((p) => this._aemtliId(p));
      return `<div class="panel chores">
        <div class="ph"><ha-icon icon="mdi:broom"></ha-icon><h3>Ämtli</h3></div>
        ${any ? `<div class="cgrid">${ps.map((p) => {
          const id = this._aemtliId(p);
          if (!id) return "";
          const items = this._todos[id] || [];
          const open = items.filter((i) => i.status !== "completed");
          const done = items.filter((i) => i.status === "completed");
          const stars = p.sterne ? this._hass.states[p.sterne]?.state : null;
          return `<div class="cper" style="--c:${p.farbe}">
            <div class="cph">${this._avatar(p, "xs")}${stars != null ? `<button class="stars" data-act="stars" data-id="${p.sterne}" data-name="${esc(p.name)}"><ha-icon icon="mdi:star"></ha-icon>${esc(stars)}</button>` : ""}<button class="add" data-act="addchore" data-id="${id}" aria-label="Ämtli hinzufügen"><ha-icon icon="mdi:plus"></ha-icon></button></div>
            <ul>${open.map((i) => `<li><button data-act="chore" data-id="${id}" data-uid="${esc(i.uid)}" data-st="${p.sterne || ""}" data-done="0"><span class="box"></span><span class="tt">${esc(i.summary)}</span></button></li>`).join("")}
            ${done.map((i) => `<li class="done"><button data-act="chore" data-id="${id}" data-uid="${esc(i.uid)}" data-st="${p.sterne || ""}" data-done="1"><span class="box"><ha-icon icon="mdi:check"></ha-icon></span><span class="tt">${esc(i.summary)}</span></button></li>`).join("")}
            ${!items.length ? `<li class="ph-empty">Keine Ämtli</li>` : ""}</ul>
          </div>`;
        }).join("")}</div>` : `<p class="ph-empty">Die Ämtli-Listen werden mit «Jetzt anlegen» erstellt.</p>`}
      </div>`;
    }

    // ---------- Bedienung ----------
    _bindLongPress(root) {
      let timer = null, target = null;
      const start = (e) => {
        this._lpFired = false;
        const el = e.target.closest("[data-lp]");
        if (!el) return;
        target = el;
        timer = setTimeout(() => { this._lpFired = true; this._longPress(el); }, 650);
      };
      const cancel = () => { clearTimeout(timer); timer = null; };
      root.addEventListener("pointerdown", start);
      ["pointerup", "pointerleave", "pointercancel", "pointermove"].forEach((ev) => root.addEventListener(ev, (e) => { if (ev === "pointermove" && target && Math.abs(e.movementX) + Math.abs(e.movementY) < 6) return; cancel(); }));
      root.addEventListener("contextmenu", (e) => { if (e.target.closest("[data-lp]")) e.preventDefault(); });
    }

    _longPress(el) {
      if (el.dataset.lp === "bild") {
        const ev = (this._events[el.dataset.key] || [])[+el.dataset.idx];
        if (ev) this._openBild(ev);
        return;
      }
      if (el.dataset.lp === "foto") {
        const p = this._config.personen.find((x) => x.name === el.dataset.name);
        if (p) this._openPhoto(p);
      }
    }

    // Vor/zurück (Wischen). Vergangene Tage werden nicht angezeigt.
    _go(dir) {
      const today = sod(new Date());
      let a;
      if (this._view === "tag") { a = addDays(this._anchor, dir); if (a < today) a = today; }
      else if (this._view === "monat") { a = new Date(this._anchor.getFullYear(), this._anchor.getMonth() + dir, 1); if (a < new Date(today.getFullYear(), today.getMonth(), 1)) a = today; }
      else {
        const start = this._visibleRange()[0];
        a = dir > 0 ? addDays(sow(start), 7) : addDays(sow(start), -7);
        if (addDays(a, 7) <= today) a = today;
        if (dir < 0 && +this._visibleRange()[0] === +today) { this._bump(dir); return; }
      }
      if (+a === +this._anchor) { this._bump(dir); return; }
      this._anchor = a; this._slide = dir; this._dayScrolled = null;
      this._refreshCalendars(); this._render();
    }
    _bump(dir) {
      const m = this.shadowRoot.querySelector(".main");
      if (!m) return;
      m.classList.remove("bump-l", "bump-r"); void m.offsetWidth; m.classList.add(dir > 0 ? "bump-l" : "bump-r");
    }
    _bindSwipe(root) {
      let st = null;
      root.addEventListener("pointerdown", (e) => {
        if (!e.target.closest(".main") || e.target.closest("input,textarea")) { st = null; return; }
        st = { x: e.clientX, y: e.clientY, t: Date.now() };
      });
      root.addEventListener("pointerup", (e) => {
        if (!st) return;
        const dx = e.clientX - st.x, dy = e.clientY - st.y, dt = Date.now() - st.t;
        st = null;
        if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy) && dt < 900) { this._swiped = true; this._go(dx < 0 ? 1 : -1); }
      });
      root.addEventListener("pointercancel", () => (st = null));
    }

    _click(e) {
      if (this._lpFired) { this._lpFired = false; return; }
      if (this._swiped) { this._swiped = false; return; }
      const el = e.target.closest("[data-act]");
      if (!el) return;
      const a = el.dataset.act;
      const h = this._hass;
      switch (a) {
        case "view": this._view = el.dataset.v; lsSet("fp-view", this._view); this._refreshCalendars(); this._render(); break;
        case "prev": case "next": this._go(a === "next" ? 1 : -1); break;
        case "heute": this._anchor = sod(new Date()); this._dayScrolled = null; this._refreshCalendars(); this._render(); break;
        case "orient": this._orient = { auto: "hoch", hoch: "quer", quer: "auto" }[this._orient]; lsSet("fp-orient", this._orient); this._render(); break;
        case "goday": this._anchor = parseYmd(el.dataset.day); if (this._anchor < sod(new Date())) this._anchor = sod(new Date()); this._view = "tag"; lsSet("fp-view", "tag"); this._refreshCalendars(); this._render(); break;
        case "person": {
          const n = el.dataset.name;
          this._hidden.has(n) ? this._hidden.delete(n) : this._hidden.add(n);
          lsSet("fp-hidden", JSON.stringify([...this._hidden])); this._render(); break;
        }
        case "ev": { const ev = (this._events[el.dataset.key] || [])[+el.dataset.idx]; if (ev) this._openEvent(ev, el.dataset.key); break; }
        case "meal": this._openMeal(parseYmd(el.dataset.day)); break;
        case "note": this._openText({ title: "Pinnwand", value: h.states[this._config.notiz]?.state || "", max: 255, multiline: true, clear: true,
          save: (v) => h.callService("input_text", "set_value", { entity_id: this._config.notiz, value: v }) }); break;
        case "shoplist": this._shopList = el.dataset.id; lsSet("fp-shop", this._shopList); this._render(); break;
        case "shopdone": {
          const uid = el.dataset.uid;
          el.closest("li").classList.add("going");
          h.callService("todo", "update_item", { item: uid, status: "completed" }, { entity_id: this._shopList }).then(() => this._loadTodo(this._shopList));
          break;
        }
        case "addshop": this._openText({ title: "Auf die Einkaufsliste", placeholder: "z. B. Milch", repeat: true,
          save: (v) => h.callService("todo", "add_item", { item: v }, { entity_id: this._shopList }).then(() => this._loadTodo(this._shopList)) }); break;
        case "chore": {
          const id = el.dataset.id, done = el.dataset.done === "1", st = el.dataset.st;
          h.callService("todo", "update_item", { item: el.dataset.uid, status: done ? "needs_action" : "completed" }, { entity_id: id }).then(() => this._loadTodo(id));
          if (st) h.callService("counter", done ? "decrement" : "increment", { entity_id: st });
          if (!done) this._celebrate(el);
          break;
        }
        case "addchore": { const id = el.dataset.id; this._openText({ title: "Neues Ämtli", placeholder: "z. B. Tisch decken", repeat: true,
          save: (v) => h.callService("todo", "add_item", { item: v }, { entity_id: id }).then(() => this._loadTodo(id)) }); break; }
        case "stars": this._openConfirm(`Sterne von ${el.dataset.name} auf 0 setzen?`, "Auf 0 setzen", () => h.callService("counter", "reset", { entity_id: el.dataset.id })); break;
        case "addcd": this._openCountdown(); break;
        case "cdinfo": {
          const cd = this._findByName("todo", this._config.countdowns);
          const it = (this._todos[cd] || []).find((i) => i.uid === el.dataset.uid);
          if (it) this._openConfirm(`«${it.summary}» aus den Countdowns entfernen?`, "Entfernen", () => h.callService("todo", "remove_item", { item: it.uid }, { entity_id: cd }).then(() => this._loadTodo(cd)));
          break;
        }
        case "baldweg": {
          const key = el.dataset.key, liste = this._bildListe();
          if (!key) break;
          if (!liste) { this._openConfirm("Dafür braucht es die Liste «Planer Bilder». Oben auf «Jetzt anlegen» tippen.", "OK", async () => {}); break; }
          this._openConfirm(`«${el.dataset.title}» bei «Bald» ausblenden?`, "Ausblenden", () => h.callService("todo", "add_item", { item: `Ausgeblendet: ${key}`, description: "bald" }, { entity_id: liste }).then(() => this._loadTodo(liste)));
          break;
        }
        case "setup": this._runSetup(); break;
        case "bilder": this._openBilderListe(); break;
        case "stargive": case "reward": case "redeem": {
          const p = this._config.personen.find((x) => x.name === el.dataset.name);
          if (!p || !p.sterne) break;
          if (a === "stargive") {
            const before = Math.max(0, parseInt(h.states[p.sterne]?.state, 10) || 0);
            h.callService("counter", "increment", { entity_id: p.sterne });
            this._celebrate(el, before + 1 >= this._reward(p).ziel ? 9 : 1);
          } else if (a === "reward") this._openReward(p);
          else {
            const r = this._reward(p);
            this._openConfirm(`${p.name} hat ${r.ziel} Sterne gesammelt! Belohnung «${r.text || "Belohnung"}» einlösen? Danach beginnt das Sammeln wieder bei 0.`, "Einlösen", async () => {
              await h.callService("counter", "reset", { entity_id: p.sterne });
              const app = this.shadowRoot.querySelector("#app");
              if (app) this._celebrate(app.querySelector(".starsp") || app, 14);
            });
          }
          break;
        }
        case "zuhause": {
          const z = String(this._config.zuhause_link || "");
          if (!z.startsWith("/")) break;
          history.pushState(null, "", z);
          window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
          break;
        }
      }
    }

    _celebrate(el, count = 1) {
      const r = el.getBoundingClientRect();
      const app = this.shadowRoot.querySelector("#app");
      const host = app.getBoundingClientRect();
      for (let k = 0; k < count; k++) {
        const s = document.createElement("div");
        s.className = "burst";
        const dx = count > 1 ? (Math.random() - 0.5) * Math.min(260, r.width) : 0;
        s.style.left = `${r.left - host.left + (count > 1 ? r.width / 2 : 14) + dx}px`; s.style.top = `${r.top - host.top + r.height / 2}px`;
        s.style.animationDelay = `${k * 60}ms`;
        s.innerHTML = `<ha-icon icon="mdi:star"></ha-icon>`;
        app.appendChild(s);
        setTimeout(() => s.remove(), 1000 + k * 60);
      }
    }

    async _runSetup() {
      if (this._busy || !this._missing?.length) return;
      this._busy = true; this._msg = ""; this._render();
      const errs = [];
      for (const m of this._missing) {
        try {
          let r = await this._hass.callApi("POST", "config/config_entries/flow", { handler: m.handler, show_advanced_options: false });
          let guard = 0;
          while (r.type === "form" && guard++ < 3) {
            const data = {};
            (r.data_schema || []).forEach((f) => {
              if (/name/.test(f.name)) data[f.name] = m.name;
              else if (f.name === "import") data[f.name] = "create_empty";
              else if (f.required && f.default !== undefined) data[f.name] = f.default;
            });
            r = await this._hass.callApi("POST", `config/config_entries/flow/${r.flow_id}`, data);
            if (r.type === "form" && r.errors && Object.keys(r.errors).length) throw new Error(JSON.stringify(r.errors));
          }
          if (r.type !== "create_entry") throw new Error(r.reason || r.type);
        } catch (e) { errs.push(`${m.name}: ${e.message || e}`); }
      }
      this._busy = false;
      this._msg = errs.length ? `Nicht angelegt: ${errs.join("; ")}` : "";
      setTimeout(() => { this._loadTodos(); this._refreshCalendars(true); this._loadExtras(); }, 2500);
      this._render();
    }

    // ---------- Dialoge ----------
    _modal(html) {
      const m = this.shadowRoot.querySelector("#modal");
      const app = this.shadowRoot.querySelector("#app");
      m.className = `fp-modal ${app.classList.contains("dark") ? "dark" : ""}`;
      m.innerHTML = html ? `<div class="scrim" data-m="close"></div><div class="dlg" role="dialog">${html}</div>` : "";
      if (html) setTimeout(() => m.querySelector("input[autofocus], textarea[autofocus]")?.focus(), 50);
      else this._mh = null;
    }
    _modalClick(e) {
      const el = e.target.closest("[data-m]");
      if (!el) return;
      const k = el.dataset.m;
      if (k === "close") return this._modal("");
      if (this._mh && this._mh[k]) this._mh[k](el);
    }

    _openEvent(e, key) {
      const c = this._config;
      const who = key === "familie" ? c.familie : c.personen[+key.slice(1)];
      const calName = this._hass.states[e.cal]?.attributes.friendly_name || e.cal;
      let when;
      if (e.allDay) {
        const last = addDays(e.end, -1);
        when = sameDay(e.start, last) ? `${WDL[e.start.getDay()]}, ${e.start.getDate()}. ${MO[e.start.getMonth()]}, ganztags` : `${e.start.getDate()}. ${MOS[e.start.getMonth()]} – ${last.getDate()}. ${MOS[last.getMonth()]}, ganztags`;
      } else when = `${WDL[e.start.getDay()]}, ${e.start.getDate()}. ${MO[e.start.getMonth()]}, ${hm(e.start)}–${hm(e.end)}`;
      this._mh = { bild: () => this._openBild(e) };
      this._modal(`
        <div class="dlg-h" style="--c:${who?.farbe}"><span class="bar"></span><h2>${esc(e.title)}</h2></div>
        <div class="dlg-b">
          <p class="row"><ha-icon icon="mdi:clock-outline"></ha-icon>${when}</p>
          ${e.location ? `<p class="row"><ha-icon icon="mdi:map-marker-outline"></ha-icon>${esc(e.location)}</p>` : ""}
          <p class="row"><ha-icon icon="mdi:calendar-account"></ha-icon>${esc(who?.name || "")} · ${esc(calName)}</p>
          ${e.description ? `<p class="desc">${esc(e.description).replace(/\n/g, "<br>")}</p>` : ""}
        </div>
        <div class="dlg-f"><button class="btn ghost" data-m="bild">${this._bildFor(e.title) ? "Bild ändern" : "Bild zuweisen"}</button><span class="hint">Termine werden in Google Kalender bearbeitet.</span><button class="btn" data-m="close">Schliessen</button></div>`);
    }

    // ---------- Essen: Vorlieben und Vorschläge ----------
    _mealPrefs() {
      const fav = new Map(), no = new Set();
      (this._todos[this._bildListe()] || []).forEach((i) => {
        const m = /^Essen ([♥✗]) (.+)$/.exec(i.summary || "");
        if (!m) return;
        if (m[1] === "♥") fav.set(m[2].trim().toLowerCase(), { title: m[2].trim(), uid: i.uid });
        else no.add(m[2].trim().toLowerCase());
      });
      return { fav, no };
    }
    _noItem(title) { return (this._todos[this._bildListe()] || []).find((i) => i.summary === `Essen ✗ ${title}`); }
    async _toggleMealPref(kind, title) {
      const h = this._hass, liste = this._bildListe();
      if (!liste || !title) return;
      const it = (this._todos[liste] || []).find((i) => i.summary === `Essen ${kind} ${title}`);
      if (it) await h.callService("todo", "remove_item", { item: it.uid }, { entity_id: liste });
      else await h.callService("todo", "add_item", { item: `Essen ${kind} ${title}`, description: "essen" }, { entity_id: liste });
      await this._loadTodo(liste);
    }
    // Bewertet alle bekannten Gerichte für einen Tag: Lieblingsessen, Wochentag-Gewohnheit, Häufigkeit, Abwechslung
    _mealSuggest(day, n = 8, extra = []) {
      const { fav, no } = this._mealPrefs();
      const hist = [...(this._mealHist || []), ...extra];
      const ds = sod(day);
      const by = new Map();
      hist.forEach((e) => {
        const k = e.title.toLowerCase();
        const o = by.get(k) || { title: e.title, cnt: 0, dow: 0, last: null, near: false };
        if (e.d < ds) { o.cnt++; if (e.d.getDay() === ds.getDay()) o.dow++; if (!o.last || e.d > o.last) o.last = e.d; }
        if (Math.abs(e.d - ds) <= 3 * 864e5 && +e.d !== +ds) o.near = true;
        by.set(k, o);
      });
      fav.forEach((f, k) => { if (!by.has(k)) by.set(k, { title: f.title, cnt: 0, dow: 0, last: null, near: false }); });
      const out = [];
      by.forEach((o, k) => {
        if (no.has(k)) return;
        const isFav = fav.has(k);
        let score = Math.log(1 + o.cnt) + (isFav ? 2.5 : 0);
        let why = isFav ? "Lieblingsessen" : "";
        if (o.cnt >= 2 && o.dow / o.cnt >= 0.4) { score += 1.5 * (o.dow / o.cnt); why = why || `oft am ${WDL[ds.getDay()]}`; }
        if (o.last) {
          const since = Math.round((ds - o.last) / 864e5);
          if (since < 7) score -= 4; else if (since < 14) score -= 1.5; else { score += Math.min(since, 90) / 90; if (since >= 30) why = why || "lange nicht mehr"; }
        }
        if (o.near) score -= 3;
        if (!why && o.cnt >= 3) why = "oft gekocht";
        out.push({ title: o.title, score, why, fav: isFav, cnt: o.cnt });
      });
      return out.sort((x, y) => y.score - x.score).slice(0, n);
    }

    _openMeal(day) {
      const ess = this._cals([this._config.essensplan])[0];
      const cur = this._meal(day);
      const label = `${WDL[day.getDay()]}, ${day.getDate()}. ${MO[day.getMonth()]}`;
      if (!ess) { this._mh = {}; this._modal(`<div class="dlg-h"><h2>Essensplan</h2></div><div class="dlg-b"><p>Der Kalender «${esc(this._config.essensplan)}» fehlt noch. Oben auf «Jetzt anlegen» tippen.</p></div><div class="dlg-f"><button class="btn" data-m="close">OK</button></div>`); return; }
      const h = this._hass;
      const { fav } = this._mealPrefs();
      const vors = this._mealSuggest(day, 8).filter((x) => x.title !== cur?.title);
      const shown = new Set(vors.map((x) => x.title.toLowerCase()));
      const favs = [...fav.values()].map((f) => f.title).filter((t) => !shown.has(t.toLowerCase()) && t !== cur?.title);
      favs.forEach((t) => shown.add(t.toLowerCase()));
      const rest = this._suggest.filter((x) => !shown.has(x.toLowerCase()) && x !== cur?.title).slice(0, 12);
      const save = async (v) => {
        v = (v || "").trim();
        const ev = { summary: v, dtstart: ymd(day), dtend: ymd(addDays(day, 1)) };
        try {
          if (cur && cur.uid) {
            if (!v) await h.callWS({ type: "calendar/event/delete", entity_id: ess, uid: cur.uid, ...(cur.rid ? { recurrence_id: cur.rid } : {}) });
            else await h.callWS({ type: "calendar/event/update", entity_id: ess, uid: cur.uid, event: ev, ...(cur.rid ? { recurrence_id: cur.rid } : {}) });
          } else if (v) await h.callWS({ type: "calendar/event/create", entity_id: ess, event: ev });
        } catch (err) { this._msg = `Essen nicht gespeichert: ${err.message || err.code || err}`; }
        this._modal("");
        this._refreshCalendars(true);
        this._loadExtras();
      };
      const inp = () => this.shadowRoot.querySelector("#fp-in");
      const favBtn = () => { const t = inp().value.trim(); const b = this.shadowRoot.querySelector('[data-m="fav"]'); if (b) { const on = this._mealPrefs().fav.has(t.toLowerCase()); b.classList.toggle("on", on); b.innerHTML = `<ha-icon icon="${on ? "mdi:heart" : "mdi:heart-outline"}"></ha-icon>${on ? "Lieblingsessen" : "Als Lieblingsessen"}`; } };
      this._mh = {
        save: () => save(inp().value),
        del: () => save(""),
        pick: (el) => { inp().value = el.dataset.v; save(el.dataset.v); },
        fav: async () => { const t = inp().value.trim(); if (!t) return; await this._toggleMealPref("♥", t); favBtn(); },
        nope: async (el) => { const t = el.dataset.v; await this._toggleMealPref("✗", t); el.closest(".mchip")?.remove(); },
        fill: () => this._openFillWeek(),
      };
      const chip = (x, why) => `<span class="mchip ${x.fav ? "fav" : ""}"><button data-m="pick" data-v="${esc(x.title)}">${x.fav ? '<ha-icon icon="mdi:heart"></ha-icon>' : ""}${esc(x.title)}${why ? `<small>${esc(why)}</small>` : ""}</button><button class="nope" data-m="nope" data-v="${esc(x.title)}" aria-label="${esc(x.title)} nicht mehr vorschlagen" title="Nicht mehr vorschlagen"><ha-icon icon="mdi:close"></ha-icon></button></span>`;
      this._modal(`
        <div class="dlg-h"><ha-icon icon="mdi:silverware-fork-knife"></ha-icon><h2>Essen am ${label}</h2></div>
        <div class="dlg-b">
          <div class="mealin"><input id="fp-in" type="text" autofocus placeholder="Was gibt es?" value="${esc(cur?.title || "")}" enterkeyhint="done">
            <button class="btn ghost favbtn" data-m="fav"></button></div>
          ${vors.length ? `<div class="sug"><span class="lbl">Vorschläge für ${WDL[day.getDay()]}</span>${vors.map((x) => chip(x, x.why)).join("")}</div>` : `<p class="hint2">Noch keine Vorschläge: Sobald ein paar Wochen geplant sind, lernt der Planer eure Gewohnheiten. Lieblingsessen mit dem Herz markieren.</p>`}
          ${favs.length ? `<div class="sug"><span class="lbl">Weitere Lieblingsessen</span>${favs.map((t) => chip({ title: t, fav: true }, "")).join("")}</div>` : ""}
          ${rest.length ? `<div class="sug"><span class="lbl">Schon gekocht</span>${rest.map((t) => chip({ title: t }, "")).join("")}</div>` : ""}
        </div>
        <div class="dlg-f">${cur ? `<button class="btn ghost" data-m="del">Entfernen</button>` : ""}<button class="btn ghost" data-m="fill"><ha-icon icon="mdi:auto-fix"></ha-icon>Woche füllen</button><span class="sp"></span><button class="btn ghost" data-m="close">Abbrechen</button><button class="btn" data-m="save">Speichern</button></div>`);
      this.shadowRoot.querySelector("#modal .dlg").classList.add("wide");
      favBtn();
      inp().addEventListener("input", favBtn);
      inp().addEventListener("keydown", (e) => { if (e.key === "Enter") this._mh.save(); });
    }

    // Leere Tage der nächsten 7 Tage mit Vorschlägen füllen (mit Vorschau)
    _openFillWeek() {
      const ess = this._cals([this._config.essensplan])[0];
      const h = this._hass;
      const today = sod(new Date());
      const plan = [], extra = [];
      for (let k = 0; k < 7; k++) {
        const d = addDays(today, k);
        if (this._meal(d) || (this._mealHist || []).some((e) => +e.d === +d)) continue;
        const best = this._mealSuggest(d, 6, extra).find((x) => !plan.some((p) => p.title.toLowerCase() === x.title.toLowerCase()));
        if (best) { plan.push({ d, title: best.title }); extra.push({ title: best.title, d }); }
      }
      if (!plan.length) { this._openConfirm(this._mealHist?.length ? "Die nächsten 7 Tage sind schon geplant." : "Noch zu wenig Erfahrung: Plane zuerst ein paar Essen von Hand oder markiere Lieblingsessen.", "OK", async () => {}); return; }
      this._mh = {
        ok: async () => {
          for (const p of plan) { try { await h.callWS({ type: "calendar/event/create", entity_id: ess, event: { summary: p.title, dtstart: ymd(p.d), dtend: ymd(addDays(p.d, 1)) } }); } catch (e) { /* weiter */ } }
          this._modal(""); this._refreshCalendars(true); this._loadExtras();
        },
      };
      this._modal(`
        <div class="dlg-h"><ha-icon icon="mdi:auto-fix"></ha-icon><h2>Vorschlag für die Woche</h2></div>
        <div class="dlg-b"><ul class="fillist">${plan.map((p) => `<li><span>${WD[p.d.getDay()]} ${p.d.getDate()}.${p.d.getMonth() + 1}.</span><b>${esc(p.title)}</b></li>`).join("")}</ul>
          <p class="hint2">Bereits geplante Tage bleiben, wie sie sind. Einzelne Essen kannst du danach wie gewohnt ändern.</p></div>
        <div class="dlg-f"><span class="sp"></span><button class="btn ghost" data-m="close">Abbrechen</button><button class="btn" data-m="ok">Übernehmen</button></div>`);
    }

    _openText({ title, value = "", placeholder = "", max = 255, multiline = false, clear = false, repeat = false, save }) {
      this._mh = {
        save: async () => {
          const inp = this.shadowRoot.querySelector("#fp-in");
          const v = inp.value.trim();
          if (!v && !clear) return;
          await save(v);
          if (repeat) { inp.value = ""; inp.focus(); this._flash(`«${v}» hinzugefügt`); } else this._modal("");
        },
        clear: async () => { await save(""); this._modal(""); },
      };
      const val = value === "unknown" || value === "unavailable" ? "" : value;
      this._modal(`
        <div class="dlg-h"><h2>${esc(title)}</h2></div>
        <div class="dlg-b">
          ${multiline ? `<textarea id="fp-in" rows="4" maxlength="${max}" autofocus placeholder="${esc(placeholder)}">${esc(val)}</textarea>` : `<input id="fp-in" type="text" maxlength="${max}" autofocus placeholder="${esc(placeholder)}" value="${esc(val)}" enterkeyhint="done">`}
          <div class="flash"></div>
        </div>
        <div class="dlg-f">${clear && val ? `<button class="btn ghost" data-m="clear">Löschen</button>` : ""}<span class="sp"></span><button class="btn ghost" data-m="close">${repeat ? "Fertig" : "Abbrechen"}</button><button class="btn" data-m="save">${repeat ? "Hinzufügen" : "Speichern"}</button></div>`);
      const inp = this.shadowRoot.querySelector("#fp-in");
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && !multiline) this._mh.save(); });
    }

    _flash(t) { const f = this.shadowRoot.querySelector("#modal .flash"); if (f) { f.textContent = t; clearTimeout(this._ft); this._ft = setTimeout(() => (f.textContent = ""), 1800); } }

    _openConfirm(text, okLabel, ok) {
      this._mh = { ok: async () => { await ok(); this._modal(""); } };
      this._modal(`<div class="dlg-b"><p class="q">${esc(text)}</p></div><div class="dlg-f"><span class="sp"></span><button class="btn ghost" data-m="close">Abbrechen</button><button class="btn" data-m="ok">${esc(okLabel)}</button></div>`);
    }

    _openCountdown() {
      const cd = this._findByName("todo", this._config.countdowns);
      const h = this._hass;
      this._mh = {
        save: async () => {
          const t = this.shadowRoot.querySelector("#fp-in").value.trim();
          const d = this.shadowRoot.querySelector("#fp-d").value;
          if (!t || !d) return;
          await h.callService("todo", "add_item", { item: t, due_date: d }, { entity_id: cd });
          this._loadTodo(cd); this._modal("");
        },
      };
      this._modal(`
        <div class="dlg-h"><ha-icon icon="mdi:party-popper"></ha-icon><h2>Neuer Countdown</h2></div>
        <div class="dlg-b">
          <input id="fp-in" type="text" autofocus placeholder="z. B. Ferien in Italien">
          <input id="fp-d" type="date" value="${ymd(addDays(new Date(), 14))}">
        </div>
        <div class="dlg-f"><span class="sp"></span><button class="btn ghost" data-m="close">Abbrechen</button><button class="btn" data-m="save">Hinzufügen</button></div>`);
    }

    _openBild(ev) { this._openBildKey(ev.title, null); }
    _openBilderListe() {
      const custom = this._customBilder();
      const items = THEMEN.map((t) => {
        const first = t.keys.split("|")[0];
        const key = /^[a-zäöü ]+$/i.test(first) ? first : t.name;
        const c = custom.find((m) => t.re.test(m.key) || m.key.toLowerCase() === key.toLowerCase());
        return { name: t.name, keys: t.keys.replace(/\\[bs]|\\\.|\?/g, "").split("|").slice(0, 4).join(", "), val: c ? c.val : "url:" + t.url, key, changed: !!c };
      });
      custom.filter((m) => !THEMEN.some((t) => t.re.test(m.key))).forEach((m) => items.push({ name: m.key, keys: m.key, val: m.val, key: m.key, changed: true }));
      this._mh = { open: (el) => { const it = items[+el.dataset.i]; this._openBildKey(it.name, it.key); }, neu: () => this._openBildKey("Neues Thema", "") };
      this._modal(`
        <div class="dlg-h"><ha-icon icon="mdi:image-multiple-outline"></ha-icon><h2>Bilder zu Terminen</h2></div>
        <div class="dlg-b"><p class="hint2">Ein Termin bekommt das Bild des ersten Themas, dessen Stichwort im Titel vorkommt. Antippen, um ein Bild zu ändern.</p>
          <div class="blist">${items.map((it, i) => `<button class="bitem" data-m="open" data-i="${i}">${this._bildHtml(it.val, "bthumb")}<span class="bt"><b>${esc(it.name)}</b><span>${esc(it.keys)}</span></span>${it.changed ? `<span class="bchg">geändert</span>` : ""}</button>`).join("")}</div>
        </div>
        <div class="dlg-f"><button class="btn ghost" data-m="neu">+ Neues Thema</button><span class="sp"></span><button class="btn" data-m="close">Fertig</button></div>`);
      this.shadowRoot.querySelector("#modal .dlg").classList.add("wide");
    }
    _openBildKey(title, fixedKey) {
      const ev = { title };
      const h = this._hass;
      const liste = this._bildListe();
      if (!liste) { this._mh = {}; this._modal(`<div class="dlg-h"><h2>Bild für Termine</h2></div><div class="dlg-b"><p>Dafür braucht es die Liste «${esc(this._config.bilderliste)}». Oben auf «Jetzt anlegen» tippen.</p></div><div class="dlg-f"><span class="sp"></span><button class="btn" data-m="close">OK</button></div>`); return; }
      const t = ev.title.toLowerCase();
      const cur = this._customBilder().find((m) => t.includes(m.key.toLowerCase()));
      const def = this._themaFor(ev.title);
      let wahl = cur ? cur.val : def ? "url:" + def.url : "";
      const keyDefault = fixedKey === "" ? "" : fixedKey || (cur ? cur.key : ev.title.replace(/\s*\(.*?\)\s*/g, " ").trim());
      const prev = () => { const el = this.shadowRoot.querySelector("#fp-prev"); if (el) el.innerHTML = wahl ? this._bildHtml(wahl, "bigpic") : `<span class="bigpic empty">?</span>`; };
      const save = async (val) => {
        const key = this.shadowRoot.querySelector("#fp-in").value.trim();
        if (!key) return;
        const same = this._customBilder().find((m) => m.key.toLowerCase() === key.toLowerCase());
        if (same) await h.callService("todo", "update_item", { item: same.uid, description: val }, { entity_id: liste });
        else await h.callService("todo", "add_item", { item: key, description: val }, { entity_id: liste });
        await this._loadTodo(liste);
        this._modal("");
      };
      const themen = [
        ...THEMEN.map((t) => { const c = this._customBilder().find((m) => t.re.test(m.key)); return { name: t.name, val: c ? c.val : "url:" + t.url }; }),
        ...this._customBilder().filter((m) => !THEMEN.some((t) => t.re.test(m.key))).map((m) => ({ name: m.key, val: m.val })),
      ];
      this._mh = {
        pick: (el) => { wahl = el.dataset.v; prev(); this.shadowRoot.querySelectorAll(".emo button, .thm button").forEach((b) => b.classList.toggle("on", b === el)); },
        thema: (el) => { wahl = themen[+el.dataset.i].val; prev(); this.shadowRoot.querySelectorAll(".emo button, .thm button").forEach((b) => b.classList.toggle("on", b === el)); },
        foto: () => this.shadowRoot.querySelector("#fp-file").click(),
        save: () => wahl && save(wahl),
        del: async () => { await h.callService("todo", "remove_item", { item: cur.uid }, { entity_id: liste }); await this._loadTodo(liste); this._modal(""); },
      };
      this._modal(`
        <div class="dlg-h"><h2>Bild für «${esc(ev.title)}»</h2></div>
        <div class="dlg-b">
          <div class="bildtop"><div id="fp-prev"></div>
            <label class="kw">Gilt für alle Termine mit<input id="fp-in" type="text" value="${esc(keyDefault)}"></label></div>
          <div class="sect">Bestehendes Thema wählen</div>
          <div class="thm">${themen.map((t, i) => `<button data-m="thema" data-i="${i}" class="${t.val === wahl ? "on" : ""}">${this._bildHtml(t.val, "thpic")}<span>${esc(t.name)}</span></button>`).join("")}</div>
          <div class="sect">Oder ein Emoji</div>
          <div class="emo">${EMOJI_WAHL.map((e) => `<button data-m="pick" data-v="${e}" class="${e === wahl ? "on" : ""}">${e}</button>`).join("")}</div>
          <label class="kw">Oder Bild-Adresse aus dem Internet einfügen<input id="fp-url" type="url" placeholder="https://…" value="${esc(wahl.startsWith("url:") && !def ? wahl.slice(4) : "")}"></label>
          <input id="fp-file" type="file" accept="image/*" hidden>
          <div class="flash"></div>
        </div>
        <div class="dlg-f">${cur ? `<button class="btn ghost" data-m="del">Standard</button>` : ""}<button class="btn ghost" data-m="foto">Eigenes Foto …</button><span class="sp"></span><button class="btn ghost" data-m="close">Abbrechen</button><button class="btn" data-m="save">Speichern</button></div>`);
      prev();
      this.shadowRoot.querySelector("#fp-url").addEventListener("input", (e3) => { const v = e3.target.value.trim(); if (/^https?:\/\//.test(v)) { wahl = "url:" + v; prev(); } });
      this.shadowRoot.querySelector("#fp-file").addEventListener("change", async (e2) => {
        const f = e2.target.files[0];
        if (!f) return;
        this._flash("Lade hoch …");
        try {
          const blob = await this._squareJpeg(f, 400);
          const fd = new FormData();
          fd.append("file", blob, "termin.jpg");
          const res = await h.fetchWithAuth("/api/image/upload", { method: "POST", body: fd });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const j = await res.json();
          wahl = `img:${j.id}`; prev(); this._flash("Foto bereit, jetzt speichern.");
        } catch (err) { this._flash(`Hochladen fehlgeschlagen: ${err.message || err}`); }
      });
    }

    _openPhoto(p) {
      const h = this._hass;
      const img = this._photo(p);
      const FARBEN = ["#d6336c", "#e8590c", "#2b8a3e", "#7048e8", "#1971c2", "#0c8599", "#f08c00", "#c92a2a", "#a61e4d", "#5f3dc4", "#66a80f", "#495057"];
      const setC = (c) => { this.shadowRoot.querySelectorAll("#modal [style*='--c']").forEach((el) => el.style.setProperty("--c", c)); this.shadowRoot.querySelectorAll(".sw").forEach((b) => b.classList.toggle("on", b.dataset.v === c)); };
      this._mh = {
        pick: () => this.shadowRoot.querySelector("#fp-file").click(),
        remove: async () => { await h.callService("input_text", "set_value", { entity_id: p.foto, value: "" }); this._modal(""); },
        crop: () => { const inf = this._photoInfo(p); this._openCrop(p, inf ? `/api/image/serve/${inf.orig}/original` : img, null, inf); },
        farbe: async (el) => { setC(el.dataset.v); await this._setFarbe(p, el.dataset.v); },
        farbstd: async () => { setC(p.farbeStandard); await this._setFarbe(p, null); },
      };
      this._modal(`
        <div class="dlg-h" style="--c:${p.farbe}"><span class="bar"></span><h2>${esc(p.name)}</h2></div>
        <div class="dlg-b center">
          <div class="bigav" style="--c:${p.farbe}">${img ? `<img src="${esc(img)}" alt="">` : `<span class="ini">${esc(p.name[0])}</span>`}</div>
          <div class="farben"><span class="lbl">Farbe</span>
            ${FARBEN.map((c) => `<button class="sw ${c === p.farbe ? "on" : ""}" data-m="farbe" data-v="${c}" style="background:${c}" aria-label="Farbe ${c}"></button>`).join("")}
            <label class="sw eigene" title="Eigene Farbe"><input id="fp-col" type="color" value="${p.farbe}"><ha-icon icon="mdi:palette"></ha-icon></label>
            ${p.farbe !== p.farbeStandard ? `<button class="lnk" data-m="farbstd">Standard</button>` : ""}
          </div>
          <input id="fp-file" type="file" accept="image/*" hidden>
          <div class="flash"></div>
        </div>
        <div class="dlg-f">${img ? `<button class="btn ghost" data-m="remove">Foto entfernen</button><button class="btn ghost" data-m="crop">Ausschnitt</button>` : ""}<span class="sp"></span><button class="btn ghost" data-m="close">Abbrechen</button><button class="btn" data-m="pick">Foto wählen</button></div>`);
      this.shadowRoot.querySelector("#fp-col").addEventListener("change", async (e4) => { const c = e4.target.value; setC(c); await this._setFarbe(p, c); });
      this.shadowRoot.querySelector("#fp-file").addEventListener("change", (ev) => {
        const f = ev.target.files[0];
        if (f) this._openCrop(p, URL.createObjectURL(f), f, null);
      });
    }

    // Zuschneiden: Bild verschieben (ziehen), vergrössern (Regler oder zwei Finger)
    _openCrop(p, src, file, info) {
      const h = this._hass;
      const S = 280;
      let im = null, base = 1, z = info?.z || 1, ox = 0, oy = 0;
      this._mh = {
        zin: () => setZoom(z * 1.25), zout: () => setZoom(z / 1.25),
        back: () => this._openPhoto(p),
        ok: () => save(),
      };
      this._modal(`
        <div class="dlg-h" style="--c:${p.farbe}"><span class="bar"></span><h2>Ausschnitt für ${esc(p.name)}</h2></div>
        <div class="dlg-b center">
          <div class="cropstage" style="width:${S}px;height:${S}px"><img id="fp-cimg" alt="" draggable="false"><span class="cropmask"></span></div>
          <div class="cropzoom"><button class="add" data-m="zout" aria-label="Kleiner"><ha-icon icon="mdi:minus"></ha-icon></button>
            <input id="fp-z" type="range" min="1" max="5" step="0.01" value="${z}" aria-label="Vergrössern">
            <button class="add" data-m="zin" aria-label="Grösser"><ha-icon icon="mdi:plus"></ha-icon></button></div>
          <p class="hint2">Bild mit dem Finger verschieben, mit dem Regler oder zwei Fingern vergrössern.</p>
          <div class="flash"></div>
        </div>
        <div class="dlg-f"><button class="btn ghost" data-m="back">Zurück</button><span class="sp"></span><button class="btn" data-m="ok">Übernehmen</button></div>`);
      const root = this.shadowRoot;
      const el = root.querySelector("#fp-cimg"), stage = root.querySelector(".cropstage"), zr = root.querySelector("#fp-z");
      const clamp = () => {
        const dw = im.naturalWidth * base * z, dh = im.naturalHeight * base * z;
        ox = Math.min(0, Math.max(S - dw, ox)); oy = Math.min(0, Math.max(S - dh, oy));
        el.style.width = `${dw}px`; el.style.height = `${dh}px`; el.style.transform = `translate(${ox}px, ${oy}px)`;
      };
      const setZoom = (nz, cx = S / 2, cy = S / 2) => {
        if (!im) return;
        nz = Math.min(5, Math.max(1, nz));
        ox = cx - (cx - ox) * (nz / z); oy = cy - (cy - oy) * (nz / z);
        z = nz; zr.value = z; clamp();
      };
      el.onload = () => {
        im = el; base = S / Math.min(im.naturalWidth, im.naturalHeight);
        const dw = im.naturalWidth * base * z, dh = im.naturalHeight * base * z;
        ox = S / 2 - (info ? info.x : 0.5) * dw; oy = S / 2 - (info ? info.y : 0.5) * dh;
        clamp();
      };
      el.onerror = () => this._flash("Bild konnte nicht geladen werden.");
      el.src = src;
      zr.addEventListener("input", () => setZoom(+zr.value));
      // Ziehen und Zwei-Finger-Zoom
      const pts = new Map();
      let last = null, pinch = null;
      stage.addEventListener("pointerdown", (e) => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY]; pinch = null; });
      stage.addEventListener("pointermove", (e) => {
        if (!pts.has(e.pointerId) || !im) return;
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size >= 2) {
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          const r = stage.getBoundingClientRect();
          if (pinch) setZoom(pinch.z * d / pinch.d, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
          else pinch = { d, z };
          return;
        }
        ox += e.clientX - last[0]; oy += e.clientY - last[1]; last = [e.clientX, e.clientY]; clamp();
      });
      const up = (e) => { pts.delete(e.pointerId); pinch = null; if (pts.size === 1) last = [...pts.values()][0]; };
      stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
      stage.addEventListener("wheel", (e) => { e.preventDefault(); const r = stage.getBoundingClientRect(); setZoom(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top); }, { passive: false });

      const upload = async (blob, name) => {
        const fd = new FormData();
        fd.append("file", blob, name);
        const res = await h.fetchWithAuth("/api/image/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()).id;
      };
      const toBlob = (cv) => new Promise((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error("Bild konnte nicht erstellt werden"))), "image/jpeg", 0.88));
      const save = async () => {
        if (!im) return;
        this._flash("Speichere …");
        try {
          const k = base * z, sx = -ox / k, sy = -oy / k, ss = S / k;
          const cv = document.createElement("canvas"); cv.width = cv.height = 640;
          cv.getContext("2d").drawImage(im, sx, sy, ss, ss, 0, 0, 640, 640);
          const slug = p.name.toLowerCase().replace(/[^a-z0-9äöü]+/g, "-");
          const cropId = await upload(await toBlob(cv), `${slug}.jpg`);
          let origId = info?.orig;
          if (file || !origId) {
            // Original verkleinert aufbewahren, damit der Ausschnitt später wieder geändert werden kann
            const m = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
            const ov = document.createElement("canvas"); ov.width = Math.round(im.naturalWidth * m); ov.height = Math.round(im.naturalHeight * m);
            ov.getContext("2d").drawImage(im, 0, 0, ov.width, ov.height);
            origId = await upload(await toBlob(ov), `${slug}-original.jpg`);
          }
          const cx = (S / 2 - ox) / (im.naturalWidth * k), cy = (S / 2 - oy) / (im.naturalHeight * k);
          await h.callService("input_text", "set_value", { entity_id: p.foto, value: `${cropId}|${origId}|${z.toFixed(2)}|${cx.toFixed(3)}|${cy.toFixed(3)}` });
          if (file) URL.revokeObjectURL(src);
          this._modal("");
        } catch (err) { this._flash(`Speichern fehlgeschlagen: ${err.message || err}`); }
      };
    }

    _squareJpeg(file, size) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const im = new Image();
        im.onload = () => {
          const s = Math.min(im.naturalWidth, im.naturalHeight);
          const cv = document.createElement("canvas");
          cv.width = cv.height = size;
          cv.getContext("2d").drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) / 2, s, s, 0, 0, size, size);
          URL.revokeObjectURL(url);
          cv.toBlob((b) => (b ? resolve(b) : reject(new Error("Bild konnte nicht gelesen werden"))), "image/jpeg", 0.88);
        };
        im.onerror = () => reject(new Error("Bild konnte nicht gelesen werden"));
        im.src = url;
      });
    }
  }

  // ---------- Gestaltung ----------
  const STYLE = `
  :host { display:block; }
  .fp, .fp-modal {
    --bg:#f3f5f8; --paper:#ffffff; --ink:#18212d; --ink2:#5b6676; --ink3:#97a1ae; --line:#e3e7ed; --soft:#eef1f5;
    --today:#fff6cc; --todayline:#f2c200; --ferien:#e9f6ef; --accent:#18212d;
    --f-ui:'Figtree', system-ui, -apple-system, sans-serif; --f-disp:'Bricolage Grotesque', 'Figtree', system-ui, sans-serif;
    font-family:var(--f-ui); color:var(--ink);
  }
  .fp.dark, .fp-modal.dark {
    --bg:#10151c; --paper:#18202a; --ink:#e9eef4; --ink2:#a6b1bf; --ink3:#6b7686; --line:#273140; --soft:#1f2834;
    --today:#2e2a14; --todayline:#e0b400; --ferien:#16291f; --accent:#e9eef4;
  }
  * { box-sizing:border-box; }
  button { font:inherit; color:inherit; background:none; border:0; padding:0; cursor:pointer; text-align:left; -webkit-tap-highlight-color:transparent; }
  button:focus-visible { outline:2px solid var(--todayline); outline-offset:2px; border-radius:8px; }
  ha-icon { --mdc-icon-size:18px; display:inline-flex; }
  .fp { position:relative; background:var(--bg); height:calc(100vh - var(--header-height, 56px)); height:calc(100dvh - var(--header-height, 56px)); display:flex; flex-direction:column; overflow:hidden; --daycol:124px; --hidcol:44px; }

  /* Kopf */
  .hd { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:16px; padding:14px 20px 10px; }
  .clock { font-family:var(--f-disp); font-weight:700; font-size:44px; line-height:1; letter-spacing:-0.02em; font-variant-numeric:tabular-nums; }
  .date { color:var(--ink2); font-size:15px; margin-top:4px; }
  .nav { display:flex; align-items:center; justify-content:center; gap:12px; flex-wrap:wrap; }
  .seg { display:inline-flex; background:var(--soft); border-radius:12px; padding:3px; }
  .seg button { padding:8px 14px; border-radius:9px; font-weight:600; font-size:14px; color:var(--ink2); }
  .seg button.on { background:var(--paper); color:var(--ink); box-shadow:0 1px 2px rgba(20,30,45,.12); }
  .pager { display:inline-flex; align-items:center; gap:2px; }
  .ib { width:38px; height:38px; display:inline-grid; place-items:center; border-radius:10px; }
  .ib:active, .today:active { background:var(--soft); }
  .ib ha-icon { --mdc-icon-size:24px; }
  .today { padding:8px 12px; border-radius:10px; font-weight:600; font-size:14px; border:1px solid var(--line); }
  .range { font-family:var(--f-disp); font-weight:600; font-size:19px; min-width:180px; text-align:center; }
  .range .kw { color:var(--ink3); font-family:var(--f-ui); font-size:13px; font-weight:500; margin-left:6px; }
  .wx { display:flex; align-items:center; gap:10px; }
  .wxbox { display:flex; align-items:center; gap:14px; margin-right:6px; }
  .wxi { --mdc-icon-size:64px; color:#f2a900; }
  .wxt .t { font-family:var(--f-disp); font-size:50px; font-weight:700; line-height:.95; letter-spacing:-0.02em; }
  .wxt .cond { font-size:14px; color:var(--ink2); margin-top:3px; white-space:nowrap; }
  .wxd { display:flex; flex-direction:column; gap:5px; font-size:15px; color:var(--ink2); padding-left:14px; border-left:1px solid var(--line); }
  .wxd > div { display:flex; align-items:center; gap:5px; white-space:nowrap; }
  .wxd b { color:var(--ink); font-weight:700; }
  .wxd .lbl { width:54px; font-size:13px; }
  .wxd ha-icon { --mdc-icon-size:20px; }
  .wxd .rain { display:inline-flex; align-items:center; gap:2px; color:#1c7ed6; font-size:13px; }
  .wxd .rain ha-icon { --mdc-icon-size:15px; }
  .wx .homebtn + .homebtn { margin-left:2px; }
  .orient .rot { transform:rotate(90deg); }
  .homebtn { display:inline-flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; width:76px; height:72px; border-radius:20px; background:var(--accent); color:var(--bg); box-shadow:0 2px 6px rgba(20,30,45,.18); flex:none; text-align:center; }
  .homebtn ha-icon { --mdc-icon-size:40px; }
  .homebtn span { font-size:12px; font-weight:700; line-height:1; }
  .homebtn:active { transform:scale(.95); }
  .alerts { display:flex; gap:8px; padding:0 20px 8px; flex-wrap:wrap; }
  .al { display:inline-flex; align-items:center; gap:10px; background:var(--today); border-radius:14px; padding:10px 18px 10px 14px; font-size:19px; box-shadow:inset 0 0 0 2px color-mix(in srgb, var(--todayline) 55%, transparent); }
  .al > ha-icon { --mdc-icon-size:26px; }
  .al b { font-weight:800; }
  .al .abt { display:inline-flex; align-items:center; gap:5px; margin-left:4px; font-weight:800; }
  .al .abt ha-icon { --mdc-icon-size:24px; color:var(--c); }
  .setup { display:flex; align-items:center; gap:12px; margin:0 20px 10px; padding:10px 14px; background:var(--paper); border:1px dashed var(--ink3); border-radius:12px; font-size:14px; }
  .setup.soft { border-style:solid; border-color:var(--line); color:var(--ink2); }
  .setup > div { flex:1; }
  .btn { background:var(--accent); color:var(--bg); padding:9px 16px; border-radius:10px; font-weight:600; font-size:14px; white-space:nowrap; }
  .btn.ghost { background:transparent; color:var(--ink); border:1px solid var(--line); }
  .btn[disabled] { opacity:.6; }

  /* Gerüst */
  .body { flex:1; min-height:0; display:flex; gap:14px; padding:0 14px 14px; }
  .hoch .body { flex-direction:column; }
  .main { flex:1; min-height:0; min-width:0; background:var(--paper); border-radius:18px; overflow:hidden; display:flex; flex-direction:column; border:1px solid var(--line); }
  .side { display:grid; gap:12px; align-content:start; overflow:auto; }
  .quer .side { width:340px; flex:none; grid-auto-rows:max-content; }
  .quer .side .items { max-height:300px; }
  .quer .side .cd { max-height:220px; }
  .hoch .side { flex:none; height:clamp(280px, 36%, 440px); min-height:280px; grid-template-columns:1fr 1fr 1.25fr; grid-template-rows:auto 1fr; overflow:hidden; }
  .hoch .side .notewrap { grid-column:1; grid-row:1; }
  .hoch .side .note { min-height:0; padding:18px 16px 14px; }
  .hoch .side .note p { -webkit-line-clamp:3; font-size:22px; }
  .hoch .side .notewrap { padding:6px 8px 2px; }
  .hoch .abx:nth-child(n+4) { display:none; }
  .hoch .side .soon { grid-column:1; grid-row:2; }
  .hoch .side .shop { grid-column:2; grid-row:1 / span 2; }
  .hoch .side .chores { grid-column:3; grid-row:1 / span 2; }
  .hoch .side.nochores { grid-template-columns:1fr 1.3fr; }
  .hoch .side .starsp { grid-column:3; grid-row:1 / span 2; }
  .hoch .side.both .chores { grid-row:1; } .hoch .side.both .starsp { grid-row:2; }
  /* Sterne */
  .starsp { overflow:hidden; }
  .stlist { display:flex; flex-direction:column; gap:10px; overflow:auto; min-height:0; }
  .strow { display:grid; grid-template-columns:1fr; gap:4px; padding:8px; border-radius:12px; background:color-mix(in srgb, var(--c) 8%, var(--paper)); }
  .strow.done { background:color-mix(in srgb, #f2b400 22%, var(--paper)); box-shadow:inset 0 0 0 2px #f2b400; }
  .sthead { display:flex; align-items:center; gap:8px; }
  .sthead .av { margin-right:auto; }
  .stgive { width:40px; height:40px; border-radius:12px; display:grid; place-items:center; background:#fff1bf; color:#c48a00; }
  .dark .stgive { background:#3d3311; color:#ffd866; }
  .stgive ha-icon { --mdc-icon-size:24px; }
  .stgive:active { transform:scale(.92); }
  .sttrack { display:flex; flex-wrap:wrap; gap:1px; align-items:center; color:var(--ink3); }
  .sttrack ha-icon { --mdc-icon-size:20px; }
  .sttrack ha-icon.on { color:#f2b400; }
  .stbar { flex:1; height:12px; border-radius:6px; background:var(--soft); overflow:hidden; min-width:80px; }
  .stbar span { display:block; height:100%; background:#f2b400; border-radius:6px; }
  .stnum { font-weight:700; font-size:13px; margin-left:8px; color:var(--ink2); }
  .streward { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; }
  .rwpic { width:44px; height:30px; border-radius:7px; overflow:hidden; flex:none; display:grid; place-items:center; font-size:22px; background:var(--paper); }
  .rwpic img { width:100%; height:100%; object-fit:cover; display:block; }
  .rwpic.empty { color:var(--ink3); } .rwpic ha-icon { --mdc-icon-size:20px; }
  .rwtxt { display:flex; flex-direction:column; min-width:0; line-height:1.2; }
  .rwtxt small { color:var(--ink2); font-weight:500; }
  .zielrow { display:flex; align-items:center; gap:10px; font-size:14px; color:var(--ink2); flex-wrap:wrap; }
  .rwquick { display:grid; grid-template-columns:repeat(auto-fill, minmax(136px, 1fr)); gap:6px; }
  .rwquick button { display:flex; align-items:center; gap:6px; padding:7px 9px; border-radius:12px; background:var(--soft); font-size:13.5px; font-weight:600; }
  .rwquick button.on { box-shadow:inset 0 0 0 3px var(--accent); background:var(--paper); }
  .rwquick .qe { font-size:22px; line-height:1; }
  .rwquick small { margin-left:auto; color:var(--ink3); font-weight:600; font-size:11.5px; white-space:nowrap; }
  .zielrow b { font-size:22px; color:var(--ink); min-width:28px; text-align:center; }
  .zielrow .have { margin-left:auto; }
  .bigpic ha-icon { --mdc-icon-size:40px; }
  /* Mond-Countdown */
  .moons { display:inline-flex; gap:0; color:#7a6cc9; flex:none; }
  .dark .moons { color:#b9b0ff; }
  .moons ha-icon { --mdc-icon-size:15px; }
  /* Wischen */
  .main { touch-action:pan-y; user-select:none; -webkit-user-select:none; }
  .main img { -webkit-user-drag:none; user-drag:none; }
  .main.slide-l > * { animation:slidel .22s ease-out; }
  .main.slide-r > * { animation:slider .22s ease-out; }
  .main.bump-l > * { animation:bumpl .25s ease-out; }
  .main.bump-r > * { animation:bumpr .25s ease-out; }
  @keyframes slidel { from { transform:translateX(40px); opacity:.3; } }
  @keyframes slider { from { transform:translateX(-40px); opacity:.3; } }
  @keyframes bumpl { 40% { transform:translateX(-12px); } }
  @keyframes bumpr { 40% { transform:translateX(12px); } }
  /* Essen */
  .mealin { display:flex; gap:8px; align-items:stretch; }
  .mealin input { flex:1; }
  .favbtn { display:inline-flex; align-items:center; gap:6px; white-space:nowrap; }
  .favbtn.on { color:#d6336c; border-color:#d6336c; }
  .favbtn ha-icon { --mdc-icon-size:18px; }
  .mchip { display:inline-flex; align-items:stretch; border-radius:20px; background:var(--soft); overflow:hidden; }
  .mchip > button:first-child { padding:6px 4px 6px 12px; font-size:14px; font-weight:600; display:inline-flex; align-items:center; gap:5px; }
  .mchip small { font-weight:500; color:var(--ink2); font-size:11.5px; margin-left:4px; }
  .mchip.fav ha-icon { --mdc-icon-size:14px; color:#d6336c; }
  .mchip .nope { padding:0 9px 0 4px; color:var(--ink3); display:grid; place-items:center; }
  .mchip .nope ha-icon { --mdc-icon-size:14px; }
  .dlg-f .btn ha-icon { --mdc-icon-size:18px; margin-right:4px; vertical-align:-3px; }
  .fillist { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
  .fillist li { display:flex; gap:12px; padding:8px 10px; border-radius:10px; background:var(--soft); font-size:15px; }
  .fillist li span { width:70px; color:var(--ink2); font-weight:600; }

  /* Avatare */
  .av { display:flex; flex-direction:column; align-items:center; gap:6px; }
  .av .ring { width:64px; height:64px; border-radius:50%; padding:3px; background:var(--c); display:grid; place-items:center; transition:transform .15s; }
  .av .ring img, .av .ring .ini { width:100%; height:100%; border-radius:50%; border:3px solid var(--paper); object-fit:cover; }
  .av .ini { display:grid; place-items:center; background:color-mix(in srgb, var(--c) 18%, var(--paper)); color:var(--c); font-family:var(--f-disp); font-weight:700; font-size:26px; }
  .av .nm { font-weight:700; font-size:15px; }
  .av:active .ring { transform:scale(.94); }
  .av.off .ring { background:var(--line); filter:grayscale(1); opacity:.55; }
  .av.off .nm { color:var(--ink3); }
  .av.sm .ring { width:48px; height:48px; } .av.sm .nm { font-size:13px; }
  .av.mini { flex-direction:row; gap:6px; } .av.mini .ring { width:30px; height:30px; padding:2px; } .av.mini .ring img, .av.mini .ring .ini { border-width:2px; font-size:13px; } .av.mini .nm { font-size:13px; }
  .whead .av.mini { flex-direction:column; } .whead .av.mini .nm { writing-mode:vertical-rl; transform:rotate(180deg); }
  .av.xs { flex-direction:row; gap:6px; } .av.xs .ring { width:28px; height:28px; padding:2px; } .av.xs .ring img, .av.xs .ring .ini { border-width:2px; font-size:12px; } .av.xs .nm { font-size:14px; }
  .famav { display:flex; flex-direction:column; align-items:center; gap:6px; }
  .famav ha-icon { width:48px; height:48px; border-radius:50%; display:grid; place-items:center; background:color-mix(in srgb, var(--c) 14%, var(--paper)); color:var(--c); --mdc-icon-size:24px; }
  .famav .nm { font-weight:700; font-size:13px; }
  .famlegend { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:var(--ink2); }
  .famlegend .dot { width:12px; height:12px; border-radius:4px; background:var(--c); }

  /* Woche */
  .week { display:flex; flex-direction:column; min-height:0; flex:1; }
  .whead, .wrow { display:grid; }
  .whead { padding:14px 12px 10px 6px; border-bottom:1px solid var(--line); align-items:end; }
  .whead .famlegend { padding-left:10px; padding-bottom:4px; align-self:end; }
  .hcell { display:flex; justify-content:center; }
  /* Jeder Tag als eigener Block mit Abstand */
  .wbody { overflow:auto; flex:1; min-height:0; overscroll-behavior:contain; background:color-mix(in srgb, var(--ink) 10%, var(--paper)); padding:8px; display:flex; flex-direction:column; gap:8px; }
  .wrow { background:var(--paper); border-radius:12px; padding:0 6px 0 0; grid-auto-rows:auto; min-height:76px; overflow:hidden; box-shadow:0 1px 0 var(--line); flex:none; }
  .wrow.we { background:color-mix(in srgb, var(--soft) 35%, var(--paper)); }
  .wrow.past { opacity:.55; }
  .wrow.now { background:var(--today); box-shadow:0 0 0 2px var(--todayline); }
  .wrow.now .dcell { background:color-mix(in srgb, var(--todayline) 18%, transparent); }
  .dcell { padding:10px 8px 10px 12px; display:flex; flex-direction:column; gap:4px; border-right:1px solid var(--line); background:color-mix(in srgb, var(--soft) 60%, transparent); }
  .kwsep { display:flex; align-items:center; gap:10px; flex:none; padding:4px 6px 0; color:var(--ink3); font-size:12px; font-weight:700; letter-spacing:.04em; }
  .kwsep::after { content:""; flex:1; height:1px; background:color-mix(in srgb, var(--ink) 18%, transparent); }
  .dnum { display:flex; align-items:baseline; gap:6px; flex-wrap:wrap; }
  .dnum .wd { font-weight:700; color:var(--ink2); font-size:14px; }
  .dnum .n { font-family:var(--f-disp); font-weight:700; font-size:28px; line-height:1; letter-spacing:-0.02em; }
  .hd-today { font-size:11px; font-weight:700; background:var(--todayline); color:#2a2100; padding:2px 6px; border-radius:6px; }
  .dmeta { display:flex; align-items:center; gap:6px; color:var(--ink2); font-size:13px; flex-wrap:wrap; }
  .dwx { display:inline-flex; align-items:center; gap:2px; } .dwx ha-icon { --mdc-icon-size:18px; }
  .trash { color:var(--c); --mdc-icon-size:18px; }
  .fer { font-size:12px; font-weight:600; color:#2b8a3e; }
  .meal { display:flex; align-items:flex-start; gap:5px; font-size:13px; line-height:1.25; font-weight:600; margin-top:2px; padding:4px 6px; margin-left:-6px; border-radius:8px; }
  .meal ha-icon { --mdc-icon-size:15px; color:var(--ink3); margin-top:1px; flex:none; }
  .meal span { hyphens:auto; -webkit-hyphens:auto; overflow-wrap:anywhere; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .meal.empty { color:var(--ink3); font-weight:500; }
  .meal:active { background:var(--soft); }
  .band { display:flex; flex-wrap:wrap; gap:4px; padding:8px 6px 0; }
  .band .ev { flex:0 1 auto; width:auto; max-width:100%; }
  .hol { display:inline-flex; align-items:center; gap:4px; font-size:13px; font-weight:600; padding:4px 8px; border:1.5px dashed var(--ink3); border-radius:8px; color:var(--ink2); }
  .hol ha-icon { --mdc-icon-size:15px; }
  .pcell { padding:8px 4px; display:flex; flex-direction:column; gap:4px; min-width:0; }
  .pcell + .pcell { border-left:1px dashed var(--line); }
  .pcell.hid { background:repeating-linear-gradient(135deg, transparent 0 6px, var(--soft) 6px 8px); }

  .ev { display:flex; align-items:baseline; gap:6px; width:100%; padding:5px 8px; border-radius:8px; font-size:13.5px; line-height:1.25; background:color-mix(in srgb, var(--c) 13%, var(--paper)); box-shadow:inset 3px 0 0 var(--c); min-width:0; }
  .ev .tm { font-weight:700; font-variant-numeric:tabular-nums; color:color-mix(in srgb, var(--c) 75%, var(--ink)); flex:none; font-size:12.5px; }
  .ev .tt { overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; font-weight:600; }
  .ev.ad { background:var(--c); color:#fff; box-shadow:none; }
  .ev .mi { --mdc-icon-size:14px; opacity:.8; margin-left:auto; }
  .ev:active { filter:brightness(.95); }
  .ev.bg, .tev.bg { position:relative; overflow:hidden; isolation:isolate; }
  .ev.bg { min-height:62px; align-items:flex-start; padding:7px 9px; }
  .ev.bg .txt, .tev.bg .tt, .tev.bg .tm { position:relative; z-index:2; }
  .ev.bg:not(.ad)::before, .tev.bg::before { content:""; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--c); z-index:3; }
  .bgemo { position:absolute; right:-8%; top:50%; transform:translateY(-50%) rotate(-10deg); font-size:96px; line-height:1; opacity:.42; z-index:1; pointer-events:none; filter:blur(.6px) saturate(1.15); }
  .ev.ad .bgemo { opacity:.5; }
  /* Bild: rechts scharf, nach links unscharf und in die Personenfarbe übergehend */
  .bgimg, .bgblur { position:absolute; background-size:cover; background-position:center right; pointer-events:none; }
  .bgimg { inset:0; z-index:0; }
  .bgblur { inset:-10px; z-index:0; filter:blur(5px) saturate(1.05);
    -webkit-mask-image:linear-gradient(90deg, #000 0%, #000 calc(10px + 30%), transparent calc(10px + 75%)); mask-image:linear-gradient(90deg, #000 0%, #000 calc(10px + 30%), transparent calc(10px + 75%)); }
  .bgtint { position:absolute; inset:0; z-index:1; pointer-events:none;
    background:linear-gradient(90deg, color-mix(in srgb, var(--c) 22%, var(--paper)) 0%, color-mix(in srgb, var(--c) 22%, var(--paper) 88%) 30%, color-mix(in srgb, var(--c) 18%, transparent 75%) 62%, transparent 92%); }
  .ev.ad .bgtint { background:linear-gradient(90deg, var(--c) 0%, color-mix(in srgb, var(--c) 90%, transparent) 30%, color-mix(in srgb, var(--c) 35%, transparent) 65%, transparent 92%); }
  .ev.bgphoto .tt, .tev.bgphoto .tt { text-shadow:0 0 6px color-mix(in srgb, var(--paper) 80%, transparent); }
  .ev.ad.bgphoto .tt { text-shadow:0 1px 4px rgba(0,0,0,.35); }
  .tev.bg .bgemo { font-size:110px; }
  .ev .pic { flex:none; width:40px; height:40px; border-radius:10px; background:var(--paper); display:grid; place-items:center; font-size:28px; line-height:1; overflow:hidden; }
  .ev.ad .pic { background:rgba(255,255,255,.9); }
  .ev .pic img, .tpic img, .mpic img, .bigpic img { width:100%; height:100%; object-fit:cover; display:block; }
  .ev .txt { display:flex; flex-direction:column; min-width:0; flex:1 1 auto; width:100%; }
  .ev.bg .tt { padding-right:18px; }
  .tpic { width:30px; height:30px; border-radius:8px; background:var(--paper); display:grid; place-items:center; font-size:22px; overflow:hidden; margin-bottom:2px; flex:none; }
  .mpic { display:inline-grid; place-items:center; width:15px; height:15px; margin-right:3px; vertical-align:-2px; font-size:12px; overflow:hidden; border-radius:3px; }
  .dlg.wide { width:min(760px, calc(100vw - 32px)); }
  .hint2 { margin:0; color:var(--ink2); font-size:14px; }
  .blist { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:8px; }
  .bitem { display:flex; align-items:center; gap:10px; padding:6px; border-radius:12px; background:var(--soft); position:relative; }
  .bthumb { width:72px; height:46px; border-radius:8px; overflow:hidden; flex:none; display:grid; place-items:center; font-size:30px; background:var(--paper); }
  .bthumb img { width:100%; height:100%; object-fit:cover; display:block; }
  .bt { display:flex; flex-direction:column; min-width:0; font-size:13px; }
  .bt b { font-size:14px; }
  .bt span { color:var(--ink2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .bchg { position:absolute; top:4px; right:6px; font-size:10px; font-weight:700; background:var(--todayline); color:#2a2100; padding:1px 5px; border-radius:5px; }
  .bildtop { display:flex; gap:14px; align-items:center; }
  .bigpic { width:84px; height:84px; border-radius:18px; background:var(--soft); display:grid; place-items:center; font-size:56px; overflow:hidden; flex:none; }
  .bigpic.empty { color:var(--ink3); font-size:36px; }
  .kw { flex:1; display:flex; flex-direction:column; gap:6px; font-size:13px; color:var(--ink2); }
  .sect { font-size:13px; color:var(--ink2); margin-top:4px; }
  .thm { display:grid; grid-template-columns:repeat(auto-fill, minmax(104px, 1fr)); gap:6px; max-height:236px; overflow:auto; padding:2px; grid-auto-rows:max-content; }
  .thm button { display:flex; flex-direction:column; border-radius:10px; overflow:hidden; background:var(--soft); text-align:left; }
  .thm button.on { box-shadow:0 0 0 3px var(--accent); }
  .thpic { flex:none; display:grid; place-items:center; height:58px; font-size:30px; background:var(--paper); overflow:hidden; }
  .thpic img { width:100%; height:100%; object-fit:cover; display:block; }
  .thm span:last-child { font-size:12px; font-weight:600; padding:4px 6px 5px; line-height:1.15; }
  .emo { display:grid; grid-template-columns:repeat(8, 1fr); gap:6px; }
  .emo button { font-size:24px; aspect-ratio:1; display:grid; place-items:center; border-radius:12px; background:var(--soft); text-align:center; }
  .emo button.on { box-shadow:inset 0 0 0 3px var(--accent); background:var(--paper); }

  /* Tag */
  .day { display:flex; flex-direction:column; flex:1; min-height:0; }
  .dstrip { display:flex; flex-wrap:wrap; gap:8px; padding:12px 14px; border-bottom:1px solid var(--line); align-items:center; }
  .chipx { display:inline-flex; align-items:center; gap:5px; padding:6px 10px; border-radius:10px; background:var(--soft); font-size:14px; font-weight:600; }
  .chipx ha-icon { color:var(--c, var(--ink2)); }
  .meal.big { margin:0 0 0 auto; padding:6px 12px; font-size:15px; background:var(--soft); flex:0 1 auto; min-width:180px; max-width:60%; align-items:center; }
  .meal.big span { -webkit-line-clamp:1; overflow-wrap:normal; hyphens:none; -webkit-hyphens:none; }
  .dhead, .dall, .tgrid { display:grid; padding:0 10px; }
  .dhead { padding-top:12px; padding-bottom:8px; }
  .dall { border-bottom:1px solid var(--line); padding-bottom:8px; }
  .dall .lbl { font-size:11px; color:var(--ink3); align-self:center; }
  .adcell { display:flex; flex-direction:column; gap:3px; padding:0 3px; }
  .dbody { flex:1; overflow:auto; min-height:0; }
  .tgrid { position:relative; padding-top:8px; padding-bottom:16px; }
  .hours .hr { position:relative; border-top:1px solid var(--line); }
  .hours .hr span { position:absolute; top:-8px; left:0; font-size:11px; color:var(--ink3); background:var(--paper); padding-right:4px; font-variant-numeric:tabular-nums; }
  .tcol { position:relative; border-left:1px dashed var(--line); background:repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px 60px); }
  .tev { position:absolute; border-radius:8px; padding:4px 7px; background:color-mix(in srgb, var(--c) 16%, var(--paper)); box-shadow:inset 3px 0 0 var(--c); overflow:hidden; display:flex; flex-direction:column; font-size:13px; line-height:1.2; }
  .tev .tt { font-weight:700; }
  .tev .tm { font-size:11.5px; color:var(--ink2); font-variant-numeric:tabular-nums; }
  .nowline { position:absolute; left:58px; right:10px; height:2px; background:#e03131; pointer-events:none; }
  .nowline::before { content:""; position:absolute; left:-5px; top:-4px; width:10px; height:10px; border-radius:50%; background:#e03131; }

  /* Monat */
  .month { display:flex; flex-direction:column; flex:1; min-height:0; }
  .mlegend { display:flex; gap:14px; padding:12px 14px 8px; align-items:center; flex-wrap:wrap; }
  .mhead { display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); padding:0 8px; font-size:12px; font-weight:700; color:var(--ink3); }
  .mhead div { padding:4px 6px; }
  .mgrid { flex:1; display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); grid-auto-rows:minmax(92px, 1fr); gap:1px; background:var(--line); border-top:1px solid var(--line); overflow:auto; }
  .mcell { background:var(--paper); padding:6px; display:flex; flex-direction:column; gap:2px; min-width:0; overflow:hidden; }
  .mcell.we { background:color-mix(in srgb, var(--soft) 60%, var(--paper)); }
  .mcell.fer { background:var(--ferien); }
  .mcell.out { opacity:.4; }
  .mcell.now { box-shadow:inset 0 0 0 3px var(--todayline); }
  .mtop { display:flex; align-items:center; gap:3px; }
  .mn { font-family:var(--f-disp); font-weight:700; font-size:17px; margin-right:auto; }
  .mtop .trash { --mdc-icon-size:14px; }
  .mhol { font-size:11px; font-weight:700; color:var(--ink2); }
  .mev { font-size:12px; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:1px 5px; border-radius:5px; border-left:3px solid var(--c); background:color-mix(in srgb, var(--c) 10%, transparent); }
  .mev.ad { background:var(--c); color:#fff; border-left-color:var(--c); }
  .mev .tm { font-weight:700; margin-right:4px; font-variant-numeric:tabular-nums; }
  .more { font-size:11px; color:var(--ink3); padding-left:5px; }

  /* Panels */
  .panel { background:var(--paper); border:1px solid var(--line); border-radius:16px; padding:12px 14px; min-height:0; display:flex; flex-direction:column; }
  .ph { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
  .ph ha-icon { color:var(--ink2); }
  .ph h3 { margin:0; font-family:var(--f-disp); font-weight:700; font-size:17px; flex:1; }
  .ph .cnt { font-size:13px; color:var(--ink2); font-weight:600; }
  .add { width:32px; height:32px; display:grid; place-items:center; border-radius:9px; background:var(--soft); }
  .add ha-icon { --mdc-icon-size:20px; }
  .ph-empty { color:var(--ink3); font-size:14px; margin:0; }
  /* Pinnwand als Post-it */
  .notewrap { padding:8px 10px 6px; min-height:0; }
  .note { position:relative; cursor:pointer; color:#3b3000; padding:22px 18px 18px; min-height:118px;
    background:linear-gradient(170deg, #fff8a6 0%, #fff27a 55%, #f7e55c 100%);
    transform:rotate(-1.6deg); border-radius:2px 2px 18px 2px / 2px 2px 8px 2px;
    box-shadow:0 1px 1px rgba(0,0,0,.08), 0 10px 14px -8px rgba(60,45,0,.45), inset 0 -18px 22px -18px rgba(150,120,0,.35); }
  .note::after { content:""; position:absolute; right:0; bottom:0; width:26px; height:22px;
    background:linear-gradient(315deg, transparent 50%, rgba(0,0,0,.08) 51%, #f2df55 60%, #fbef8a 100%); border-radius:0 0 18px 0; }
  .note .tape { position:absolute; top:-9px; left:50%; width:84px; height:22px; transform:translateX(-50%) rotate(2deg);
    background:rgba(255,255,255,.55); box-shadow:0 1px 2px rgba(0,0,0,.12); backdrop-filter:blur(1px); }
  .note p { margin:0; font-family:'Caveat', 'Bradley Hand', 'Segoe Print', cursive; font-weight:600; font-size:25px; line-height:1.15;
    white-space:pre-wrap; overflow:hidden; display:-webkit-box; -webkit-line-clamp:5; -webkit-box-orient:vertical; }
  .note .ph-empty { opacity:.55; font-size:22px; }
  .note:active { transform:rotate(-1.6deg) scale(.98); }
  .dark .note { background:linear-gradient(170deg, #f3e27a 0%, #e9d65c 100%); color:#2e2500; }
  .cd { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; overflow:auto; flex:1 1 auto; min-height:48px; }
  .soon { overflow:hidden; }
  .cd li[data-act] { cursor:pointer; }
  .cd li { display:flex; align-items:center; gap:8px; font-size:14px; }
  .cd li ha-icon { color:var(--ink2); }
  .cd .tt { flex:1; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .cd .n { color:var(--ink2); font-size:13px; white-space:nowrap; }
  .abf { flex:none; display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; padding-top:10px; border-top:1px dashed var(--line); }
  .abx { display:inline-flex; align-items:center; gap:4px; font-size:12.5px; padding:4px 8px; border-radius:8px; background:color-mix(in srgb, var(--c) 12%, var(--paper)); }
  .abx ha-icon { color:var(--c); --mdc-icon-size:15px; }
  .tabs { display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap; }
  .tabs button { padding:5px 10px; border-radius:20px; font-size:13px; font-weight:600; background:var(--soft); color:var(--ink2); }
  .tabs button.on { background:var(--accent); color:var(--bg); }
  .items, .cper ul { list-style:none; margin:0; padding:0; overflow:auto; }
  .items { flex:1; min-height:0; }
  .items li button, .cper li button { display:flex; align-items:center; gap:10px; width:100%; padding:7px 2px; font-size:15px; border-bottom:1px solid var(--soft); }
  .items .sub { color:var(--ink3); font-size:13px; margin-left:auto; }
  .box { width:22px; height:22px; border-radius:7px; border:2px solid var(--ink3); flex:none; display:grid; place-items:center; }
  .items li.going { opacity:.3; text-decoration:line-through; transition:opacity .3s; }
  .cgrid { display:grid; grid-template-columns:1fr 1fr; gap:10px 14px; overflow:auto; min-height:0; }
  .quer .cgrid { grid-template-columns:1fr; }
  .cper .cph { display:flex; align-items:center; gap:8px; margin-bottom:2px; }
  .cper .cph .av { margin-right:auto; }
  .cper .add { width:28px; height:28px; }
  .stars { display:inline-flex; align-items:center; gap:3px; font-weight:700; font-size:14px; padding:3px 8px; border-radius:20px; background:#fff1bf; color:#7a5a00; }
  .dark .stars { background:#3d3311; color:#ffd866; }
  .stars ha-icon { --mdc-icon-size:16px; color:#f2b400; }
  .cper li button { font-size:14px; padding:6px 2px; }
  .cper li .box { border-color:var(--c); width:20px; height:20px; }
  .cper li.done .box { background:var(--c); color:#fff; } .cper li.done .box ha-icon { --mdc-icon-size:14px; }
  .cper li.done .tt { color:var(--ink3); text-decoration:line-through; }
  .burst { position:absolute; pointer-events:none; color:#f2b400; animation:burst .9s ease-out both; z-index:5; }
  .burst ha-icon { --mdc-icon-size:30px; }
  @keyframes burst { 0% { transform:translate(-50%,-50%) scale(.4); opacity:1; } 70% { opacity:1; } 100% { transform:translate(-50%,-160%) scale(1.5) rotate(40deg); opacity:0; } }

  /* Hochformat: kompakter */
  .hoch .hd { grid-template-columns:auto 1fr; grid-template-areas:"when wx" "nav nav"; row-gap:10px; }
  .hoch .when { grid-area:when; } .hoch .wx { grid-area:wx; justify-self:end; } .hoch .nav { grid-area:nav; justify-content:space-between; }
  .hoch .range { order:-1; text-align:left; min-width:0; }


  /* Höhere Terminblöcke */
  .ev { min-height:58px; padding:9px 10px; font-size:15px; flex-direction:column; align-items:flex-start; gap:2px; border-radius:10px; }
  .ev .tm { font-size:13.5px; }
  .ev.bg { min-height:78px; padding:10px 11px; }
  .pcell { gap:6px; padding:8px 5px; }
  .wrow { min-height:96px; }
  /* Schmal (Handy) */
  @media (max-width: 700px) {
    .fp { --daycol:78px; --hidcol:30px; height:auto; min-height:calc(100vh - 56px); overflow:visible; }
    .hd { padding:12px 14px 8px; }
    .clock { font-size:32px; }
    .wxi { --mdc-icon-size:40px; } .wxt .t { font-size:32px; } .wxd { display:none; }
    .body { padding:0 8px 10px; }
    .hoch .side, .quer .side { height:auto; width:auto; grid-template-columns:1fr; grid-template-rows:none; overflow:visible; }
    .hoch .side > .panel, .hoch .side > .notewrap { grid-column:auto !important; grid-row:auto !important; }
    .hoch .side.nochores { grid-template-columns:1fr; }
    .quer .body { flex-direction:column; }
    .main { min-height:70vh; }
    .av .ring { width:44px; height:44px; } .av .nm { font-size:12px; }
    .dnum .n { font-size:22px; }
    .ev { font-size:12px; padding:4px 6px; flex-direction:column; gap:0; }
    .ev .tm { font-size:11px; }
    .ev .pic { width:30px; height:30px; font-size:21px; }
    .ev.bg { min-height:52px; }
    .bgemo { font-size:64px; }
    .homebtn { width:56px; height:54px; border-radius:16px; } .homebtn ha-icon { --mdc-icon-size:30px; } .homebtn span { font-size:10px; }
  }
  @media (prefers-reduced-motion: reduce) { .burst { display:none; } .av .ring { transition:none; } }

  /* Dialog */
  .fp-modal:empty { display:none; }
  .fp-modal { position:fixed; inset:0; z-index:20; display:grid; place-items:center; }
  .scrim { position:absolute; inset:0; background:rgba(12,18,26,.45); }
  .dlg { position:relative; background:var(--paper); color:var(--ink); width:min(520px, calc(100vw - 32px)); max-height:calc(100vh - 64px); overflow:auto; border-radius:20px; box-shadow:0 20px 60px rgba(0,0,0,.25); animation:pop .16s ease-out; }
  @keyframes pop { from { transform:scale(.97); opacity:0; } }
  .dlg-h { display:flex; align-items:center; gap:10px; padding:18px 20px 8px; }
  .dlg-h .bar { width:6px; align-self:stretch; border-radius:3px; background:var(--c); }
  .dlg-h h2 { margin:0; font-family:var(--f-disp); font-size:22px; font-weight:700; }
  .dlg-b { padding:8px 20px 12px; display:flex; flex-direction:column; gap:10px; }
  .dlg-b.center { align-items:center; }
  .dlg-b .row { display:flex; gap:10px; align-items:center; margin:0; font-size:16px; }
  .dlg-b .row ha-icon { color:var(--ink2); }
  .dlg-b .desc { margin:4px 0 0; color:var(--ink2); font-size:15px; line-height:1.4; }
  .dlg-b .q { font-size:18px; margin:12px 0 4px; }
  .dlg-b input, .dlg-b textarea { width:100%; font:inherit; font-size:18px; padding:12px 14px; border-radius:12px; border:1.5px solid var(--line); background:var(--bg); color:var(--ink); resize:vertical; }
  .dlg-b input:focus, .dlg-b textarea:focus { outline:none; border-color:var(--ink2); }
  .sug { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
  .sug .lbl { width:100%; font-size:13px; color:var(--ink3); }
  .sug button { padding:6px 10px; border-radius:20px; background:var(--soft); font-size:14px; font-weight:600; }
  .flash { min-height:18px; font-size:14px; color:var(--ink2); }
  .dlg-f { display:flex; gap:8px; align-items:center; padding:10px 20px 18px; flex-wrap:wrap; }
  .dlg-f .sp { flex:1; }
  .dlg-f .hint { flex:1; font-size:13px; color:var(--ink3); }
  .farben { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; align-items:center; max-width:420px; margin-top:6px; }
  .farben .lbl { width:100%; text-align:center; font-size:13px; color:var(--ink2); }
  .sw { width:36px; height:36px; border-radius:50%; box-shadow:inset 0 0 0 2px rgba(0,0,0,.08); position:relative; }
  .sw.on { box-shadow:0 0 0 3px var(--paper), 0 0 0 5px var(--ink); }
  .sw.eigene { display:grid; place-items:center; background:conic-gradient(#e03131, #f08c00, #fab005, #2f9e44, #1971c2, #7048e8, #e03131); color:#fff; cursor:pointer; overflow:hidden; }
  .sw.eigene input { position:absolute; inset:0; opacity:0; cursor:pointer; }
  .lnk { font-size:13px; color:var(--ink2); text-decoration:underline; padding:4px 6px; }
  .cropstage { position:relative; overflow:hidden; border-radius:16px; background:var(--soft); touch-action:none; cursor:grab; user-select:none; -webkit-user-select:none; }
  .cropstage img { position:absolute; left:0; top:0; max-width:none; pointer-events:none; transform-origin:0 0; }
  .cropmask { position:absolute; inset:0; border-radius:50%; box-shadow:0 0 0 999px rgba(12,18,26,.55); border:2px solid #fff; pointer-events:none; }
  .cropzoom { display:flex; align-items:center; gap:10px; width:280px; }
  .zielrow .add, .cropzoom .add { flex:none; }
  .cropzoom input { flex:1; padding:0; border:0; background:none; accent-color:var(--accent); }
  .bigav { width:180px; height:180px; border-radius:50%; padding:5px; background:var(--c); }
  .bigav img, .bigav .ini { width:100%; height:100%; border-radius:50%; border:5px solid var(--paper); object-fit:cover; display:grid; place-items:center; font-family:var(--f-disp); font-size:72px; font-weight:700; color:var(--c); background:color-mix(in srgb, var(--c) 15%, var(--paper)); }
  `;

  customElements.define("familienplaner-card", FamilienplanerCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "familienplaner-card", name: "Familienplaner", description: "Wochenplan der Familie mit Essen, Einkauf und Ämtli" });
  console.info(`%c FAMILIENPLANER %c ${VERSION} `, "background:#18212d;color:#fff;border-radius:4px 0 0 4px;padding:2px 4px", "background:#f2c200;color:#18212d;border-radius:0 4px 4px 0;padding:2px 4px");
})();
