/*
 * Familienplaner – Lovelace-Karte für Home Assistant
 * Wochenplan nach Person (Kalender), Essensplan, Einkaufsliste (z. B. Bring!), Ämtli mit Sternen,
 * Abfall, Schulferien, Feiertage, Geburtstage/Countdowns, Wetter, Pinnwand, Bilder auf Terminen.
 * Hochformat zuerst, Querformat umschaltbar.
 * Lizenz: PolyForm Noncommercial 1.0.0 – nicht-kommerzielle Nutzung frei, Verkauf nicht erlaubt (siehe LICENSE).
 */
(() => {
  const VERSION = "1.16.0";
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
    ["Nachtschicht", "nachtdienst|nachtschicht|\\bnacht\\b|night shift|nightshift", "1506606401543-2e73709cebb4"],
    ["Laternenumzug", "laterne|räbeliechtli|räbe", "1628024564458-b3dfcceb3f34"],
    ["Weihnachten", "weihnacht|christkind|samichlaus|christmas|xmas", "1514377006585-6e7975371bd6"],
    ["1. August", "1\\.\\s?august|bundesfeier", "1549194400-06e6874c2fd1"],
    ["Ferien", "ferien|urlaub|hotel|vacation|holiday", "1531129630896-1744cab0cafd"],
    ["Elternabend / Schule", "eltern|besuchstag|schule|schulreise|parents|\\bschool", "1580582932707-520aed937b7b"],
    ["Kindergarten Wald", "wald", "1647627611823-d08fa901678e"],
    ["Turnen", "turnen|kinderturnen|muki|vaki|gymnastics", "1655842556539-db2d2099ded1"],
    ["Ballett / Tanz", "ballett|dance|tanz", "1555656220-46e30749d330"],
    ["Kindergarten", "kindergarten|kiga|chindsgi|preschool|nursery", "1588075592446-265fd1e6e76f"],
    ["Spielgruppe", "spielgruppe|playgroup|daycare", "1484820540004-14229fe36ca4"],
    ["Hüten / Grosseltern", "hüete|hueten|hüten|grosi|grossmami|grosspapi|\\boma\\b|\\bopa\\b|nonna|babysit|grandma|grandpa|granny", "1593100126453-19b562a800c1"],
    ["Haustiere füttern", "hase|kaninchen|katze|meerschwein|füttern|feed the|\\bpets?\\b", "1729172311760-f50e9ec48b35"],
    ["Physio / Therapie", "physio|osteo|therapie|massage", "1649751361457-01d3a696c7e6"],
    ["Zahnarzt", "zahnarzt|dentalhygiene|dentist|orthodont", "1598256989800-fe5f95da9787"],
    ["Augen", "auge|optician|\\beye", "1576210117723-cd06449a467d"],
    ["Arzt", "arzt|doktor|impf|spital|klinik|doctor|vaccin|hospital|clinic", "1632053002928-1919605ee6f7"],
    ["Coiffeur", "coiffeur|friseur|haare schneiden|hairdress|haircut|barber", "1704072650662-76df3af134a7"],
    ["Geburtstag", "geburi|geburtstag|🎂|🎁|birthday|bday", "1545696563-af8f6ec2295a"],
    ["Kürbis", "kürbis|pumpkin|halloween", "1570586437263-ab629fccc818"],
    ["Europa-Park", "europapark|europa-park|freizeitpark", "1628835788312-41d61f5ddce8"],
    ["Reisen / Flug", "reise|flug|flughafen|airport|abreise|travel|flight", "1436491865332-7a61a109cc05"],
    ["Zug / Bahn", "\\bzug\\b|zugfahrt|bahnhof|\\bsbb\\b|\\bbahn\\b|\\btrain\\b", "1593186344142-ef775a6e596f"],
    ["Umzug", "\\bumzug|zügeln|umziehen|moving house|\\bmove\\b", "1714647211902-bb711d643a17"],
    ["Zoo / Tierpark", "zoo|tierpark|affen|wildpark", "1535489158666-8d856534a6ef"],
    ["Kino", "kino|movie|film|cinema", "1578849278619-e73505e9610f"],
    ["Jahrestag / Date", "jahrestag|\\bdate\\b|dinner|❤️|valentin|anniversary", "1513279922550-250c2129b13a"],
    ["Konzert / Theater", "konzert|concert|musical|theater|\\boper\\b|theatre", "1470229722913-7c0e2dbbafd3"],
    ["Fest / Party", "fest|party|feier|apéro|apero", "1504196606672-aef5c9cefc92"],
    ["Essen", "zmittag|essen|brunch|restaurant|znacht|brötle|grill|picknick|lunch|restaurant", "1600891964599-f61ba0e24092"],
    ["Garage / Werkstatt", "garage|werkstatt|reifen|pneu|\\bmfk\\b|\\btüv\\b|auto\\s*service|mechanic|\\btyres?\\b|\\btires?\\b", "1727893119356-1702fe921cf9"],
    ["Handwerker / Service", "boiler|handwerker|reparatur|installat|elektriker|zähler|monteur|sanitär|heizung|maler\\b|schreiner|service|plumber|electrician|repair", "1426927308491-6380b6a9936f"],
    ["Auto laden", "\\bladen\\b|ladestation|wallbox|batterie|e-auto|charging|charge car", "1593941707874-ef25b8b4a92b"],
    ["Auto", "\\bauto\\b|autowasch|waschanlage|tanken|vignette|\\bcar\\b|car wash", "1683444126212-50c0aa2a421b"],
    ["Einkauf", "einkauf|ikea|migros|coop|denner|\\blidl\\b|\\baldi\\b|shopping|\\bdm\\b|baumarkt|jumbo|hornbach|grocer|supermarket", "1670684684445-a4504dca0bbc"],
    ["Meeting", "meeting|sitzung|besprechung|gespräch|\\bcall\\b|teams|zoom|termin mit", "1542744173-8e7e53415bb0"],
    ["Notar / Vertrag", "notar|vertrag|unterschrift|notary|contract", "1450101499163-c8848c66ca85"],
    ["Büro", "büro|buero|fokus|office", "1497215728101-856f4ea42174"],
    ["Kurs / Weiterbildung", "weiterbildung|kurs|schulung|seminar|workshop|vortrag|class\\b|lesson|training", "1524178232363-1fb2b075b655"],
    ["Schwimmen", "schwimm|badi|swim", "1592484806287-7bc9c8af5405"],
    ["Fussball", "fussball|fußball|tschutten|soccer|football", "1622659097972-68f1d8c1829f"],
    ["Reiten", "reiten|pony|pferd|riding|horse", "1718045330352-7b800f3bba80"],
    ["Musik", "musik|klavier|gitarre|flöte|singen|music|piano|guitar|violin|choir", "1577877777751-3f1ec20a0715"],
    ["Malen / Basteln", "\\bmalen|basteln|zeichnen|werken|painting|crafts|drawing", "1605627079912-97c3810a11a4"],
    ["Spielplatz", "spielplatz|playground", "1596997000103-e597b3ca50df"],
    ["Velo", "velo|fahrrad|\\bbike|cycling", "1629056007607-f3e5de821891"],
    ["Ski / Schnee", "\\bski|schlitteln|schnee|snow|sledg", "1631779202803-7f1415c87a9d"],
    ["Bibliothek", "bibliothek|ludothek|bücherei|library", "1767356326735-2da0a10cf1f0"],
    ["Garten", "garten|rasen|dünger|hecke|mähen|pflanzen|gärtner|garden|lawn", "1642541744624-7a2a89545a32"],
    ["Hund", "hund|gassi|tierarzt|hundeschule|\\bdog\\b|\\bvet\\b|puppy", "1517849845537-4d257902454a"],
    ["Wandern / Ausflug", "wander|ausflug|\\balp\\b|berg\\b|bergtour|hike|hiking|\\btrip\\b|outing", "1527095655060-4026c4af2b25"],
    ["Fitness / Sport", "fitness|\\bgym\\b|training|joggen|\\blauf|lauf\\b|crossfit|sport|workout|running|yoga", "1534438327276-14e5300c3a48"],
    ["Familie", "familie|family", "1679274742187-1aa949703203"],
    ["Putzen", "putzen|reinigung|putzfrau|fensterputz|cleaning|cleaner", "1563453392212-326f5e854473"],
  ].map(([name, keys, id]) => ({ name, keys, re: new RegExp(keys, "i"), url: `https://images.unsplash.com/photo-${id}?w=640&h=320&fit=crop&q=70` }));
  // Belohnungen zum schnellen Wählen: [Text, Emoji, Sterne]
  const BELOHNUNGEN = [
    ["Lolli", "🍭", 3], ["Gummibärli", "🐻", 3], ["Sticker", "⭐", 3], ["Seifenblasen", "🫧", 4], ["Ballon", "🎈", 4],
    ["Schoggi", "🍫", 4], ["Glace", "🍦", 5], ["Pommes", "🍟", 5], ["Heftli", "📖", 6], ["Malbuch", "🖍️", 6],
    ["Spielzeugauto", "🚗", 8], ["Spielfigur", "🦖", 8], ["Hörspiel", "🎧", 8], ["Puzzle", "🧩", 8], ["Buch", "📚", 10],
    ["Länger aufbleiben", "🌙", 6], ["Kuchen backen", "🧁", 8], ["Pizza essen", "🍕", 10], ["Freund einladen", "👫", 10],
    ["Spielplatz", "🛝", 6], ["Badi", "🏊", 10], ["Velotour", "🚲", 10], ["Kino", "🎬", 15], ["Zoo", "🦁", 20], ["Ausflug", "🚂", 20],
  ];
  // Essen: Standard-Mahlzeiten, Arten (für Abwechslung), verderbliche Zutaten (Reste), Grundvorrat (nicht einkaufen)
  const MAHLZEITEN_STD = "abend";
  const ESSEN_ARTEN = [
    ["pasta", "🍝 Pasta", /pasta|spaghetti|penne|lasagne|makkaroni|magronen|nudel|hörnli|tortellini|ravioli|gnocchi|tagliatelle|fusilli|spätzli/],
    ["pizza", "🍕 Pizza & Wähe", /pizza|flammkuchen|wähe|quiche|focaccia/],
    ["fisch", "🐟 Fisch", /fisch|lachs|forelle|thon|thunfisch|crevette|shrimp|egli|dorsch|kabeljau|zander|scampi/],
    ["fleisch", "🥩 Fleisch", /steak|schnitzel|braten|geschnetzelt|hackfleisch|ghackets|burger|wurst|cervelat|bratwurst|poulet|huhn|chicken|fleisch|cordon|kotelett|speck|rind|schwein|lamm|chili con carne|hackbraten|fleischkäse|nuggets|wienerli|gulasch/],
    ["suppe", "🍲 Suppe & Eintopf", /suppe|eintopf|bouillon|minestrone|gulasch|chili|ramen/],
    ["salat", "🥗 Salat", /salat|bowl/],
    ["ofen", "🧀 Ofen & Käse", /gratin|auflauf|lasagne|raclette|fondue|ofen|überbacken|käseschnitte|moussaka/],
    ["reis", "🍛 Reis & Asiatisch", /reis|risotto|curry|asia|wok|sushi|nasi|thai|ramen|paella/],
    ["mex", "🌮 Mexikanisch", /taco|tortilla|burrito|fajita|quesadilla|nacho|enchilada/],
    ["kartoffel", "🥔 Kartoffeln", /kartoffel|rösti|gschwellti|pommes|härdöpfel|kroketten|wedges/],
    ["grill", "🔥 Grill", /grill|grilliert|bbq|barbecue|cervelat/],
    ["leicht", "🥪 Brot & Eier", /sandwich|toast|brot|zmorge|birchermüesli|pfannkuchen|omelett|crêpe|rührei|spiegelei|älplermagronen/],
  ];
  const PERISH = /rahm|sahne|crème fraîche|creme fraiche|quark|mascarpone|ricotta|mozzarella|lauch|spinat|zucchet|zucchini|peperoni|paprika|champignon|pilz|broccoli|brokkoli|blumenkohl|hackfleisch|poulet|lachs|koriander|petersilie|basilikum|sellerie|kohl|joghurt|feta|buttermilch|schnittlauch|rucola|salat|tomaten|gurke|aubergine/;
  const BASICS = /^(salz|pfeffer|zucker|öl|olivenöl|rapsöl|wasser|mehl|essig|bouillon|gemüsebouillon|butter)$/i;
  // Kinder: Vorlagen für Tagesaufgaben [Text, Bild, Zeit] und grosse Ziele [Text, Bild, Anzahl Tage]
  const TAGES_VORLAGEN = [
    ["Zähne putzen", "🪥", "morgen"], ["Anziehen", "👕", "morgen"], ["Bett machen", "🛏️", "morgen"], ["Frühstück essen", "🥣", "morgen"],
    ["Znüni einpacken", "🍎", "morgen"], ["Schuhe anziehen", "👟", "morgen"], ["Hände waschen", "🧼", "tag"], ["Haustiere füttern", "🐰", "tag"],
    ["Pflanzen giessen", "🪴", "tag"], ["Tisch decken", "🍽️", "abend"], ["Aufräumen", "🧸", "abend"], ["Zähne putzen", "🪥", "abend"],
    ["Pyjama anziehen", "🌙", "abend"], ["Buch anschauen", "📚", "abend"], ["Baden / Duschen", "🛁", "abend"],
  ];
  const LANG_VORLAGEN = [
    ["Töpfchen", "🚽", 4, "frei", "Monstertruck", "🛻"], ["Schläft im eigenen Bett", "🛏️", 7, "tag", "Kuscheltier", "🧸"],
    ["Trocken in der Nacht", "🌙", 7, "tag", "Glace", "🍦"], ["Ohne Nuggi", "🍼", 7, "tag", "Spielfigur", "🦖"],
    ["Selber anziehen", "👕", 5, "frei", "Sticker", "⭐"], ["Allein Zähne putzen", "🪥", 10, "frei", "Heftli", "📖"],
    ["Schuhe selber binden", "👟", 5, "frei", "Ballon", "🎈"], ["Velo ohne Stützräder", "🚲", 5, "tag", "Glace", "🍦"],
    ["Schwimmen üben", "🏊", 5, "tag", "Pommes", "🍟"],
  ];
  const KIND_EMOJIS = ["🪥", "👕", "🛏️", "🥣", "🍎", "👟", "🧼", "🐰", "🪴", "🍽️", "🧸", "🌙", "📚", "🛁", "🚽", "🍼", "🚲", "🏊", "🎒", "🧹", "🧺", "🗑️", "🎹", "⚽", "🖍️", "🙏", "😴", "🥦", "💧", "⭐"];
  const EMOJI_WAHL = ["🧸", "🏫", "🧩", "🌲", "🤸", "🏊", "⚽", "🩰", "🐴", "🎵", "🎨", "🦷", "🩺", "✂️", "🎂", "🎉", "👵", "👴", "🦁", "🎬", "📚", "🚲", "⛷️", "🏖️", "🚗", "🚆", "🛝", "🌙", "🍎", "🛒", "🐶", "⭐", "🍭", "🍫", "🍦", "🍟", "🍕", "🧁", "🎈", "🫧", "📖", "🖍️", "🧩", "🦖", "🎧", "👫", "🏊", "🎁"];

  const WXDE = {
    "clear-night": "Klar", cloudy: "Bewölkt", exceptional: "Unwetter", fog: "Nebel", hail: "Hagel", lightning: "Gewitter",
    "lightning-rainy": "Gewitter mit Regen", partlycloudy: "Teilweise bewölkt", pouring: "Starkregen", rainy: "Regen",
    snowy: "Schnee", "snowy-rainy": "Schneeregen", sunny: "Sonnig", windy: "Windig", "windy-variant": "Windig, bewölkt",
  };
  const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* egal */ } };

  // ---------- Sprache ----------
  // Die Karte ist auf Deutsch geschrieben. Für «sprache: en» übersetzt ein Beobachter die angezeigten Texte
  // (Textknoten, aria-label, title, placeholder). Gespeicherte Daten bleiben unverändert.
  const EN = {
    // Allgemein
    "Abbrechen": "Cancel", "Speichern": "Save", "Schliessen": "Close", "Entfernen": "Remove", "Löschen": "Delete", "Hinzufügen": "Add",
    "Fertig": "Done", "Zurück": "Back", "← Zurück": "← Back", "Bestätigen": "Confirm", "Übernehmen": "Apply", "Mehr": "More", "Weniger": "Less",
    "Nochmals": "Again", "Name": "Name", "Farbe": "Colour", "Eigene Farbe": "Custom colour", "Standard": "Default", "Person": "Person",
    "Heute": "Today", "Morgen": "Tomorrow", "heute": "today", "morgen": "tomorrow", "ganztags": "all day", "Tage": "days", "Tag": "Day",
    "Woche": "Week", "Monat": "Month", "Familie": "Family", "Bilder": "Pictures", "Bald": "Coming up", "⏳ Bald": "⏳ Coming up",
    "Bald gross anzeigen": "Show coming up full screen", "Noch nichts geplant.": "Nothing planned yet.", "Die Liste ist leer.": "The list is empty.",
    "Antippen zum Schliessen": "Tap to close", "Jetzt anlegen": "Create now", "Lege an …": "Creating …", "Speichere …": "Saving …", "Lade hoch …": "Uploading …",
    "Vergrössern": "Zoom in", "Grösser": "Bigger", "Kleiner": "Smaller", "Ausschnitt": "Crop", "geändert": "changed", "Mär": "Mar", "März": "March",
    "OK": "OK", "Ja": "Yes", "Nein": "No", "Einstellungen": "Settings", "Querformat": "Landscape", "Hochformat": "Portrait", "Hoch": "Portrait", "Quer": "Landscape", "Automatisch": "Automatic",
    // Kopf und Ansichten
    "Zuhause": "Home", "Eigene Bilder": "Pictures", "Ausrichtung": "Orientation", "Zum Dashboard «Zuhause»": "Go to the Home dashboard",
    "Familienplaner: Kalender": "Family planner: calendar", "Familienplaner: Liste": "Family planner: list",
    "Wochenplan der Familie mit Essen, Einkauf und Ämtli": "Family week planner with meals, shopping and chores",
    "Vorherige": "Previous", "Nächste": "Next", "Vorherige Woche": "Previous week", "Nächste Woche": "Next week", "Zu heute": "Go to today",
    "Antippen und eine Nachricht für alle hinterlassen …": "Tap to leave a message for everyone …", "Pinnwand bearbeiten": "Edit message board", "Pinnwand": "Message board",
    "Antippen: ein/ausblenden · Lange drücken: Foto ändern": "Tap: show/hide · Long press: change photo",
    "Termine werden in Google Kalender bearbeitet.": "Events are edited in Google Calendar.", "Termin": "Event", "Termine": "Events",
    "Noch keine Kalender verbunden.": "No calendars connected yet.",
    "Noch keine Kalender in Home Assistant. Zuerst einen Kalender einbinden (z. B. «Remote Calendar»).": "No calendars in Home Assistant yet. Add a calendar first (e.g. “Remote Calendar”).",
    "Kalender in Home Assistant einbinden (z. B. «Remote Calendar») und unter «kalender» bei der Person eintragen.": "Add a calendar in Home Assistant (e.g. “Remote Calendar”) and list it under “kalender” for the person.",
    // Wetter
    "Klar": "Clear", "Bewölkt": "Cloudy", "Unwetter": "Severe weather", "Nebel": "Fog", "Hagel": "Hail", "Gewitter": "Thunderstorm",
    "Gewitter mit Regen": "Thunderstorm with rain", "Teilweise bewölkt": "Partly cloudy", "Starkregen": "Heavy rain", "Regen": "Rain",
    "Schnee": "Snow", "Schneeregen": "Sleet", "Sonnig": "Sunny", "Windig": "Windy", "Windig, bewölkt": "Windy, cloudy",
    // Abfall
    "Abfall": "Waste", "Kehricht": "Trash", "Grüngut": "Green waste", "Papier": "Paper", "Karton": "Cardboard", "Metall": "Metal", "Glas": "Glass",
    "Bioabfall": "Organic waste", "Gelber Sack": "Recycling bag", "Restmüll": "Residual waste", "Altpapier": "Waste paper", "Sonderabfall": "Hazardous waste",
    // Feiertage und Ferien
    "Neujahr": "New Year's Day", "Berchtoldstag": "Berchtold's Day", "Heilige Drei Könige": "Epiphany", "Josefstag": "St Joseph's Day",
    "Karfreitag": "Good Friday", "Ostermontag": "Easter Monday", "Tag der Arbeit": "Labour Day", "Auffahrt": "Ascension Day", "Pfingstmontag": "Whit Monday",
    "Fronleichnam": "Corpus Christi", "Bundesfeier": "Swiss National Day", "Tag der Deutschen Einheit": "German Unity Day", "Nationalfeiertag": "National Day",
    "Mariä Himmelfahrt": "Assumption Day", "Allerheiligen": "All Saints' Day", "Mariä Empfängnis": "Immaculate Conception", "Weihnachten": "Christmas",
    "Stephanstag": "St Stephen's Day", "Feiertag": "Holiday", "Ferien": "Holidays", "Schulferien": "School holidays",
    // Essen
    "Essen": "Meals", "Essensplan": "Meal plan", "Essen planen": "Plan a meal", "Was gibt es?": "What's for dinner?", "Woche füllen": "Fill the week",
    "Vorschlag für die Woche": "Suggestions for the week", "Schnell wählen": "Quick pick", "Als Lieblingsessen": "Mark as favourite", "Weitere Lieblingsessen": "More favourites",
    "Nicht mehr vorschlagen": "Don't suggest again", "Schon gekocht": "Already cooked", "oft gekocht": "cooked often", "lange nicht mehr": "not in a while",
    "Auf die Einkaufsliste": "Add to shopping list", "Die nächsten 7 Tage sind schon geplant.": "The next 7 days are already planned.",
    "Bereits geplante Tage bleiben, wie sie sind. Einzelne Essen kannst du danach wie gewohnt ändern.": "Days already planned stay as they are. You can change single meals afterwards as usual.",
    "Noch keine Vorschläge: Sobald ein paar Wochen geplant sind, lernt der Planer eure Gewohnheiten. Lieblingsessen mit dem Herz markieren.": "No suggestions yet: once a few weeks are planned, the planner learns your habits. Mark favourite meals with the heart.",
    // Einkauf
    "Einkauf": "Shopping", "Einkaufsliste": "Shopping list", "Artikel hinzufügen": "Add item", "Bring! ist nicht verbunden.": "Bring! is not connected.", "z. B. Milch": "e.g. milk",
    // Ämtli
    "Ämtli": "Chores", "Keine Ämtli": "No chores", "Neues Ämtli": "New chore", "Ämtli hinzufügen": "Add chore",
    "Die Ämtli-Listen werden mit «Jetzt anlegen» erstellt.": "The chore lists are created with “Create now”.", "z. B. Tisch decken": "e.g. set the table",
    "Stern abziehen": "Remove a star", "Auf 0": "Reset", "Auf 0 setzen": "Reset to 0",
    // Countdowns
    "Countdown hinzufügen": "Add countdown", "Neuer Countdown": "New countdown", "z. B. Ferien in Italien": "e.g. holiday in Italy", "Jetzt! 🎉": "Now! 🎉", "Heute! 🎉": "Today! 🎉",
    // Personen und Fotos
    "Familienmitglied hinzufügen": "Add family member", "Name & Kalender": "Name & calendar", "Kalender dieser Person": "This person's calendars",
    "Bitte einen Namen eingeben.": "Please enter a name.", "Der Name darf höchstens 30 Zeichen haben.": "The name can have at most 30 characters.",
    "Foto und Farbe lassen sich danach wie gewohnt ändern: lange auf das Foto drücken.": "Photo and colour can be changed later as usual: long press the photo.",
    "Foto wählen": "Choose photo", "Foto entfernen": "Remove photo", "Eigenes Foto …": "Own photo …", "Foto bereit, jetzt speichern.": "Photo ready, now save.",
    "Bild mit dem Finger verschieben, mit dem Regler oder zwei Fingern vergrössern.": "Move the picture with your finger, zoom with the slider or two fingers.",
    "Bild konnte nicht geladen werden.": "Could not load the picture.", "Bild konnte nicht gelesen werden": "Could not read the picture", "Bild konnte nicht erstellt werden": "Could not create the picture",
    "z. B. Grosi, Leo": "e.g. Grandma, Leo",
    // Bilder zu Terminen
    "Bilder zu Terminen": "Pictures for events", "Bild für Termine": "Picture for events", "Bilder auf den Terminen zeigen": "Show pictures on events",
    "Bild zuweisen": "Assign picture", "Bild ändern": "Change picture", "Neues Thema": "New topic", "+ Neues Thema": "+ New topic", "Bestehendes Thema wählen": "Choose an existing topic",
    "Gilt für alle Termine mit": "Applies to all events containing", "Oder eigenes Bild wählen": "Or choose your own picture", "Oder ein Emoji": "Or an emoji",
    "Oder Bild-Adresse aus dem Internet einfügen": "Or paste a picture address from the internet", "Planer Bilder": "Planner pictures",
    "Liste «Planer Bilder» fehlt": "List “Planer Bilder” is missing",
    "Dafür braucht es die Liste «Planer Bilder». Oben auf «Jetzt anlegen» tippen.": "This needs the list “Planer Bilder”. Tap “Create now” at the top.",
    "Zuerst oben «Jetzt anlegen» tippen (Liste «Planer Bilder»).": "First tap “Create now” at the top (list “Planer Bilder”).",
    "Ein Termin bekommt das Bild des ersten Themas, dessen Stichwort im Titel vorkommt. Antippen, um ein Bild zu ändern.": "An event gets the picture of the first topic whose keyword appears in its title. Tap to change a picture.",
    // Themen
    "Nachtschicht": "Night shift", "Laternenumzug": "Lantern parade", "1. August": "1 August", "Elternabend / Schule": "Parents' evening / school",
    "Kindergarten Wald": "Forest kindergarten", "Turnen": "Gymnastics", "Ballett / Tanz": "Ballet / dance", "Kindergarten": "Kindergarten", "Spielgruppe": "Playgroup",
    "Hüten / Grosseltern": "Babysitting / grandparents", "Haustiere füttern": "Feed the pets", "Physio / Therapie": "Physio / therapy", "Zahnarzt": "Dentist",
    "Augen": "Eyes", "Arzt": "Doctor", "Coiffeur": "Hairdresser", "Geburtstag": "Birthday", "Kürbis": "Pumpkin", "Reisen / Flug": "Travel / flight",
    "Zug / Bahn": "Train", "Umzug": "Moving house", "Zoo / Tierpark": "Zoo", "Kino": "Cinema", "Jahrestag / Date": "Anniversary / date",
    "Konzert / Theater": "Concert / theatre", "Fest / Party": "Party", "Garage / Werkstatt": "Garage", "Handwerker / Service": "Tradesman / service",
    "Auto laden": "Charge the car", "Meeting": "Meeting", "Notar / Vertrag": "Notary / contract", "Büro": "Office",
    "Kurs / Weiterbildung": "Course / training", "Schwimmen": "Swimming", "Fussball": "Football", "Reiten": "Horse riding", "Musik": "Music",
    "Malen / Basteln": "Painting / crafts", "Spielplatz": "Playground", "Velo": "Bike", "Ski / Schnee": "Ski / snow", "Bibliothek": "Library", "Garten": "Garden",
    "Hund": "Dog", "Wandern / Ausflug": "Hiking / trip", "Fitness / Sport": "Fitness / sport", "Putzen": "Cleaning",
    // Sterne und Kinder
    "Sterne": "Stars", "Sterne und Belohnungen öffnen": "Open stars and rewards", "Aufgaben & Belohnungen": "Tasks & rewards", "⭐ Sterne & Belohnungen": "⭐ Stars & rewards",
    "Belohnung": "Reward", "Belohnung wählen": "Choose a reward", "Belohnung festlegen": "Set a reward", "Sterne bis zur Belohnung": "Stars until the reward",
    "Geschafft!": "Done it!", "Geschafft! 🏆": "Done it! 🏆", "Alle Aufgaben erledigt ✓": "All tasks done ✓", "Heute wieder offen": "Open again today",
    "Noch keine Aufgaben. Eltern: ⚙️ antippen.": "No tasks yet. Parents: tap ⚙️.", "Einstellungen für Eltern": "Parent settings",
    "Eltern-Code": "Parent code", "Eltern-Code (4 Ziffern, leer = kein Code)": "Parent code (4 digits, empty = no code)", "Falscher Code": "Wrong code",
    "Der Code muss genau 4 Ziffern haben.": "The code must have exactly 4 digits.", "z. B. 2580": "e.g. 2580",
    "Gilt für alle Kinder. Der Code schützt Einstellungen, Bestätigen und Einlösen.": "Applies to all children. The code protects settings, confirming and redeeming.",
    "Sterne erst nach Bestätigung durch Eltern": "Stars only after a parent confirms", "Ton bei der Feier": "Sound at the celebration",
    "Erledigte Aufgaben bestätigen": "Confirm finished tasks", "Tagesaufgaben": "Daily tasks", "Grosse Ziele": "Big goals", "🏆 Grosse Ziele": "🏆 Big goals",
    "Optionen": "Options", "Eigene Tagesaufgabe": "Own daily task", "Eigenes grosses Ziel": "Own big goal", "+ Eigenes Ziel": "+ Own goal",
    "Neues grosses Ziel": "New big goal", "Ziel bearbeiten": "Edit goal", "Wie oft zählt es?": "How often does it count?", "Einmal pro Tag": "Once a day", "Jedes Mal": "Every time",
    "Bitte einen Namen für das Ziel eingeben.": "Please enter a name for the goal.", "Dieses Ziel nochmals von vorne beginnen?": "Start this goal again from the beginning?",
    "Noch keine Tagesaufgaben.": "No daily tasks yet.", "Noch keine grossen Ziele.": "No big goals yet.", "Fortschritt auf 0": "Reset progress",
    "↺ Alle Aufgaben von heute zurücksetzen": "↺ Reset all of today's tasks",
    "Jedes grosse Ziel sammelt eigene Sterne für eine eigene Belohnung. Die Tagesaufgaben füllen nebenbei das Sternenglas.": "Each big goal collects its own stars for its own reward. The daily tasks fill the star jar along the way.",
    "Vorlagen (antippen zum Hinzufügen)": "Templates (tap to add)", "Vorlagen (antippen, dann anpassen)": "Templates (tap, then adjust)",
    "Am Morgen": "In the morning", "Am Tag": "During the day", "Am Abend": "In the evening", "☀️ Morgen": "☀️ Morning", "🕐 Tag": "🕐 Day", "🌙 Abend": "🌙 Evening",
    "Meine Sticker": "My stickers", "Sticker-Album": "Sticker album", "Noch keine Sticker. Für jede Belohnung und jedes grosse Ziel gibt es einen.": "No stickers yet. There is one for every reward and every big goal.",
    "Zurück zur Übersicht": "Back to overview", "z. B. Allein einschlafen": "e.g. fall asleep alone", "z. B. Monstertruck": "e.g. monster truck",
    "z. B. Töpfchen": "e.g. potty", "z. B. Velohelm aufhängen": "e.g. hang up the bike helmet", "z. B. Zoo-Besuch, Glace, Kino": "e.g. zoo visit, ice cream, cinema",
    // Belohnungen
    "Lolli": "Lollipop", "Gummibärli": "Gummy bears", "Sticker": "Sticker", "Seifenblasen": "Bubbles", "Ballon": "Balloon", "Schoggi": "Chocolate",
    "Glace": "Ice cream", "Pommes": "Fries", "Heftli": "Magazine", "Malbuch": "Colouring book", "Spielzeugauto": "Toy car", "Spielfigur": "Toy figure",
    "Hörspiel": "Audio story", "Puzzle": "Puzzle", "Buch": "Book", "Länger aufbleiben": "Stay up later", "Kuchen backen": "Bake a cake", "Pizza essen": "Pizza night",
    "Freund einladen": "Invite a friend", "Badi": "Swimming pool", "Velotour": "Bike ride", "Zoo": "Zoo", "Ausflug": "Day trip", "Monstertruck": "Monster truck", "Kuscheltier": "Cuddly toy",
    // Vorlagen Aufgaben und Ziele
    "Zähne putzen": "Brush teeth", "Anziehen": "Get dressed", "Bett machen": "Make the bed", "Frühstück essen": "Eat breakfast", "Znüni einpacken": "Pack a snack",
    "Schuhe anziehen": "Put on shoes", "Hände waschen": "Wash hands", "Pflanzen giessen": "Water the plants", "Tisch decken": "Set the table", "Aufräumen": "Tidy up",
    "Pyjama anziehen": "Put on pyjamas", "Buch anschauen": "Look at a book", "Baden / Duschen": "Bath / shower", "Töpfchen": "Potty",
    "Schläft im eigenen Bett": "Sleeps in own bed", "Trocken in der Nacht": "Dry at night", "Ohne Nuggi": "No dummy", "Selber anziehen": "Dress by myself",
    "Allein Zähne putzen": "Brush teeth alone", "Schuhe selber binden": "Tie own shoes", "Velo ohne Stützräder": "Bike without stabilisers", "Schwimmen üben": "Swimming practice",
    // Wochentage, Monate (lange Formen für Überschriften)
    "Heute Abfuhr:": "Collection today:", "Morgen rausstellen:": "Put out tonight:", "🏆 geschafft": "🏆 done", "Hochladen": "Upload",
    // Einstellungen
    "Einstellungen": "Settings", "⚙️ Einstellungen": "⚙️ Settings", "Einstellungen öffnen": "Open settings", "Kinder & Sterne": "Kids & stars", "Anzeige": "Display",
    "Foto & Farbe": "Photo & colour", "Kalender": "Calendars", "Ausblenden": "Hide", "Einblenden": "Show", "Kein Kalender": "No calendar", "＋ Familienmitglied hinzufügen": "＋ Add family member",
    "Ausblenden gilt nur für dieses Gerät. Fest eingerichtete Personen (aus der Konfiguration) lassen sich nicht löschen, ihre Kalender aber hier ändern.": "Hiding only applies to this device. People set up in the configuration can't be deleted here, but you can change their calendars.",
    "Aufgaben & Ziele": "Tasks & goals", "Sterne auf 0": "Stars to 0", "Für alle Kinder": "For all children", "Ändern": "Change", "Zurücksetzen": "Reset",
    "✓ Sterne erst nach Bestätigung durch Eltern": "✓ Stars only after a parent confirms", "Sterne zählen sofort": "Stars count right away", "🔒 Eltern-Code aktiv": "🔒 Parent code on", "kein Eltern-Code": "no parent code",
    "🔔 Ton an": "🔔 Sound on", "🔕 Ton aus": "🔕 Sound off", "＋ Neues Thema": "＋ New topic", "♥ Lieblingsessen": "♥ Favourite meals", "Lieblingsessen": "Favourite",
    "Noch keine. Im Essen-Fenster auf das Herz tippen.": "None yet. Tap the heart in the meal window.", "Keine. ✕ antippen holt ein Essen zurück in die Vorschläge.": "None. Tapping ✕ brings a meal back into the suggestions.",
    "🎉 Countdowns": "🎉 Countdowns", "Keine eigenen Countdowns.": "No countdowns of your own.", "＋ Countdown": "＋ Countdown", "Bei «Bald» ausgeblendet": "Hidden from coming up",
    "Nichts ausgeblendet. In der grossen «Bald»-Ansicht einen Eintrag antippen, um ihn auszublenden.": "Nothing hidden. Tap an entry in the big coming-up view to hide it.",
    "Ausrichtung": "Orientation", "Automatisch": "Automatic", "Dunkles Design": "Dark design", "Wie Home Assistant": "Like Home Assistant", "Nach Sonnenuntergang": "After sunset", "Immer hell": "Always light", "Immer dunkel": "Always dark",
    "Wieder zeigen": "Show again",
    "Für diese Einstellungen braucht es die Liste «Planer Bilder». Oben auf «Jetzt anlegen» tippen.": "These settings need the list “Planer Bilder”. Tap “Create now” at the top.",
    // Geburtstag und Nacht
    "Alles Gute! 🎉": "Happy birthday! 🎉", "🎂🎈🎁": "🎂🎈🎁", "Datum": "Date", "Bitte ein Datum wählen.": "Please choose a date.", "Geburtstag": "Birthday",
    "Am Geburtstag zeigt der Planer ein Band mit Foto und feiert einmal mit Konfetti. Steht der Geburtstag schon im Kalender (Titel mit Name und «Geburtstag»), braucht es hier nichts.": "On the birthday the planner shows a banner with the photo and celebrates once with confetti. If the birthday is already in a calendar (title with name and “birthday”), nothing is needed here.",
    "🌙 Nachtmodus": "🌙 Night mode", "Aus": "Off", "Grosse Uhr": "Big clock", "Fotos": "Photos", "Von": "From", "Bis": "To", "Ordner wählen": "Choose folder", "Jetzt ansehen": "Preview now",
    "Alle Medien": "All media", "Antippen zeigt den Planer für 2 Minuten.": "Tapping shows the planner for 2 minutes.",
    "Nachts zeigt der Planer statt dem Kalender eine ruhige, dunkle Uhr oder eure Familienfotos.": "At night the planner shows a calm, dark clock or your family photos instead of the calendar.",
    "Fotos für die Nacht": "Photos for the night", "⬆ Zurück": "⬆ Back", "Keine Unterordner.": "No subfolders.", "Diesen Ordner wählen": "Choose this folder", "Medien konnten nicht geladen werden.": "Could not load media.",
    "Fotos lädst du in Home Assistant unter «Medien» → «My media» hoch (eigenen Ordner anlegen, z. B. «Familienfotos»).": "Upload photos in Home Assistant under “Media” → “My media” (create your own folder, e.g. “Family photos”).",
    "keine Termine": "no events", "Ordner:": "Folder:", "Morgen:": "Tomorrow:", "Heute:": "Today:",
    // Essen
    "Essen": "Meals", "🍽️ Essen": "🍽️ Meals", "Mittag": "Lunch", "Abend": "Dinner", "☀️ Mittagessen": "☀️ Lunch", "🌙 Abendessen": "🌙 Dinner", "＋ planen": "＋ plan",
    "Wie war das Mittagessen?": "How was lunch?", "Wie war das Abendessen?": "How was dinner?", "schlecht": "bad", "geht so": "okay", "fein": "yummy",
    "Vorschläge": "Suggestions", "Neu ausprobieren": "Try something new", "Rezepte in Mealie": "Recipes in Mealie", "📖 Rezept": "📖 Recipe", "👩‍🍳 Kochen": "👩‍🍳 Cook",
    "🍽️ Alles zum Essen": "🍽️ All about meals", "Woche": "Week", "Rezepte": "Recipes", "Einkauf": "Shopping", "Was schmeckt": "Favourites",
    "✨ Woche füllen": "✨ Fill the week", "🛒 Zutaten der Woche": "🛒 This week's ingredients", "Rezept suchen …": "Search recipes …", "＋ Rezept per Link": "＋ Recipe from link",
    "Nichts gefunden.": "Nothing found.", "Noch keine Rezepte in Mealie. Mit «＋ Rezept per Link» das erste hinzufügen.": "No recipes in Mealie yet. Add the first one with “＋ Recipe from link”.",
    "🛒 Zutaten auf die Einkaufsliste": "🛒 Ingredients to the shopping list", "Zutaten der Woche sammeln": "Collect this week's ingredients",
    "Sammelt die Zutaten aller geplanten Essen mit Rezept der nächsten 7 Tage. Du wählst danach aus, was wirklich fehlt.": "Collects the ingredients of all planned meals with a recipe for the next 7 days. Then you choose what's really missing.",
    "Noch keine Bewertungen. Nach dem Essen erscheint im Planer «Wie war's?», und alle tippen auf 😋, 😐 oder 🤢. Daraus lernt der Planer, was allen schmeckt.": "No ratings yet. After a meal the planner asks “How was it?” and everyone taps 😋, 😐 or 🤢. The planner learns what everyone likes.",
    "📖 Rezepte mit Mealie": "📖 Recipes with Mealie", "📖 Rezepte (Mealie)": "📖 Recipes (Mealie)", "Noch nicht verbunden.": "Not connected yet.", "Adresse für Fotos": "Address for photos",
    "Mealie läuft bei euch als Add-on in Home Assistant und speichert Rezepte. Rezepte von Swissmilk, Fooby, Migusto, Chefkoch und vielen anderen Seiten lassen sich per Link übernehmen.": "Mealie runs as an add-on in your Home Assistant and stores recipes. Recipes from most recipe websites can be imported by link.",
    "In der Seitenleiste von Home Assistant «Mealie» öffnen und das Konto einrichten.": "Open “Mealie” in the Home Assistant sidebar and set up the account.",
    "In Mealie: Profil → «API-Tokens» → neues Token erstellen und kopieren.": "In Mealie: profile → “API tokens” → create a new token and copy it.",
    "Den Planer neu laden.": "Reload the planner.", "Rezept wird geladen …": "Loading recipe …", "Zutaten": "Ingredients", "🛒 Zutaten": "🛒 Ingredients", "📅 Planen": "📅 Plan",
    "Rezept per Link": "Recipe from link", "Link zum Rezept": "Link to the recipe", "Rezept wird übernommen …": "Importing recipe …", "Bitte einen Link einfügen (beginnt mit https://).": "Please paste a link (starts with https://).",
    "Funktioniert mit den meisten Rezeptseiten (z. B. Swissmilk, Fooby, Migusto, Chefkoch). Mealie übernimmt Zutaten, Schritte, Foto und Kochzeit.": "Works with most recipe websites. Mealie imports ingredients, steps, photo and cooking time.",
    "Es ist keine Einkaufsliste (Bring!) verbunden.": "No shopping list (Bring!) is connected.", "Zutaten werden gesammelt …": "Collecting ingredients …", "Was fehlt?": "What's missing?",
    "Dieses Rezept hat keine Zutatenliste.": "This recipe has no ingredient list.", "Auf die Einkaufsliste": "Add to shopping list", "· schon auf der Liste": "· already on the list",
    "In den nächsten 7 Tagen ist kein Essen mit Rezept geplant. Wähle beim Essen ein Rezept aus Mealie, dann klappt es.": "No meal with a recipe is planned for the next 7 days. Pick a recipe from Mealie for a meal, then it works.",
    "Weiter →": "Next →", "Fertig 🎉": "Done 🎉", "Dieses Rezept hat keine Schritte.": "This recipe has no steps.", "frei": "free",
    "Bereits geplante Mahlzeiten bleiben, wie sie sind. Häkchen weg bei allem, was nicht passt.": "Meals already planned stay as they are. Untick anything that doesn't fit.",
    "🍽️ Mahlzeiten": "🍽️ Meals", "Mittag und Abend": "Lunch and dinner", "Mittag nur am Wochenende": "Lunch only at weekends", "Nur Abendessen": "Dinner only",
    "Portionen für Rezepte und Einkauf": "Servings for recipes and shopping", "🍽️ Essens-Ansicht öffnen": "🍽️ Open meal view", "Mealie ist nicht eingerichtet": "Mealie is not set up",
    "Lieblingsessen": "Favourite", "oft gekocht": "cooked often", "lange nicht mehr": "not in a while", "alle mögen's": "everyone likes it", "Besuch": "guests",
    "passt zum kalten Wetter": "fits the cold weather", "passt zum warmen Wetter": "fits the warm weather",
    "🍝 Pasta": "🍝 Pasta", "🍕 Pizza & Wähe": "🍕 Pizza & tarts", "🐟 Fisch": "🐟 Fish", "🥩 Fleisch": "🥩 Meat", "🍲 Suppe & Eintopf": "🍲 Soup & stew", "🥗 Salat": "🥗 Salad",
    "🧀 Ofen & Käse": "🧀 Oven & cheese", "🍛 Reis & Asiatisch": "🍛 Rice & Asian", "🌮 Mexikanisch": "🌮 Mexican", "🥔 Kartoffeln": "🥔 Potatoes", "🔥 Grill": "🔥 Barbecue", "🥪 Brot & Eier": "🥪 Bread & eggs", "🥦 Vegi": "🥦 Veggie",
    "Montag": "Monday", "Dienstag": "Tuesday", "Mittwoch": "Wednesday", "Donnerstag": "Thursday", "Freitag": "Friday", "Samstag": "Saturday", "Sonntag": "Sunday",
  };
  // Texte mit Zahlen oder Namen
  const EN_RX = [
    [/^in (\d+) Tagen$/, "in $1 days"], [/^(\d+) Tage$/, "$1 days"], [/^(\d+) Tagen$/, "$1 days"], [/^bis (\d\d:\d\d)$/, "until $1"], [/^ab (\d\d:\d\d)$/, "from $1"],
    [/^KW (\d+)(–\d+)?$/, "Week $1$2"], [/^noch (\d+) ★$/, "$1 ★ to go"], [/^noch (\d+) ★ · einmal pro Tag$/, "$1 ★ to go · once a day"],
    [/^noch (\d+) Aufgaben? heute$/, (m, n) => `${n} ${n === "1" ? "task" : "tasks"} left today`], [/^noch (\d+)× schlafen$/, "$1 more sleeps"],
    [/^Geschafft, (.+)!$/, "You did it, $1!"], [/^Viel Spass, (.+)!$/, "Have fun, $1!"], [/^(\d+) Tage am Stück! \+1 ★$/, "$1 days in a row! +1 ★"],
    [/^(\d+) Sterne für: (.+)$/, "$1 stars for: $2"], [/^(\d+) Sterne$/, "$1 stars"], [/^(\d+) Sterne gesammelt$/, "$1 stars collected"],
    [/^(.+) hat (\d+) Sterne gesammelt! Belohnung «(.+)» einlösen\? Danach beginnt das Sammeln wieder bei 0\.$/, "$1 has collected $2 stars! Redeem the reward “$3”? Collecting then starts again at 0."],
    [/^Sterne von (.+) auf 0 setzen\?$/, "Reset $1's stars to 0?"], [/^(.+) aus dem Planer entfernen\? Die Kalender selbst bleiben unverändert\.$/, "Remove $1 from the planner? The calendars themselves stay unchanged."],
    [/^«(.+)» hinzugefügt$/, "“$1” added"], [/^«(.+)» aus den Countdowns entfernen\?$/, "Remove “$1” from the countdowns?"], [/^«(.+)» bei «Bald» ausblenden\?$/, "Hide “$1” from coming up?"],
    [/^Hochladen fehlgeschlagen: (.*)$/, "Upload failed: $1"], [/^Speichern fehlgeschlagen: (.*)$/, "Saving failed: $1"],
    [/^Format: (.+)$/, "Format: $1"], [/^Farbe (.+)$/, "Colour $1"], [/^Zum Dashboard «(.+)»$/, "Go to the “$1” dashboard"], [/^(.+) bis (\d+)\. (\w+)$/, "$1 until $3 $2"],
    [/^(\d+)\. – (\d+)\. (\w+)$/, "$3 $1–$2"], [/^\+(\d+) weitere$/, "+$1 more"], [/^Essen am (.+)$/, "Meal on $1"], [/^Vorschläge für (.+)$/, "Suggestions for $1"],
    [/^(.+) nicht mehr vorschlagen$/, "Don't suggest $1 again"], [/^(\d+) von (\d+) Sternen$/, "$1 of $2 stars"], [/^Aufgaben von (.+)$/, "$1's tasks"],
    [/^(\d+)× → (\S+) (.+)$/, (m, n, e, x) => `${n}× → ${e} ${EN[x] || x}`],
    [/^(.+) bearbeiten$/, "Edit $1"], [/^Belohnung für (.+)$/, "Reward for $1"], [/^Worauf sammelt (.+)\?$/, "What is $1 saving up for?"],
    [/^aktuell (\d+) Sterne?$/, "currently $1 stars"], [/^(\w{2,3}) (\d+)\.(\d+)\.( .*)?$/, (m, w, d, mo, x) => `${w} ${+d} ${EN_ARRAYS.MOS[mo - 1]}${x || ""}`],
    [/^Noch eine Liste anlegen:$/, "Create one more list:"], [/^Noch (\d+) Listen anlegen:$/, "Create $1 more lists:"], [/^✓ Eltern bestätigen \((\d+)\)$/, "✓ Parent check ($1)"],
    [/^Ausschnitt für (.+)$/, "Crop for $1"], [/^(\d+) \/ (\d+) ★ → (.*)$/, "$1 / $2 ★ → $3"],
        [/^Kalender von (.+)$/, "Calendars of $1"], [/^Kalender von (.+) wieder wie in der Konfiguration\?$/, "Reset $1's calendars to the configuration?"],
    [/^Wie Karte \((.+)\)$/, "Like the card ($1)"], [/^Diese Einstellungen gelten nur für dieses Gerät\. Familienplaner (.+)\.$/, "These settings only apply to this device. Family planner $1."],
    [/^(\d+) ★ · (\d+) Tagesaufgaben · (\d+) grosse Ziele$/, "$1 ★ · $2 daily tasks · $3 big goals"], [/^📅 (.+)$/, "📅 $1"], [/^(.+) entfernen$/, "Remove $1"],
    [/^(.+) · ohne Bilder$/, (m, a) => `${trEN(a)} · without pictures`], [/^(.+) · ausgeblendet$/, (m, a) => `${trEN(a)} · hidden`],
        [/^(.+) hat heute Geburtstag!$/, "It's $1's birthday today!"], [/^(\d+) Jahre 🎉$/, "$1 years 🎉"], [/^(\d+) Jahre 🎂🎈🎁$/, "$1 years 🎂🎈🎁"], [/^Alles Gute zum Geburtstag, (.+)!$/, "Happy birthday, $1!"],
    [/^🎂 Geburtstag von (.+)$/, "🎂 $1's birthday"], [/^(Heute|Morgen): (.*)$/, (m, d, r) => `${d === "Heute" ? "Today" : "Tomorrow"}: ${r.replace(/(\d+) Termine?\b/, (x, n) => `${n} ${n === "1" ? "event" : "events"}`).replace("keine Termine", "no events")}`],
    [/^Ordner: (.*)$/, "Folder: $1"], [/^(\d+) Termine?$/, (m, n) => `${n} ${n === "1" ? "event" : "events"}`], [/^· (\d+) Bilder?$/, (m, n) => `· ${n} ${n === "1" ? "picture" : "pictures"}`], [/^📁 (.+)$/, "📁 $1"],
        [/^Mittagessen am (.+)$/, "Lunch on $1"], [/^Abendessen am (.+)$/, "Dinner on $1"], [/^oft am (.+)$/, "often on $1"], [/^schnell \((\d+) Min\.\)$/, "quick ($1 min)"],
    [/^Rest verwerten: (.+)$/, "use up: $1"], [/^(\d+) Min\.$/, "$1 min"], [/^(☀️ Mittagessen|🌙 Abendessen) · (\d+) Min\.$/, (m, a, n) => `${a.startsWith("☀") ? "☀️ Lunch" : "🌙 Dinner"} · ${n} min`],
    [/^⏱ (\d+) Min\.(.*)$/, "⏱ $1 min$2"], [/^✨ Neu ausprobieren: (.+)$/, "✨ Try something new: $1"], [/^«(.+)» planen$/, "Plan “$1”"],
    [/^Schritt (\d+) von (\d+)(.*)$/, "Step $1 of $2$3"], [/^⏱ (.+) starten$/, "⏱ Start $1"], [/^(\d+) Portionen$/, "$1 servings"],
    [/^Für (\d+) Portionen(.*)\. Häkchen weg bei allem, was ihr schon habt\.$/, "For $1 servings$2. Untick anything you already have."], [/^(\d+) Zutaten auf «(.+)»$/, "$1 ingredients added to “$2”"],
    [/^Verbunden · (\d+) Rezepte$/, "Connected · $1 recipes"], [/^Hat nicht geklappt: (.*)$/, "Didn't work: $1"], [/^Rezept konnte nicht geladen werden: (.*)$/, "Could not load recipe: $1"],
    [/^Essen nicht gespeichert: (.*)$/, "Meal not saved: $1"], [/^· (\d+) Rezepte$/, "· $1 recipes"],
        [/^Person (\d)$/, "Person $1"], [/^Ämtli (.+)$/, "Chores $1"], [/^Foto (.+)$/, "Photo $1"],
  ];
  // Datumsformen nach dem Umstellen der Monatsnamen: «3. Nov» -> «Nov 3»
  const EN_MON = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December";
  const EN_DATE = new RegExp(`(\\d{1,2})\\. (${EN_MON})\\b`, "g");
  const trEN = (s) => {
    const t = s.trim();
    if (!t || !/[A-Za-zÄÖÜäöü]/.test(t)) return s;
    let out = EN[t];
    if (out === undefined) {
      for (const [re, rep] of EN_RX) { if (re.test(t)) { out = t.replace(re, rep); break; } }
    }
    // Mehrteilige Zeilen: «Sterne zählen sofort · kein Eltern-Code»
    if (out === undefined && t.includes(" · ")) { const parts = t.split(" · ").map((x) => trEN(x)); if (parts.join(" · ") !== t) out = parts.join(" · "); }
    if (out === undefined) {
      // Emoji vor dem Text: «🪥 Zähne putzen»
      const m = t.match(/^([^\p{L}\d]+?)\s+(.+)$/u);
      out = m && EN[m[2]] ? `${m[1]} ${EN[m[2]]}` : t;
    }
    out = out.replace(EN_DATE, "$2 $1").replace(/«/g, "“").replace(/»/g, "”");
    if (out === t) return s;
    return s.replace(t, out);
  };
  const EN_ARRAYS = {
    WD: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    WDL: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    MO: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    MOS: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  };
  const DE_ARRAYS = { WD: WD.slice(), WDL: WDL.slice(), MO: MO.slice(), MOS: MOS.slice() };
  let LANG = "de";
  // Vorlagen in der aktiven Sprache speichern
  const L = (t) => (LANG === "en" ? EN[t] || t : t);
  const setLang = (l) => {
    if (l === LANG) return;
    LANG = l;
    const src = l === "en" ? EN_ARRAYS : DE_ARRAYS;
    WD.splice(0, 7, ...src.WD); WDL.splice(0, 7, ...src.WDL); MO.splice(0, 12, ...src.MO); MOS.splice(0, 12, ...src.MOS);
  };
  const TR_ATTR = ["aria-label", "title", "placeholder"];
  const translateTree = (root) => {
    if (LANG !== "en" || !root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n = root.nodeType === 1 || root.nodeType === 11 ? w.nextNode() : root;
    if (root.nodeType === 3) { const v = trEN(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; return; }
    if (root.nodeType === 1) translateEl(root);
    while (n) {
      if (n.nodeType === 3) {
        const p = n.parentNode;
        if (p && p.nodeName !== "STYLE" && p.nodeName !== "SCRIPT" && p.nodeName !== "TEXTAREA") { const v = trEN(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
      } else translateEl(n);
      n = w.nextNode();
    }
  };
  const translateEl = (el) => {
    for (const a of TR_ATTR) { const v = el.getAttribute?.(a); if (v) { const t = trEN(v); if (t !== v) el.setAttribute(a, t); } }
  };

  // ---------- Karte ----------
  class FamilienplanerCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      // Übersetzt neu gezeichnete Texte, wenn «sprache: en» aktiv ist
      this._mo = new MutationObserver((ms) => {
        if (LANG !== "en") return;
        for (const m of ms) {
          if (m.type === "childList") m.addedNodes.forEach((n) => translateTree(n));
          else if (m.type === "characterData") translateTree(m.target);
          else translateEl(m.target);
        }
      });
      this._mo.observe(this.shadowRoot, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: TR_ATTR });
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
        geburtstage: ["Geburtstag", "Birthdays"],
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
        sprache: "auto",
      };
      this._config = { ...def, ...config };
      this._applyLang();
      FERIEN = (this._config.schulferien || []).filter((f) => f && f.von && f.bis).map((f) => [String(f.von), String(f.bis), f.name || "Ferien"]);
      if (Array.isArray(this._config.feiertage)) FEIERTAGE = this._config.feiertage.map((k) => String(k).toLowerCase());
      EIGENE_FEIERTAGE = this._config.eigene_feiertage || [];
      holidayCache = {};
      // Kopien, damit Farben am Tablet geändert werden können (Original bleibt als Standard)
      this._config.personen = (this._config.personen || []).map((p) => ({ ...p, farbeStandard: p.farbe }));
      this._basePersonen = this._config.personen.slice();
      this._extraSig = "";
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

    // «auto»: Deutsch, wenn Home Assistant auf Deutsch läuft, sonst Englisch
    _applyLang() {
      const want = String(this._config?.sprache || "auto").toLowerCase();
      const ha = (this._hass?.locale?.language || this._hass?.language || navigator.language || "de").toLowerCase();
      const l = want === "de" || want === "en" ? want : ha.startsWith("de") ? "de" : "en";
      const changed = l !== LANG;
      setLang(l);
      if (changed && this._config) holidayCache = {};
      return changed;
    }

    set hass(hass) {
      const first = !this._hass;
      this._hass = hass;
      if (first && this._applyLang()) this._sig = "";
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

    // Letzter Stand (Termine, Listen, Geburtstage, Essensverlauf) im Gerät, damit der Planer sofort erscheint
    _saveSnap() {
      clearTimeout(this._snapT);
      this._snapT = setTimeout(() => {
        try {
          const data = JSON.stringify({ v: 1, t: Date.now(), range: this._range, wd: this._weekDays, ev: this._events, todos: this._todos, bdays: this._bdays || [], hist: this._mealHist || [], suggest: this._suggest || [] });
          if (data.length < 1500000) lsSet("fp-snap", data);
        } catch (e) { /* egal */ }
      }, 1500);
    }
    _loadSnap() {
      try {
        const d = JSON.parse(lsGet("fp-snap", "") || "null");
        if (!d || d.v !== 1 || Date.now() - d.t > 24 * 3600000) return;
        const ev = (x) => ({ ...x, start: new Date(x.start), end: new Date(x.end) });
        if (d.wd && !this._weekDays) this._weekDays = d.wd;
        const [s, e] = this._visibleRange();
        if (d.range === `${ymd(s)}_${ymd(e)}` && d.ev) { const out = {}; Object.entries(d.ev).forEach(([k, l]) => (out[k] = (l || []).map(ev))); this._events = out; this._range = d.range; }
        if (d.todos) Object.entries(d.todos).forEach(([k, l]) => { if (!this._todos[k]) this._todos[k] = l; });
        if (!this._bdays && d.bdays) this._bdays = d.bdays.map(ev);
        if (!this._mealHist && d.hist) this._mealHist = d.hist.map((x) => ({ ...x, d: new Date(x.d) }));
        if (!this._suggest?.length && d.suggest) this._suggest = d.suggest;
        if (this._bildListe()) this._syncPersons();
      } catch (e) { /* egal */ }
    }

    async _refreshAll() {
      this._loadSnap();
      this._refreshCalendars(true);
      this._loadTodos();
      this._loadExtras();
    }

    // Ein Abruf pro Kalender für «gestern bis +4 Monate» (bzw. grösser, falls nötig); alle Ansichten bedienen sich daraus
    _calWindow() { const t = sod(new Date()); return [addDays(t, -1), addDays(t, 122)]; }
    async _getCal(id, s, e, maxAge = 300000) {
      this._cc = this._cc || {}; this._ccP = this._ccP || {};
      const pick = (ev) => ev.filter((x) => x.end > s && x.start < e);
      const c = this._cc[id];
      if (c && c.s <= s && c.e >= e && Date.now() - c.t < maxAge) return pick(c.ev);
      const pend = this._ccP[id];
      if (pend && pend.s <= s && pend.e >= e) return pick(await pend.p);
      let [ws, we] = this._calWindow();
      if (c && Date.now() - c.t < 30 * 60000) { if (c.s < ws) ws = c.s; if (c.e > we) we = c.e; }
      if (s < ws) ws = s;
      if (e > we) we = e;
      const pr = this._fetchCal(id, ws, we);
      this._ccP[id] = { s: ws, e: we, p: pr };
      const ev = await pr;
      if (this._ccP[id]?.p === pr) delete this._ccP[id];
      this._cc[id] = { s: ws, e: we, ev, t: Date.now() };
      return pick(ev);
    }
    _calInvalidate(id) { if (this._cc) delete this._cc[id]; if (this._ccP) delete this._ccP[id]; }

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
        const lists = await Promise.all(ids.map((id) => this._getCal(id, s, e, force ? 60000 : 300000)));
        out[g] = lists.flat().sort((a, b) => a.start - b.start);
      }));
      if (seq !== this._calSeq) return;   // inzwischen wurde ein neuerer Bereich angefragt
      this._events = out;
      this._range = key;
      this._saveSnap();
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
        Promise.all(bcals.map((id) => this._getCal(id, t, addDays(t, 120)))),
        Promise.all(other.map((id) => this._getCal(id, t, addDays(t, 120)))),
      ]);
      const seen = new Set();
      this._bdays = [...b1.flat(), ...b2.flat().filter((e) => /geburtstag|geburi|birthday|bday|🎂|🎁/i.test(e.title))]
        .filter((e) => { const k = e.title + ymd(e.start); if (seen.has(k)) return false; seen.add(k); return true; });
      this._loadMealie();
      const ess = this._cals([c.essensplan]);
      if (ess.length) {
        const past = await this._getCal(ess[0], addDays(t, -365), addDays(t, 60), 30 * 60000);
        this._mealHist = past.map((e) => ({ title: (e.title || "").trim(), d: sod(e.start), slot: this._slotOf(e), slug: this._slugOf(e) })).filter((e) => e.title);
        const cnt = {};
        past.forEach((e) => (cnt[e.title] = (cnt[e.title] || 0) + 1));
        this._suggest = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 40);
      }
      this._saveSnap();
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
        if (id === this._bildListe()) this._syncPersons();
        this._saveSnap();
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
      return (this._todos[id] || []).filter((i) => i.summary && i.description && !/^(Farbe |Ausgeblendet: |Belohnung |Essen [♥✗] |Person |Foto |Kind |Sterne-Einstellungen|Geburtstag: |Essen ★ |Essen-Einstellungen)/.test(i.summary)).map((i) => ({ uid: i.uid, key: i.summary.trim(), val: i.description.trim() }))
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
    _abfall(day) {
      const t = this._hass?.states[this._config.abfall]?.attributes?.termine || [];
      const s = ymd(day);
      return t.filter((x) => x.d === s).map((x) => x.t);
    }
    _wx(day) { const s = ymd(day); return this._forecast.find((f) => ymd(new Date(f.datetime)) === s); }
    // ---------- Weitere Familienmitglieder (am Tablet hinzugefügt, gespeichert in «Planer Bilder») ----------
    _extraPersons() {
      const out = [];
      (this._todos[this._bildListe()] || []).forEach((i) => {
        const m = /^Person (.+)$/.exec(i.summary || "");
        if (!m) return;
        let d = {};
        try { d = JSON.parse(i.description || "{}") || {}; } catch (e) { d = {}; }
        const farbe = /^#[0-9a-f]{6}$/i.test(d.farbe || "") ? d.farbe : "#1971c2";
        out.push({ name: m[1].trim(), farbe, farbeStandard: farbe, kalender: Array.isArray(d.kalender) ? d.kalender : [], bilder: d.bilder !== false, extra: true, uid: i.uid });
      });
      const base = new Set((this._basePersonen || []).map((p) => p.name.toLowerCase()));
      return out.filter((p) => !base.has(p.name.toLowerCase()));
    }
    // Änderungen an den fest eingerichteten Personen (Kalender, Bilder)
    _baseOverrides() {
      const base = new Map((this._basePersonen || []).map((p) => [p.name.toLowerCase(), p]));
      const out = {};
      (this._todos[this._bildListe()] || []).forEach((i) => {
        const m = /^Person (.+)$/.exec(i.summary || "");
        if (!m || !base.has(m[1].trim().toLowerCase())) return;
        let d = {};
        try { d = JSON.parse(i.description || "{}") || {}; } catch (e) { d = {}; }
        out[base.get(m[1].trim().toLowerCase()).name] = { kalender: Array.isArray(d.kalender) ? d.kalender : null, bilder: d.bilder, uid: i.uid };
      });
      return out;
    }
    _syncPersons() {
      const ex = this._extraPersons();
      const ov = this._baseOverrides();
      const sig = JSON.stringify([ex.map((p) => [p.name, p.farbe, p.kalender, p.bilder]), ov]);
      if (sig === this._extraSig) return;
      this._extraSig = sig;
      const base = (this._basePersonen || []).map((p) => {
        const o = ov[p.name];
        if (!o) return p;
        return { ...p, kalender: o.kalender || p.kalender, bilder: o.bilder === undefined ? p.bilder : o.bilder !== false, override: o.uid };
      });
      this._config.personen = [...base, ...ex];
      this._refreshCalendars(true);
      this._loadExtras();
    }
    _photoValue(p) {
      if (p.foto) return this._hass?.states[p.foto]?.state;
      return (this._todos[this._bildListe()] || []).find((i) => i.summary === `Foto ${p.name}`)?.description;
    }
    async _setPhotoValue(p, value) {
      const h = this._hass;
      if (p.foto) { await h.callService("input_text", "set_value", { entity_id: p.foto, value }); return; }
      const liste = this._bildListe();
      if (!liste) throw new Error("Liste «Planer Bilder» fehlt");
      const it = (this._todos[liste] || []).find((i) => i.summary === `Foto ${p.name}`);
      if (!value) { if (it) await h.callService("todo", "remove_item", { item: it.uid }, { entity_id: liste }); }
      else if (it) await h.callService("todo", "update_item", { item: it.uid, description: value }, { entity_id: liste });
      else await h.callService("todo", "add_item", { item: `Foto ${p.name}`, description: value }, { entity_id: liste });
      await this._loadTodo(liste);
    }
    _openPerson(p) {
      const h = this._hass, liste = this._bildListe();
      if (!liste) { this._openConfirm("Dafür braucht es die Liste «Planer Bilder». Oben auf «Jetzt anlegen» tippen.", "OK", async () => {}); return; }
      const FARBEN = ["#d6336c", "#e8590c", "#2b8a3e", "#7048e8", "#1971c2", "#0c8599", "#f08c00", "#c92a2a", "#a61e4d", "#5f3dc4", "#66a80f", "#495057"];
      const used = new Set(this._config.personen.map((x) => x.farbe));
      let farbe = p?.farbe || FARBEN.find((c) => !used.has(c)) || FARBEN[0];
      const cals = Object.keys(h.states).filter((id) => id.startsWith("calendar.")).map((id) => ({ id, name: h.states[id].attributes.friendly_name || id }))
        .filter((c) => !this._cals([this._config.essensplan]).includes(c.id)).sort((a, b) => a.name.localeCompare(b.name));
      const sel = new Set(p ? this._cals(p.kalender) : []);
      this._mh = {
        farbe: (el) => { farbe = el.dataset.v; this.shadowRoot.querySelectorAll("#modal .sw").forEach((b) => b.classList.toggle("on", b === el)); this.shadowRoot.querySelector("#modal .dlg-h").style.setProperty("--c", farbe); },
        save: async () => {
          if (p && !p.extra) {
            const kal0 = [...this.shadowRoot.querySelectorAll("#modal .calpick input:checked")].map((i) => i.value);
            const bilder0 = this.shadowRoot.querySelector("#fp-bilder").checked;
            const d0 = JSON.stringify({ basis: true, kalender: kal0, bilder: bilder0 });
            if (p.override) await h.callService("todo", "update_item", { item: p.override, description: d0 }, { entity_id: liste });
            else await h.callService("todo", "add_item", { item: `Person ${p.name}`, description: d0 }, { entity_id: liste });
            await this._loadTodo(liste);
            this._modal("");
            return;
          }
          const name = this.shadowRoot.querySelector("#fp-in").value.trim();
          const fl = this.shadowRoot.querySelector("#modal .flash");
          if (!name) { fl.textContent = "Bitte einen Namen eingeben."; return; }
          if (/[|]/.test(name) || name.length > 30) { fl.textContent = "Der Name darf höchstens 30 Zeichen haben."; return; }
          const clash = this._config.personen.some((x) => x.name.toLowerCase() === name.toLowerCase() && x !== p);
          if (clash) { fl.textContent = `«${name}» gibt es schon.`; return; }
          const kal = [...this.shadowRoot.querySelectorAll("#modal .calpick input:checked")].map((i) => i.value);
          const bilder = this.shadowRoot.querySelector("#fp-bilder").checked;
          const description = JSON.stringify({ farbe, kalender: kal, bilder });
          if (p?.uid) {
            if (p.name !== name) {
              await h.callService("todo", "update_item", { item: p.uid, rename: `Person ${name}`, description }, { entity_id: liste });
              const foto = (this._todos[liste] || []).find((i) => i.summary === `Foto ${p.name}`);
              if (foto) await h.callService("todo", "update_item", { item: foto.uid, rename: `Foto ${name}` }, { entity_id: liste });
            } else await h.callService("todo", "update_item", { item: p.uid, description }, { entity_id: liste });
          } else await h.callService("todo", "add_item", { item: `Person ${name}`, description }, { entity_id: liste });
          await this._loadTodo(liste);
          this._modal("");
        },
        reset: () => this._openConfirm(`Kalender von ${p.name} wieder wie in der Konfiguration?`, "Zurücksetzen", async () => {
          await h.callService("todo", "remove_item", { item: p.override }, { entity_id: liste });
          await this._loadTodo(liste);
        }),
        del: () => this._openConfirm(`${p.name} aus dem Planer entfernen? Die Kalender selbst bleiben unverändert.`, "Entfernen", async () => {
          await h.callService("todo", "remove_item", { item: p.uid }, { entity_id: liste });
          const foto = (this._todos[liste] || []).find((i) => i.summary === `Foto ${p.name}`);
          if (foto) await h.callService("todo", "remove_item", { item: foto.uid }, { entity_id: liste });
          await this._loadTodo(liste);
        }),
      };
      this._modal(`
        <div class="dlg-h" style="--c:${farbe}"><span class="bar"></span><h2>${p ? (p.extra ? `${esc(p.name)} bearbeiten` : `Kalender von ${esc(p.name)}`) : "Familienmitglied hinzufügen"}</h2></div>
        <div class="dlg-b">
          ${p && !p.extra ? "" : `<label class="kw">Name<input id="fp-in" type="text" maxlength="30" autofocus placeholder="z. B. Grosi, Leo" value="${esc(p?.name || "")}"></label>
          <div class="farben left"><span class="lbl">Farbe</span>
            ${FARBEN.map((c) => `<button class="sw ${c === farbe ? "on" : ""}" data-m="farbe" data-v="${c}" style="background:${c}" aria-label="Farbe ${c}"></button>`).join("")}</div>`}
          <div class="sect">Kalender dieser Person</div>
          <div class="calpick">${cals.length ? cals.map((c) => `<label><input type="checkbox" value="${esc(c.id)}" ${sel.has(c.id) ? "checked" : ""}><span>${esc(c.name)}</span></label>`).join("") : `<p class="hint2">Noch keine Kalender in Home Assistant. Zuerst einen Kalender einbinden (z. B. «Remote Calendar»).</p>`}</div>
          <label class="chk"><input id="fp-bilder" type="checkbox" ${p?.bilder === false ? "" : "checked"}><span>Bilder auf den Terminen zeigen</span></label>
          <p class="hint2">Foto und Farbe lassen sich danach wie gewohnt ändern: lange auf das Foto drücken.</p>
          <div class="flash"></div>
        </div>
        <div class="dlg-f">${p?.uid ? `<button class="btn ghost" data-m="del">Entfernen</button>` : p?.override ? `<button class="btn ghost" data-m="reset">Zurücksetzen</button>` : ""}<span class="sp"></span><button class="btn ghost" data-m="close">Abbrechen</button><button class="btn" data-m="save">${p ? "Speichern" : "Hinzufügen"}</button></div>`);
    }

    _photo(p) {
      const v = this._photoValue(p);
      if (!v || v === "unknown" || v === "unavailable") return null;
      if (v.startsWith("/") || v.startsWith("http")) return v;
      return `/api/image/serve/${v.split("|")[0]}/512x512`;
    }
    _photoInfo(p) {
      const v = this._photoValue(p) || "";
      const [crop, orig, z, x, y] = v.split("|");
      if (!orig) return null;
      return { orig, z: +z || 1, x: +x || 0.5, y: +y || 0.5 };
    }
    _visiblePersons() { return this._config.personen.map((p, i) => ({ ...p, i })).filter((p) => !this._hidden.has(p.name)); }
    // Design: "sonne" = dunkel zwischen Sonnenuntergang und -aufgang, "auto" = wie Home Assistant, "hell", "dunkel"
    _isDark() {
      const m = String(lsGet("fp-dunkel", "") || this._config.dunkel || "auto").toLowerCase();
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
        root.innerHTML = `<style>${STYLE}</style><div id="app" lang="de"></div><div id="kid"></div><div id="night"></div><div id="party"></div><div id="modal"></div>`;
        root.querySelector("#app").addEventListener("click", (e) => this._click(e));
        root.querySelector("#modal").addEventListener("click", (e) => this._modalClick(e));
        root.querySelector("#kid").addEventListener("click", (e) => this._kidClick(e));
        root.querySelector("#kid").addEventListener("pointerdown", () => this._kidTouch());
        root.querySelector("#kid").addEventListener("change", (e) => this._settingsChange(e));
        root.querySelector("#night").addEventListener("click", () => { this._nightSnooze = Date.now() + 120000; this._nightForce = false; this._nightHide(); });
        // Wer den Planer benutzt, hält ihn wach
        root.querySelector("#app").addEventListener("pointerdown", () => { if ((this._nightSnooze || 0) > Date.now()) this._nightSnooze = Date.now() + 120000; });
        root.querySelector("#party").addEventListener("click", () => this._partyClose());
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
        ${this._bdayBand()}
        ${this._rateBand()}
        ${this._setupBanner()}
        <div class="body">
          <section class="main">${this._view === "tag" ? this._dayView() : this._view === "monat" ? this._monthView() : this._weekView()}</section>
          <aside class="side ${this._sideClass()}" data-scroll="side">${this._sidePanels()}</aside>
        </div>`;
      app.querySelectorAll("[data-scroll]").forEach((el) => { if (scrolls[el.dataset.scroll] != null) el.scrollTop = scrolls[el.dataset.scroll]; });
      if (this._slide) { const m = app.querySelector(".main"); if (m) m.classList.add(this._slide > 0 ? "slide-l" : "slide-r"); this._slide = 0; }
      if (this._view === "woche") requestAnimationFrame(() => this._fitWeek());
      if (this._kidOpen) this._renderKid();
      this._bdayAutoParty();
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
      this._nightCheck();
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
            <button class="homebtn" data-act="essen" title="Essen"><ha-icon icon="mdi:silverware-fork-knife"></ha-icon><span>Essen</span></button>
            <button class="homebtn wide" data-act="einstellungen" title="Einstellungen"><ha-icon icon="mdi:cog"></ha-icon><span>Einstellungen</span></button>
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
          <span class="ring">${img ? `<img src="${esc(img)}" alt="">` : `<span class="ini">${esc(p.name[0])}</span>`}${this._bdayOf(p) ? `<span class="avb">🎂</span>` : ""}</span>
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
        ${this._mealButtons(d, false)}`;
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
          <div class="wcorner">${this._cals(fam.kalender).length ? `<div class="famlegend" style="--c:${fam.farbe}"><span class="dot"></span>${esc(fam.name)}</div>` : ""}${this._config.personen_hinzufuegen !== false ? `<button class="addp" data-act="addperson" title="Familienmitglied hinzufügen"><ha-icon icon="mdi:account-plus"></ha-icon><span>Person</span></button>` : ""}</div>
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
          ${this._mealButtons(d, true)}
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
      return !ch && !stv ? "nochores" : ch && stv ? "both" : stv ? "tileonly" : "";
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
    _kids() { return this._config.personen.filter((p) => p.sterne && this._hass.states[p.sterne]); }
    _starsPanel() {
      const ks = this._kids();
      return `<button class="panel starsp tile" data-act="rewards" aria-label="Sterne und Belohnungen öffnen">
        <div class="ph"><ha-icon icon="mdi:star-circle-outline"></ha-icon><h3>Sterne</h3></div>
        <div class="tilebody">
          <span class="tilestar">⭐</span>
          <span class="tilekids">${ks.map((p) => this._kidAvatar(p, 46)).join("")}</span>
          <span class="tilehint">Aufgaben &amp; Belohnungen</span>
        </div>
      </button>`;
    }
    // ================= Kinder: Aufgaben, grosse Ziele, Sticker =================
    _kidSettings() {
      const it = (this._todos[this._bildListe()] || []).find((i) => i.summary === "Sterne-Einstellungen");
      let d = {};
      try { d = JSON.parse(it?.description || "{}") || {}; } catch (e) { d = {}; }
      return { bestaetigen: !!d.bestaetigen, pin: /^\d{4}$/.test(d.pin || "") ? d.pin : "", ton: d.ton !== false, uid: it?.uid };
    }
    async _saveKidSettings(v) {
      const h = this._hass, liste = this._bildListe();
      const cur = this._kidSettings();
      const description = JSON.stringify({ bestaetigen: v.bestaetigen, pin: v.pin, ton: v.ton });
      if (cur.uid) await h.callService("todo", "update_item", { item: cur.uid, description }, { entity_id: liste });
      else await h.callService("todo", "add_item", { item: "Sterne-Einstellungen", description }, { entity_id: liste });
      await this._loadTodo(liste);
    }
    _kidItem(p) { return (this._todos[this._bildListe()] || []).find((i) => i.summary === `Kind ${p.name}`); }
    _kid(p) {
      let d = null;
      const it = this._kidItem(p);
      if (it) { try { d = JSON.parse(it.description || "{}"); } catch (e) { d = null; } }
      const today = ymd(new Date());
      if (!d || typeof d !== "object") d = {};
      if (!Array.isArray(d.aufgaben)) d.aufgaben = [
        { id: "a1", text: "Zähne putzen", bild: "🪥", zeit: "morgen" }, { id: "a2", text: "Anziehen", bild: "👕", zeit: "morgen" },
        { id: "a3", text: "Zähne putzen", bild: "🪥", zeit: "abend" }, { id: "a4", text: "Pyjama anziehen", bild: "🌙", zeit: "abend" }];
      if (!Array.isArray(d.ziele)) d.ziele = [];
      if (!Array.isArray(d.sticker)) d.sticker = [];
      if (!d.streak) d.streak = { n: 0, last: "" };
      if (!d.heute || d.heute.datum !== today) d.heute = { datum: today, done: {} };
      d.ziele.forEach((z) => {
        if (typeof z.wait === "string") { z.waitDay = z.wait; z.wait = z.wait === today ? 1 : 0; }
        z.wait = +z.wait || 0; z.n = +z.n || 0; z.ziel = Math.max(1, +z.ziel || 1);
        if (!z.oft) z.oft = "tag";
        if (!z.belohnung) z.belohnung = {};
      });
      // Flamme erlischt, wenn gestern nicht alles erledigt war
      const yest = ymd(addDays(new Date(), -1));
      if (d.streak.last && d.streak.last !== today && d.streak.last !== yest) d.streak = { n: 0, last: "" };
      return d;
    }
    async _saveKid(p, d) {
      const h = this._hass, liste = this._bildListe();
      if (!liste) return;
      const it = this._kidItem(p);
      const description = JSON.stringify(d);
      if (it) await h.callService("todo", "update_item", { item: it.uid, description }, { entity_id: liste });
      else await h.callService("todo", "add_item", { item: `Kind ${p.name}`, description }, { entity_id: liste });
      await this._loadTodo(liste);
    }
    _stars(p) { return Math.max(0, parseInt(this._hass.states[p.sterne]?.state, 10) || 0); }
    async _addStars(p, n) { for (let k = 0; k < n; k++) await this._hass.callService("counter", "increment", { entity_id: p.sterne }); }
    _kidAvatar(p, size) {
      const img = this._photo(p);
      return `<span class="kav" style="--c:${p.farbe};width:${size}px;height:${size}px">${img ? `<img src="${esc(img)}" alt="">` : `<span>${esc(p.name[0])}</span>`}</span>`;
    }
    // Eltern-Bestätigung: mit PIN (falls gesetzt), sonst einfache Rückfrage
    _parent(text, ok) {
      const st = this._kidSettings();
      if (!st.pin) {
        this._mh = { ok: async () => { this._modal(""); await ok(); } };
        this._modal(`<div class="dlg-b"><p class="q">${esc(text)}</p></div><div class="dlg-f"><span class="sp"></span><button class="btn ghost" data-m="close">Abbrechen</button><button class="btn" data-m="ok">Bestätigen</button></div>`);
        return;
      }
      let code = "";
      const draw = () => { const el = this.shadowRoot.querySelector("#fp-pin"); if (el) el.innerHTML = [0, 1, 2, 3].map((k) => `<span class="${k < code.length ? "on" : ""}"></span>`).join(""); };
      this._mh = {
        key: async (el) => {
          const v = el.dataset.v;
          if (v === "del") code = code.slice(0, -1); else if (code.length < 4) code += v;
          draw();
          if (code.length === 4) {
            if (code === st.pin) { this._modal(""); await ok(); }
            else { code = ""; draw(); const f = this.shadowRoot.querySelector("#modal .flash"); if (f) f.textContent = "Falscher Code"; }
          }
        },
      };
      this._modal(`<div class="dlg-h"><ha-icon icon="mdi:lock-outline"></ha-icon><h2>Eltern-Code</h2></div>
        <div class="dlg-b center"><p class="hint2">${esc(text)}</p><div id="fp-pin" class="pindots"></div><div class="flash"></div>
          <div class="pinpad">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k) => k ? `<button data-m="key" data-v="${k}">${k === "del" ? "⌫" : k}</button>` : "<span></span>").join("")}</div></div>
        <div class="dlg-f"><span class="sp"></span><button class="btn ghost" data-m="close">Abbrechen</button></div>`);
      draw();
    }

    // ================= Geburtstag =================
    // Datum am Tablet («Geburtstag: <Name>» = JJJJ-MM-TT) oder ein Geburtstags-Termin heute mit dem Namen im Titel
    _bdayDate(p) {
      const it = (this._todos[this._bildListe()] || []).find((i) => i.summary === `Geburtstag: ${p.name}`);
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((it?.description || "").trim());
      return m ? { y: +m[1], m: +m[2], d: +m[3], uid: it.uid, raw: m[0] } : null;
    }
    _bdayOf(p) {
      const now = new Date();
      const bd = this._bdayDate(p);
      if (bd) return bd.m === now.getMonth() + 1 && bd.d === now.getDate() ? { alter: bd.y > 1900 ? now.getFullYear() - bd.y : 0 } : null;
      const re = new RegExp(`(^|[^\\p{L}])${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu");
      const ev = (this._bdays || []).find((e) => sameDay(e.start, now) && re.test(e.title || ""));
      if (!ev) return null;
      const a = /(\d{1,3})\s*\.?\s*(geburtstag|geburi|jahre)/i.exec(ev.title || "");
      return { alter: a ? +a[1] : 0 };
    }
    _bdayToday() {
      const now = new Date();
      const members = this._config.personen.map((p) => ({ p, b: this._bdayOf(p) })).filter((x) => x.b);
      const names = members.map((x) => x.p.name.toLowerCase());
      const others = (this._bdays || []).filter((e) => sameDay(e.start, now) && !names.some((n) => (e.title || "").toLowerCase().includes(n)))
        .filter((e) => !this._ausgeblendet().includes(`${e.title}|${ymd(e.start)}`));
      return { members, others };
    }
    _bdayBand() {
      const { members, others } = this._bdayToday();
      if (!members.length && !others.length) return "";
      return `<div class="bdband" data-act="bdparty" role="button">
        <span class="bdconf" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="left:${(i * 5.7) % 100}%;animation-delay:${(i * 0.37) % 3}s;background:${["#f2b400", "#d6336c", "#2b8a3e", "#1971c2", "#7048e8"][i % 5]}"></i>`).join("")}</span>
        ${members.map(({ p, b }) => `<span class="bdm" style="--c:${p.farbe}">${this._kidAvatar(p, 46)}<span><b>${esc(p.name)} hat heute Geburtstag!</b>${b.alter ? `<small>${b.alter} Jahre 🎉</small>` : `<small>Alles Gute! 🎉</small>`}</span></span>`).join("")}
        ${others.length ? `<span class="bdo">🎂 ${others.map((e) => esc(e.title)).join(" · ")}</span>` : ""}
      </div>`;
    }
    _bdayParty(p, b) {
      const img = this._photo(p);
      this._party(p, img ? `url:${img}` : "🎂", `Alles Gute zum Geburtstag, ${p.name}!`, b.alter ? `${b.alter} Jahre 🎂🎈🎁` : "🎂🎈🎁");
      const el = this.shadowRoot.querySelector("#party .ppic");
      if (el && img) el.classList.add("round");
    }
    // Einmal pro Tag und Gerät von selbst feiern (ab 6 Uhr, nicht im Nachtmodus)
    _bdayAutoParty() {
      if (!this._hass || new Date().getHours() < 6 || this._nightOn) return;
      const { members } = this._bdayToday();
      if (!members.length) return;
      const key = ymd(new Date()) + "|" + members.map((x) => x.p.name).join(",");
      if (lsGet("fp-bdparty", "") === key) return;
      lsSet("fp-bdparty", key);
      setTimeout(() => this._bdayParty(members[0].p, members[0].b), 600);
    }
    _openBday(p) {
      const h = this._hass, liste = this._bildListe();
      const cur = this._bdayDate(p);
      const save = async (val) => {
        if (cur) { if (val) await h.callService("todo", "update_item", { item: cur.uid, description: val }, { entity_id: liste }); else await h.callService("todo", "remove_item", { item: cur.uid }, { entity_id: liste }); }
        else if (val) await h.callService("todo", "add_item", { item: `Geburtstag: ${p.name}`, description: val }, { entity_id: liste });
        await this._loadTodo(liste);
        this._modal("");
      };
      this._mh = {
        save: () => { const v = this.shadowRoot.querySelector("#fp-bd").value; if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { this.shadowRoot.querySelector("#modal .flash").textContent = "Bitte ein Datum wählen."; return; } save(v); },
        del: () => save(""),
      };
      this._modal(`<div class="dlg-h" style="--c:${p.farbe}"><span class="bar"></span><h2>🎂 Geburtstag von ${esc(p.name)}</h2></div>
        <div class="dlg-b"><label class="kw">Datum<input id="fp-bd" type="date" value="${esc(cur?.raw || "")}"></label>
          <p class="hint2">Am Geburtstag zeigt der Planer ein Band mit Foto und feiert einmal mit Konfetti. Steht der Geburtstag schon im Kalender (Titel mit Name und «Geburtstag»), braucht es hier nichts.</p><div class="flash"></div></div>
        <div class="dlg-f">${cur ? `<button class="btn ghost" data-m="del">Entfernen</button>` : ""}<span class="sp"></span><button class="btn ghost" data-m="close">Abbrechen</button><button class="btn" data-m="save">Speichern</button></div>`);
    }

    // ================= Nachtmodus =================
    _nightCfg() {
      let c = {};
      try { c = JSON.parse(lsGet("fp-nacht", "{}")) || {}; } catch (e) { c = {}; }
      return { modus: ["uhr", "fotos"].includes(c.modus) ? c.modus : "aus", von: /^\d\d:\d\d$/.test(c.von || "") ? c.von : "21:00", bis: /^\d\d:\d\d$/.test(c.bis || "") ? c.bis : "06:30", ordner: c.ordner || "", ordnerName: c.ordnerName || "" };
    }
    _setNightCfg(patch) { lsSet("fp-nacht", JSON.stringify({ ...this._nightCfg(), ...patch })); this._nightCheck(); }
    _nightWindow(c, now = new Date()) {
      const m = now.getHours() * 60 + now.getMinutes();
      const [a, b] = [c.von, c.bis].map((t) => { const [h, mi] = t.split(":").map(Number); return h * 60 + mi; });
      return a <= b ? m >= a && m < b : m >= a || m < b;
    }
    _nightCheck() {
      const c = this._nightCfg();
      const want = this._nightForce || (c.modus !== "aus" && this._nightWindow(c) && Date.now() > (this._nightSnooze || 0));
      if (want) this._nightShow(c); else if (this._nightOn) this._nightHide();
    }
    _nightHide() {
      this._nightOn = false; clearInterval(this._nightT); this._nightT = null;
      const el = this.shadowRoot.querySelector("#night"); if (el) { el.className = ""; el.innerHTML = ""; }
    }
    _nightShow(c) {
      const el = this.shadowRoot.querySelector("#night");
      if (!el || !this._hass) return;
      const modus = this._nightForce ? (c.modus === "aus" ? "uhr" : c.modus) : c.modus;
      if (!this._nightOn || el.dataset.modus !== modus) {
        this._nightOn = true; el.dataset.modus = modus;
        el.className = `night ${modus}`;
        el.innerHTML = modus === "fotos"
          ? `<img class="nimg" alt=""><img class="nimg" alt=""><div class="nsmall"><b class="nclock"></b><span class="ndate"></span></div>`
          : `<div class="nwrap"><div class="nclock"></div><div class="ndate"></div><div class="nnext"></div></div>`;
        if (modus === "fotos") this._nightPhotos(c);
      }
      const now = new Date();
      el.querySelectorAll(".nclock").forEach((x) => (x.textContent = hm(now)));
      el.querySelectorAll(".ndate").forEach((x) => (x.textContent = `${WDL[now.getDay()]}, ${now.getDate()}. ${MO[now.getMonth()]}`));
      const nx = el.querySelector(".nnext");
      if (nx) {
        const tom = addDays(sod(now), now.getHours() < 12 ? 0 : 1);
        const w = this._wx(tom);
        const evs = new Set();
        Object.values(this._events || {}).forEach((l) => this._on(l, tom).forEach((e) => evs.add(e.title)));
        nx.innerHTML = `${now.getHours() < 12 ? "Heute" : "Morgen"}: ${w ? `<ha-icon icon="${WX[w.condition] || "mdi:weather-partly-cloudy"}"></ha-icon> ${Math.round(w.temperature)}°${w.templow != null ? ` / ${Math.round(w.templow)}°` : ""} · ` : ""}${evs.size ? `${evs.size} ${evs.size === 1 ? "Termin" : "Termine"}` : "keine Termine"}`;
        // gegen Einbrennen: jede Minute etwas verschieben
        const wrap = el.querySelector(".nwrap");
        if (wrap && this._nightMin !== now.getMinutes()) { this._nightMin = now.getMinutes(); wrap.style.transform = `translate(${Math.round((Math.random() - 0.5) * 120)}px, ${Math.round((Math.random() - 0.5) * 160)}px)`; }
      }
    }
    // Fotos aus einem Medien-Ordner von Home Assistant (Einstellungen → Medien)
    async _nightPhotos(c) {
      const el = this.shadowRoot.querySelector("#night");
      let list = [];
      try {
        const r = await this._hass.callWS({ type: "media_source/browse_media", media_content_id: c.ordner || "media-source://media_source" });
        const kids = r.children || [];
        list = kids.filter((x) => x.media_class === "image" || /^image\//.test(x.media_content_type || ""));
        if (!list.length) {
          for (const f of kids.filter((x) => x.can_expand).slice(0, 8)) {
            const r2 = await this._hass.callWS({ type: "media_source/browse_media", media_content_id: f.media_content_id });
            list.push(...(r2.children || []).filter((x) => x.media_class === "image" || /^image\//.test(x.media_content_type || "")));
          }
        }
      } catch (e) { list = []; }
      if (!this._nightOn || el.dataset.modus !== "fotos") return;
      if (!list.length) { el.dataset.modus = ""; this._setNightCfg({ modus: "uhr" }); return; }
      list.sort(() => Math.random() - 0.5);
      let i = 0, front = 0;
      const show = async () => {
        if (!this._nightOn) return;
        const it = list[i++ % list.length];
        try {
          const res = await this._hass.callWS({ type: "media_source/resolve_media", media_content_id: it.media_content_id, expires: 600 });
          const imgs = el.querySelectorAll(".nimg"); if (imgs.length < 2) return;
          const next = imgs[1 - front];
          next.onload = () => { next.classList.add("on"); imgs[front].classList.remove("on"); front = 1 - front; };
          next.src = res.url;
        } catch (e) { /* nächstes Bild */ }
      };
      show();
      clearInterval(this._nightT);
      this._nightT = setInterval(show, 20000);
    }
    async _openFolderPick(id = "media-source://media_source", path = []) {
      let r;
      try { r = await this._hass.callWS({ type: "media_source/browse_media", media_content_id: id }); } catch (e) { r = null; }
      const folders = (r?.children || []).filter((x) => x.can_expand);
      const imgs = (r?.children || []).filter((x) => x.media_class === "image" || /^image\//.test(x.media_content_type || "")).length;
      this._mh = {
        open: (el) => { const f = folders[+el.dataset.i]; this._openFolderPick(f.media_content_id, [...path, { id, title: r.title }]); },
        up: () => { const prev = path[path.length - 1]; if (prev) this._openFolderPick(prev.id, path.slice(0, -1)); },
        pick: () => { this._setNightCfg({ ordner: id, ordnerName: r?.title || "" }); this._modal(""); this._renderKid(); },
      };
      this._modal(`<div class="dlg-h"><ha-icon icon="mdi:folder-image"></ha-icon><h2>Fotos für die Nacht</h2></div>
        <div class="dlg-b"><p class="hint2">${r ? `Ordner: <b>${esc(r.title || "Medien")}</b> · ${imgs} ${imgs === 1 ? "Bild" : "Bilder"}` : "Medien konnten nicht geladen werden."}</p>
          ${path.length ? `<button class="bitem" data-m="up"><span class="bt"><b>⬆ Zurück</b></span></button>` : ""}
          <div class="blist">${folders.map((f, i) => `<button class="bitem" data-m="open" data-i="${i}"><span class="bt"><b>📁 ${esc(f.title)}</b></span></button>`).join("") || `<p class="hint2">Keine Unterordner.</p>`}</div>
          <p class="hint2">Fotos lädst du in Home Assistant unter «Medien» → «My media» hoch (eigenen Ordner anlegen, z. B. «Familienfotos»).</p></div>
        <div class="dlg-f"><span class="sp"></span><button class="btn ghost" data-m="close">Abbrechen</button><button class="btn" data-m="pick">Diesen Ordner wählen</button></div>`);
    }
    _settingsChange(e) {
      const el = e.target;
      if (this._kidOpen !== "__settings__" || !el.dataset) return;
      if (el.dataset.k === "s-murl") { const v = el.value.trim().replace(/\/$/, ""); if (!v || /^https?:\/\//.test(v)) this._saveEssenCfg({ mealie_url: v }); return; }
      if (el.dataset.k === "s-nvon" || el.dataset.k === "s-nbis") {
        if (/^\d\d:\d\d$/.test(el.value)) this._setNightCfg(el.dataset.k === "s-nvon" ? { von: el.value } : { bis: el.value });
      }
    }

    // ================= Essen: Mahlzeiten, Bewertung, lernende Vorschläge, Mealie =================
    // Einstellungen für alle Geräte (Liste «Planer Bilder», Eintrag «Essen-Einstellungen»)
    _essenCfg() {
      const it = (this._todos[this._bildListe()] || []).find((i) => i.summary === "Essen-Einstellungen");
      let d = {};
      try { d = JSON.parse(it?.description || "{}") || {}; } catch (e) { d = {}; }
      const m = ["immer", "wochenende", "abend"].includes(d.mahlzeiten) ? d.mahlzeiten : (["immer", "wochenende", "abend"].includes(this._config.mahlzeiten) ? this._config.mahlzeiten : MAHLZEITEN_STD);
      return { mahlzeiten: m, portionen: Math.max(1, Math.min(20, +d.portionen || this._config.personen.length || 4)), mealie_url: d.mealie_url || "", bring: d.bring || "", uid: it?.uid };
    }
    async _saveEssenCfg(patch) {
      const h = this._hass, liste = this._bildListe();
      if (!liste) return;
      const cur = this._essenCfg();
      const v = { mahlzeiten: cur.mahlzeiten, portionen: cur.portionen, mealie_url: cur.mealie_url, bring: cur.bring, ...patch };
      const description = JSON.stringify(v);
      if (cur.uid) await h.callService("todo", "update_item", { item: cur.uid, description }, { entity_id: liste });
      else await h.callService("todo", "add_item", { item: "Essen-Einstellungen", description }, { entity_id: liste });
      await this._loadTodo(liste);
    }
    _slots(day) {
      const m = this._essenCfg().mahlzeiten;
      if (m === "immer") return ["mittag", "abend"];
      if (m === "wochenende" && (day.getDay() === 0 || day.getDay() === 6)) return ["mittag", "abend"];
      return ["abend"];
    }
    _slotOf(e) { return !e.allDay && e.start.getHours() < 15 ? "mittag" : "abend"; }
    _slugOf(e) { const m = /mealie:([\w-]+)/.exec(e?.description || ""); return m ? m[1] : ""; }
    _meal(day, slot = "abend") { return this._on(this._events.essen, day).find((e) => this._slotOf(e) === slot); }
    _mealButtons(d, big) {
      const slots = this._slots(d);
      const two = slots.length > 1;
      return slots.map((s) => {
        const m = this._meal(d, s);
        const icon = two ? (s === "mittag" ? "mdi:white-balance-sunny" : "mdi:weather-night") : "mdi:silverware-fork-knife";
        const empty = two ? (s === "mittag" ? "Mittag" : "Abend") : big ? "Essen planen" : "Essen planen";
        return `<button class="meal ${big ? "big" : ""} ${two ? "two" : ""} ${m ? "" : "empty"}" data-act="meal" data-day="${ymd(d)}" data-slot="${s}"><ha-icon icon="${icon}"></ha-icon><span>${m ? esc(m.title) : empty}</span></button>`;
      }).join("");
    }
    _isoLocal(d) {
      const o = -d.getTimezoneOffset();
      return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${o >= 0 ? "+" : "-"}${pad(Math.floor(Math.abs(o) / 60))}:${pad(Math.abs(o) % 60)}`;
    }
    // Speichert ein Essen: Abend = ganztägig (wie bisher), Mittag = 12–13 Uhr. Rezept-Verknüpfung in der Beschreibung.
    async _saveMeal(day, slot, title, slug, cur) {
      const h = this._hass, ess = this._cals([this._config.essensplan])[0];
      if (!ess) return;
      title = (title || "").trim();
      const desc = slug ? `mealie:${slug}` : "";
      const ev = slot === "mittag"
        ? { summary: title, dtstart: this._isoLocal(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12)), dtend: this._isoLocal(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 13)), description: desc }
        : { summary: title, dtstart: ymd(day), dtend: ymd(addDays(day, 1)), description: desc };
      try {
        if (cur && cur.uid) {
          if (!title) await h.callWS({ type: "calendar/event/delete", entity_id: ess, uid: cur.uid, ...(cur.rid ? { recurrence_id: cur.rid } : {}) });
          else await h.callWS({ type: "calendar/event/update", entity_id: ess, uid: cur.uid, event: ev, ...(cur.rid ? { recurrence_id: cur.rid } : {}) });
        } else if (title) await h.callWS({ type: "calendar/event/create", entity_id: ess, event: ev });
      } catch (err) { this._msg = `Essen nicht gespeichert: ${err.message || err.code || err}`; }
      this._calInvalidate(ess);
      this._refreshCalendars(true);
      this._loadExtras();
    }

    // ---------- Art des Essens (aus Name und Mealie-Stichwörtern) ----------
    _cats(title, tags = []) {
      const t = `${title || ""} ${(tags || []).join(" ")}`.toLowerCase();
      const out = ESSEN_ARTEN.filter(([, , re]) => re.test(t)).map(([k]) => k);
      if (!out.includes("fleisch") && !out.includes("fisch") && /vegi|vegan|vegetar|gemüse|tofu|linsen|falafel|spinat/.test(t)) out.push("vegi");
      return out;
    }
    _catLabel(k) { const a = ESSEN_ARTEN.find((x) => x[0] === k); return a ? a[1] : k === "vegi" ? "🥦 Vegi" : k; }

    // ---------- Bewertungen 😋 😐 🤢 ----------
    _rateItem(title) { return (this._todos[this._bildListe()] || []).find((i) => i.summary === `Essen ★ ${title}`); }
    _rateData(title) {
      let d = {};
      try { d = JSON.parse(this._rateItem(title)?.description || "{}") || {}; } catch (e) { d = {}; }
      if (!d.v || typeof d.v !== "object") d.v = {};
      return d;
    }
    // Durchschnitt pro Person (0 = 🤢, 1 = 😐, 2 = 😋)
    _rateAvg(title) {
      const v = this._rateData(title).v;
      const sum = {}, n = {};
      Object.values(v).forEach((votes) => Object.entries(votes || {}).forEach(([p, s]) => { sum[p] = (sum[p] || 0) + s; n[p] = (n[p] || 0) + 1; }));
      const out = {};
      Object.keys(sum).forEach((p) => (out[p] = sum[p] / n[p]));
      return out;
    }
    async _vote(title, key, person, score) {
      const h = this._hass, liste = this._bildListe();
      if (!liste || !title) return;
      const d = this._rateData(title);
      d.v[key] = { ...(d.v[key] || {}), [person]: score };
      const keys = Object.keys(d.v).sort();
      while (keys.length > 30) delete d.v[keys.shift()];
      const it = this._rateItem(title);
      const description = JSON.stringify(d);
      if (it) await h.callService("todo", "update_item", { item: it.uid, description }, { entity_id: liste });
      else await h.callService("todo", "add_item", { item: `Essen ★ ${title}`, description }, { entity_id: liste });
      await this._loadTodo(liste);
    }
    _face(s) { return s >= 1.5 ? "😋" : s >= 0.75 ? "😐" : "🤢"; }
    // Welches Essen darf gerade bewertet werden?
    _rateDue() {
      if (!this._bildListe()) return null;
      const now = new Date(), t = sod(now), hr = now.getHours() + now.getMinutes() / 60;
      const cand = [];
      if (hr < 10) cand.push([addDays(t, -1), "abend"]);
      if (hr >= 13.25 && this._slots(t).includes("mittag")) cand.push([t, "mittag"]);
      if (hr >= 19.25) cand.push([t, "abend"]);
      const skip = lsGet("fp-rate-skip", "");
      for (const [d, s] of cand.reverse()) {
        const m = this._meal(d, s);
        if (!m) continue;
        const key = `${ymd(d)}|${s}`;
        if (skip.includes(key)) continue;
        const votes = this._rateData(m.title).v[key] || {};
        const who = this._visiblePersons();
        if (who.every((p) => votes[p.name] !== undefined)) continue;
        return { m, key, slot: s, votes, who };
      }
      return null;
    }
    _rateBand() {
      const r = this._rateDue();
      if (!r) return "";
      return `<div class="rateband">
        <div class="rbq"><span class="rbt">${r.slot === "mittag" ? "Wie war das Mittagessen?" : "Wie war das Abendessen?"}</span><b>${esc(r.m.title)}</b></div>
        <div class="rbp">${r.who.map((p) => `<span class="rbperson" style="--c:${p.farbe}">${this._kidAvatar(p, 40)}${[2, 1, 0].map((s) => `<button class="rbf ${r.votes[p.name] === s ? "on" : ""} ${r.votes[p.name] !== undefined && r.votes[p.name] !== s ? "dim" : ""}" data-act="vote" data-title="${esc(r.m.title)}" data-key="${r.key}" data-name="${esc(p.name)}" data-s="${s}" aria-label="${["schlecht", "geht so", "fein"][s]}">${["🤢", "😐", "😋"][s]}</button>`).join("")}</span>`).join("")}</div>
        <button class="rbx" data-act="voteskip" data-key="${r.key}" aria-label="Schliessen">✕</button>
      </div>`;
    }

    // ---------- Vorschläge ----------
    // Bewertet bekannte Gerichte (und Mealie-Rezepte) für einen Tag und eine Mahlzeit
    _mealSuggest(day, n = 8, extra = [], slot = "abend") {
      const { fav, no } = this._mealPrefs();
      const hist = [...(this._mealHist || []), ...extra];
      const ds = sod(day);
      const by = new Map();
      const add = (title) => { const k = title.toLowerCase(); if (!by.has(k)) by.set(k, { title, cnt: 0, dow: 0, slotCnt: 0, last: null, near: false }); return by.get(k); };
      hist.forEach((e) => {
        const o = add(e.title);
        if (e.d < ds) { o.cnt++; if (e.d.getDay() === ds.getDay()) o.dow++; if ((e.slot || "abend") === slot) o.slotCnt++; if (!o.last || e.d > o.last) o.last = e.d; }
        if (Math.abs(e.d - ds) <= 3 * 864e5 && +e.d !== +ds) o.near = true;
        if (+e.d === +ds && (e.slot || "abend") !== slot) o.sameDay = true;
        if (e.slug && !o.slug) o.slug = e.slug;
      });
      fav.forEach((f) => add(f.title));
      (this._mealieList || []).forEach((r) => { const o = add(r.name); o.slug = o.slug || r.slug; o.recipe = r; });
      // Arten der letzten und nächsten Tage (Abwechslung)
      const near = {};
      hist.forEach((e) => { const dd = Math.abs(Math.round((e.d - ds) / 864e5)); if (dd > 0 && dd <= 6) this._cats(e.title).forEach((c) => (near[c] = Math.min(near[c] || 9, dd))); });
      // Tag: Wetter, Termine am Abend, Besuch
      const w = this._wx(ds);
      const kalt = w && (w.temperature <= 8 || /rain|pour|snow|hail/.test(w.condition || ""));
      const heiss = w && w.temperature >= 25;
      const evs = [];
      Object.entries(this._events || {}).forEach(([k, l]) => { if (k !== "essen") this._on(l, ds).forEach((e) => evs.push(e)); });
      const busy = slot === "abend" ? evs.some((e) => !e.allDay && e.start.getHours() * 60 + e.start.getMinutes() >= 16 * 60 + 30 && e.start.getHours() < 21)
        : ds.getDay() >= 1 && ds.getDay() <= 5;
      const besuch = evs.some((e) => /besuch|gäste|\bgast\b|grosi|grossmami|grosspapi|\boma\b|\bopa\b|nonna|party|fest\b/i.test(e.title || ""));
      // Reste: verderbliche Zutaten aus Rezepten rund um diesen Tag
      const rest = new Set();
      hist.forEach((e) => { const dd = Math.round((ds - e.d) / 864e5); if (dd >= 1 && dd <= 2 && e.slug) this._foods(e.slug).forEach((f) => { if (PERISH.test(f)) rest.add(f); }); });
      const persons = this._config.personen.map((p) => p.name);
      const out = [];
      by.forEach((o, k) => {
        if (no.has(k)) return;
        const isFav = fav.has(k);
        const r = o.recipe || (o.slug ? (this._mealieList || []).find((x) => x.slug === o.slug) : null);
        const mins = r ? this._mins(r) : 0;
        const cats = this._cats(o.title, r ? this._tagNames(r) : []);
        const why = [];
        let score = Math.log(1 + o.cnt) + (isFav ? 2.5 : 0);
        if (isFav) why.push("Lieblingsessen");
        if (o.cnt >= 2 && o.dow / o.cnt >= 0.4) { score += 1.5 * (o.dow / o.cnt); why.push(`oft am ${WDL[ds.getDay()]}`); }
        if (o.cnt >= 3) score += 0.8 * (o.slotCnt / o.cnt - 0.5);
        if (o.last) {
          const since = Math.round((ds - o.last) / 864e5);
          if (since < 7) score -= 4; else if (since < 14) score -= 1.5; else { score += Math.min(since, 90) / 90; if (since >= 30) why.push("lange nicht mehr"); }
        }
        if (o.near) score -= 3;
        if (o.sameDay) score -= 6;
        cats.forEach((c) => { if (near[c]) score -= near[c] <= 2 ? 1.2 : 0.5; });
        // Bewertungen
        const avg = this._rateAvg(o.title);
        const vals = persons.map((p) => avg[p]).filter((x) => x !== undefined);
        if (vals.length >= 2 && vals.every((x) => x >= 1.5)) { score += 1.5; why.push("alle mögen's"); }
        else if (vals.length) score += (vals.reduce((a, b) => a + b, 0) / vals.length - 1) * 1.2;
        if (vals.some((x) => x <= 0.5)) score -= 1.2;
        if (busy && mins) { if (mins <= 30) { score += 1; why.push(`schnell (${mins} Min.)`); } else if (mins > 60) score -= 1; }
        if (kalt && cats.some((c) => c === "suppe" || c === "ofen")) { score += 1.2; why.push("passt zum kalten Wetter"); }
        if (heiss && cats.some((c) => c === "salat" || c === "grill")) { score += 1.2; why.push("passt zum warmen Wetter"); }
        if (besuch && (isFav || (vals.length && Math.min(...vals) >= 1.5))) { score += 1; why.push("Besuch"); }
        if (rest.size && o.slug) { const f = this._foods(o.slug).find((x) => rest.has(x)); if (f) { score += 1; why.push(`Rest verwerten: ${f}`); } }
        // Rezepte, die noch nie gekocht wurden, nur über «Neu ausprobieren»
        if (!o.cnt && !isFav && r) return;
        if (!why.length && o.cnt >= 3) why.push("oft gekocht");
        out.push({ title: o.title, score, why: why.slice(0, 2).join(" · "), fav: isFav, cnt: o.cnt, slug: o.slug || "", avg });
      });
      return out.sort((x, y) => y.score - x.score).slice(0, n);
    }
    // Ein Rezept aus Mealie, das ihr noch nie gekocht habt (wechselt jede Woche)
    _newIdea(exclude = []) {
      const cooked = new Set((this._mealHist || []).map((e) => e.title.toLowerCase()));
      const ex = new Set(exclude.map((x) => x.toLowerCase()));
      const list = (this._mealieList || []).filter((r) => !cooked.has(r.name.toLowerCase()) && !ex.has(r.name.toLowerCase()));
      if (!list.length) return null;
      return list[kw(new Date()) % list.length];
    }

    // ---------- Mealie (über die Home-Assistant-Integration) ----------
    async _mealieEntry() {
      if (this._mealieId !== undefined) return this._mealieId;
      try {
        const es = await this._hass.callWS({ type: "config_entries/get", domain: "mealie" });
        const e = (es || []).find((x) => x.state === "loaded") || null;
        this._mealieId = e ? e.entry_id : null;
      } catch (err) { this._mealieId = null; }
      return this._mealieId;
    }
    async _mealie(service, data = {}) {
      const id = await this._mealieEntry();
      if (!id) throw new Error("Mealie ist nicht eingerichtet");
      const r = await this._hass.callWS({ type: "call_service", domain: "mealie", service, service_data: { config_entry_id: id, ...data }, return_response: true });
      return r?.response || {};
    }
    _arr(resp, key) { if (Array.isArray(resp)) return resp; if (Array.isArray(resp?.[key])) return resp[key]; if (Array.isArray(resp?.[key]?.items)) return resp[key].items; if (Array.isArray(resp?.items)) return resp.items; return []; }
    async _loadMealie(force) {
      if (!force && this._mealieT && Date.now() - this._mealieT < 30 * 60000) return;
      this._mealieT = Date.now();
      if (!(await this._mealieEntry())) { this._mealieList = []; return; }
      try {
        const resp = await this._mealie("get_recipes", { result_limit: 500 });
        this._mealieList = this._arr(resp, "recipes").map((r) => this._normRecipe(r)).filter((r) => r.name && r.slug);
      } catch (err) { this._mealieList = this._mealieList || []; }
      this._render();
    }
    _normRecipe(r) {
      return {
        id: r.recipe_id || r.id || "", slug: r.slug || "", name: (r.name || "").trim(), description: r.description || "",
        tags: [...(r.tags || []), ...(r.categories || r.recipe_category || r.recipeCategory || [])].map((t) => (typeof t === "string" ? t : t.name)).filter(Boolean),
        total: r.total_time || r.totalTime || "", totalSec: r.total_time_seconds || r.totalTimeSeconds || 0,
        perform: r.perform_time || r.performTime || "", prep: r.prep_time || r.prepTime || "",
        servings: +(r.recipe_servings || r.recipeServings || r.recipe_yield_quantity || r.recipeYieldQuantity || 0) || 0, yieldTxt: r.recipe_yield || r.recipeYield || "",
        url: r.original_url || r.orgURL || r.originalUrl || "", rating: r.rating || 0,
        ingredients: r.ingredients || r.recipe_ingredient || r.recipeIngredient || null,
        instructions: r.instructions || r.recipe_instructions || r.recipeInstructions || null,
      };
    }
    _tagNames(r) { return r?.tags || []; }
    _mins(r) {
      if (!r) return 0;
      if (r.totalSec) return Math.round(r.totalSec / 60);
      const p = (s) => {
        s = String(s || "").toLowerCase();
        if (!s) return 0;
        const iso = /^p(?:t)?(?:(\d+)h)?(?:(\d+)m)?/.exec(s);
        if (iso && (iso[1] || iso[2])) return (+iso[1] || 0) * 60 + (+iso[2] || 0);
        const hh = /(\d+(?:[.,]\d+)?)\s*(h|std|stunde|hour)/.exec(s), mm = /(\d+)\s*(m|min)/.exec(s);
        return Math.round((hh ? parseFloat(hh[1].replace(",", ".")) * 60 : 0) + (mm ? +mm[1] : 0)) || (/^\d+$/.test(s) ? +s : 0);
      };
      return p(r.total) || p(r.prep) + p(r.perform);
    }
    _mealieUrl() {
      const u = this._essenCfg().mealie_url || this._config.mealie_url || `${location.protocol}//${location.hostname}:9925`;
      return u.replace(/\/$/, "");
    }
    _recipeImg(r, size = "min-original") { return r && r.id ? `${this._mealieUrl()}/api/media/recipes/${r.id}/images/${size}.webp` : ""; }
    async _recipe(slug) {
      this._recipeCache = this._recipeCache || {};
      if (this._recipeCache[slug]) return this._recipeCache[slug];
      const resp = await this._mealie("get_recipe", { recipe_id: slug });
      const r = this._normRecipe(resp.recipe || resp);
      this._recipeCache[slug] = r;
      return r;
    }
    _ingText(i) {
      if (typeof i === "string") return i;
      if (i.display) return i.display;
      if (i.original_text || i.originalText) return i.original_text || i.originalText;
      const q = i.quantity ? `${+(+i.quantity).toFixed(2)} ` : "";
      const u = i.unit ? `${i.unit.abbreviation && i.unit.use_abbreviation ? i.unit.abbreviation : i.unit.name} ` : "";
      return `${q}${u}${i.food?.name || ""}${i.note ? ` ${i.note}` : ""}`.trim();
    }
    _foodName(i) { return (typeof i === "string" ? i.replace(/^[\d.,/\s]+(g|kg|ml|l|dl|el|tl|stk|prise|bund|becher|dose)?\b/i, "") : i.food?.name || i.note || this._ingText(i)).trim().toLowerCase(); }
    _foods(slug) { const r = this._recipeCache?.[slug]; return r && r.ingredients ? r.ingredients.map((i) => this._foodName(i)).filter(Boolean) : []; }
    _scaleText(txt, f) {
      if (f === 1) return txt;
      return txt.replace(/^(\d+(?:[.,]\d+)?)(\s*[-–]\s*(\d+(?:[.,]\d+)?))?/, (m, a, b, c) => { const fmt = (x) => { const v = parseFloat(x.replace(",", ".")) * f; return String(Math.round(v * 10) / 10).replace(".", ","); }; return fmt(a) + (c ? `–${fmt(c)}` : ""); });
    }

    // ---------- Grosse Essens-Ansicht ----------
    _openEssen(tab) {
      this._kidOpen = "__essen__"; this._essTab = tab || this._essTab || "woche";
      this._loadMealie();
      this._renderKid(); this._kidTouch();
    }
    _renderEssen(k) {
      const app0 = this.shadowRoot.querySelector("#app");
      const prevBody = k.querySelector(".setbody");
      const scroll = prevBody ? prevBody.scrollTop : 0;
      k.className = `kidview setview essview ${app0?.classList.contains("dark") ? "dark" : ""}`;
      const tab = this._essTab;
      const hasM = !!this._mealieId;
      const tabs = [["woche", "📅", "Woche"], ["rezepte", "📖", "Rezepte"], ["einkauf", "🛒", "Einkauf"], ["bewertung", "😋", "Was schmeckt"]];
      let body = "";
      const today = sod(new Date());
      if (tab === "woche") {
        const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
        const idea = this._newIdea();
        body = `<div class="esstools"><button class="btn" data-k="e-fill">✨ Woche füllen</button><button class="btn ghost" data-k="e-shopweek">🛒 Zutaten der Woche</button>${idea ? `<button class="btn ghost" data-k="e-recipe" data-slug="${esc(idea.slug)}">✨ Neu ausprobieren: ${esc(idea.name)}</button>` : ""}</div>
          <div class="essweek">${days.map((d) => `<div class="essday ${sameDay(d, today) ? "today" : ""}"><div class="essdh"><b>${sameDay(d, today) ? "Heute" : WDL[d.getDay()]}</b><span>${d.getDate()}. ${MOS[d.getMonth()]}</span></div>
            ${this._slots(d).map((s) => { const m = this._meal(d, s); const slug = this._slugOf(m); const r = slug ? (this._mealieList || []).find((x) => x.slug === slug) : null; const avg = m ? this._rateAvg(m.title) : {};
              return `<button class="essslot ${m ? "" : "empty"}" data-k="e-slot" data-day="${ymd(d)}" data-slot="${s}">
                ${r ? `<span class="essimg"><img src="${esc(this._recipeImg(r))}" alt="" onerror="this.parentNode.remove()"></span>` : ""}
                <span class="esst"><small>${s === "mittag" ? "☀️ Mittagessen" : "🌙 Abendessen"}${r && this._mins(r) ? ` · ${this._mins(r)} Min.` : ""}</small><b>${m ? esc(m.title) : "＋ planen"}</b>${Object.keys(avg).length ? `<span class="essfaces">${Object.entries(avg).map(([p, v]) => `<i title="${esc(p)}">${this._face(v)}</i>`).join("")}</span>` : ""}</span>
                ${m && slug ? `<span class="esscook" data-k="e-cook" data-slug="${esc(slug)}">👩‍🍳</span>` : ""}</button>`; }).join("")}</div>`).join("")}</div>`;
      } else if (tab === "rezepte") {
        if (!hasM) body = this._mealieHelp();
        else {
          const q = (this._essQ || "").toLowerCase();
          const list = (this._mealieList || []).filter((r) => !q || r.name.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q)));
          body = `<div class="esssearch"><input id="fp-essq" type="search" placeholder="Rezept suchen …" value="${esc(this._essQ || "")}" data-k="e-q"><button class="btn ghost" data-k="e-import">＋ Rezept per Link</button></div>
            <div class="essgrid">${list.slice(0, 120).map((r) => `<button class="esscard" data-k="e-recipe" data-slug="${esc(r.slug)}"><span class="essimg big"><img src="${esc(this._recipeImg(r))}" alt="" loading="lazy" onerror="this.style.display='none'"></span><b>${esc(r.name)}</b><small>${this._mins(r) ? `⏱ ${this._mins(r)} Min.` : ""}${r.tags.length ? ` · ${esc(r.tags.slice(0, 2).join(", "))}` : ""}</small></button>`).join("") || `<p class="sethint">${q ? "Nichts gefunden." : "Noch keine Rezepte in Mealie. Mit «＋ Rezept per Link» das erste hinzufügen."}</p>`}</div>`;
        }
      } else if (tab === "einkauf") {
        const lists = this._bringLists();
        body = `<div class="setcard col"><b>🛒 Zutaten auf die Einkaufsliste</b><span class="sethint">Sammelt die Zutaten aller geplanten Essen mit Rezept der nächsten 7 Tage. Du wählst danach aus, was wirklich fehlt.</span>
            ${lists.length > 1 ? `<div class="seg big">${lists.map((id) => `<button class="${this._bringTarget() === id ? "on" : ""}" data-k="e-bring" data-v="${esc(id)}">${esc(this._hass.states[id]?.attributes.friendly_name || id)}</button>`).join("")}</div>` : ""}
            <button class="btn" data-k="e-shopweek">Zutaten der Woche sammeln</button></div>
          ${hasM ? "" : this._mealieHelp()}`;
      } else {
        const names = this._config.personen.map((p) => p.name);
        const rated = (this._todos[this._bildListe()] || []).filter((i) => /^Essen ★ /.test(i.summary || "")).map((i) => { const t = i.summary.slice(8); const avg = this._rateAvg(t); const vals = Object.values(avg); return { t, avg, m: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 }; }).sort((a, b) => b.m - a.m);
        body = rated.length ? `<div class="essrank">${rated.map((x, i) => `<div class="setrow"><span class="essno">${i + 1}</span><div class="settxt"><b>${esc(x.t)}</b><span>${this._cats(x.t).map((c) => this._catLabel(c)).join(" · ")}</span></div><span class="essfaces big">${names.filter((p) => x.avg[p] !== undefined).map((p) => `<span><i>${this._face(x.avg[p])}</i><small>${esc(p)}</small></span>`).join("")}</span></div>`).join("")}</div>`
          : `<p class="sethint">Noch keine Bewertungen. Nach dem Essen erscheint im Planer «Wie war's?», und alle tippen auf 😋, 😐 oder 🤢. Daraus lernt der Planer, was allen schmeckt.</p>`;
      }
      k.innerHTML = `<div class="kwrap setwrap">
        <header class="khead"><div class="kname">🍽️ Essen</div><button class="kbtn close" data-k="close" aria-label="Schliessen">✕</button></header>
        <div class="setmain">
          <nav class="setnav">${tabs.map(([t, ic, name]) => `<button class="${t === tab ? "on" : ""}" data-k="e-tab" data-v="${t}"><span>${ic}</span>${name}</button>`).join("")}</nav>
          <div class="setbody">${body}</div>
        </div></div>`;
      const nb = k.querySelector(".setbody");
      if (nb && scroll) nb.scrollTop = scroll;
      const q = k.querySelector("#fp-essq");
      if (q) { q.addEventListener("input", () => { this._essQ = q.value; clearTimeout(this._essQT); this._essQT = setTimeout(() => { const pos = q.selectionStart; this._renderKid(); const q2 = this.shadowRoot.querySelector("#fp-essq"); if (q2) { q2.focus(); q2.setSelectionRange(pos, pos); } }, 350); }); }
    }
    _mealieHelp() {
      return `<div class="setcard col"><b>📖 Rezepte mit Mealie</b>
        <span class="sethint">Mealie läuft bei euch als Add-on in Home Assistant und speichert Rezepte. Rezepte von Swissmilk, Fooby, Migusto, Chefkoch und vielen anderen Seiten lassen sich per Link übernehmen.</span>
        <ol class="esshelp"><li>In der Seitenleiste von Home Assistant «Mealie» öffnen und das Konto einrichten.</li><li>In Mealie: Profil → «API-Tokens» → neues Token erstellen und kopieren.</li><li>In Home Assistant: Einstellungen → Geräte &amp; Dienste → «Mealie» (wird meist als «Entdeckt» angezeigt) → Token einfügen.</li><li>Den Planer neu laden.</li></ol></div>`;
    }
    _bringTarget() { const lists = this._bringLists(); const c = this._essenCfg().bring; return lists.includes(c) ? c : lists.includes(this._shopList) ? this._shopList : lists[0]; }
    async _essenClick(el) {
      const k = el.dataset.k;
      switch (k) {
        case "e-tab": this._essTab = el.dataset.v; return this._renderKid();
        case "e-slot": return this._openMeal(parseYmd(el.dataset.day), el.dataset.slot);
        case "e-fill": return this._openFillWeek();
        case "e-recipe": return this._openRecipe(el.dataset.slug);
        case "e-cook": return this._openCook(el.dataset.slug);
        case "e-import": return this._openImport();
        case "e-shopweek": return this._openShop();
        case "e-bring": await this._saveEssenCfg({ bring: el.dataset.v }); return this._renderKid();
      }
    }
    // Rezept ansehen: kochen, planen, Zutaten einkaufen
    async _openRecipe(slug) {
      if (!slug) return;
      this._mh = {}; this._modal(`<div class="dlg-b center"><p class="hint2">Rezept wird geladen …</p></div>`);
      let r;
      try { r = await this._recipe(slug); } catch (err) { this._modal(`<div class="dlg-b"><p>Rezept konnte nicht geladen werden: ${esc(err.message || err)}</p></div><div class="dlg-f"><span class="sp"></span><button class="btn" data-m="close">OK</button></div>`); return; }
      const ings = (r.ingredients || []).map((i) => this._ingText(i)).filter(Boolean);
      this._mh = {
        cook: () => { this._modal(""); this._openCook(slug); },
        plan: () => this._openPlanRecipe(r),
        shop: () => this._openShop([r]),
      };
      this._modal(`<div class="dlg-h"><ha-icon icon="mdi:book-open-variant"></ha-icon><h2>${esc(r.name)}</h2></div>
        <div class="dlg-b"><div class="recipehead"><span class="essimg big"><img src="${esc(this._recipeImg(r, "original"))}" alt="" onerror="this.style.display='none'"></span>
          <div><p class="hint2">${this._mins(r) ? `⏱ ${this._mins(r)} Min. · ` : ""}${r.yieldTxt || (r.servings ? `${r.servings} Portionen` : "")}</p>${r.description ? `<p>${esc(r.description)}</p>` : ""}
          ${r.tags.length ? `<p class="hint2">${esc(r.tags.join(", "))}</p>` : ""}</div></div>
          <div class="sect">Zutaten</div><ul class="ingl">${ings.map((t) => `<li>${esc(t)}</li>`).join("") || "<li>–</li>"}</ul></div>
        <div class="dlg-f"><button class="btn ghost" data-m="shop">🛒 Zutaten</button><button class="btn ghost" data-m="plan">📅 Planen</button><span class="sp"></span><button class="btn ghost" data-m="close">Schliessen</button><button class="btn" data-m="cook">👩‍🍳 Kochen</button></div>`);
      this.shadowRoot.querySelector("#modal .dlg")?.classList.add("wide");
    }
    _openPlanRecipe(r) {
      const today = sod(new Date());
      const opts = [];
      for (let i = 0; i < 14; i++) { const d = addDays(today, i); this._slots(d).forEach((s) => opts.push({ d, s, cur: this._meal(d, s) })); }
      this._mh = {
        pick: async (el) => { const o = opts[+el.dataset.i]; this._modal(""); await this._saveMeal(o.d, o.s, r.name, r.slug, o.cur); },
      };
      this._modal(`<div class="dlg-h"><ha-icon icon="mdi:calendar-plus"></ha-icon><h2>«${esc(r.name)}» planen</h2></div>
        <div class="dlg-b"><div class="planpick">${opts.map((o, i) => `<button class="${o.cur ? "taken" : ""}" data-m="pick" data-i="${i}"><b>${WD[o.d.getDay()]} ${o.d.getDate()}.${o.d.getMonth() + 1}.</b><span>${o.s === "mittag" ? "☀️ Mittagessen" : "🌙 Abendessen"}</span><small>${o.cur ? esc(o.cur.title) : "frei"}</small></button>`).join("")}</div></div>
        <div class="dlg-f"><span class="sp"></span><button class="btn ghost" data-m="close">Abbrechen</button></div>`);
      this.shadowRoot.querySelector("#modal .dlg")?.classList.add("wide");
    }
    _openImport() {
      this._mh = {
        go: async () => {
          const url = this.shadowRoot.querySelector("#fp-url").value.trim();
          const f = this.shadowRoot.querySelector("#modal .flash");
          if (!/^https?:\/\/\S+\.\S+/.test(url)) { f.textContent = "Bitte einen Link einfügen (beginnt mit https://)."; return; }
          f.textContent = "Rezept wird übernommen …";
          try {
            const resp = await this._mealie("import_recipe", { url, include_tags: true });
            const r = this._normRecipe(resp.recipe || resp);
            await this._loadMealie(true);
            this._modal("");
            if (r.slug) this._openRecipe(r.slug);
          } catch (err) { f.textContent = `Hat nicht geklappt: ${err.message || err.code || err}`; }
        },
      };
      this._modal(`<div class="dlg-h"><ha-icon icon="mdi:link-variant-plus"></ha-icon><h2>Rezept per Link</h2></div>
        <div class="dlg-b"><label class="kw">Link zum Rezept<input id="fp-url" type="url" autofocus placeholder="https://www.swissmilk.ch/de/rezepte-kochideen/…"></label>
          <p class="hint2">Funktioniert mit den meisten Rezeptseiten (z. B. Swissmilk, Fooby, Migusto, Chefkoch). Mealie übernimmt Zutaten, Schritte, Foto und Kochzeit.</p><div class="flash"></div></div>
        <div class="dlg-f"><span class="sp"></span><button class="btn ghost" data-m="close">Abbrechen</button><button class="btn" data-m="go">Übernehmen</button></div>`);
    }
    // Zutaten sammeln (Rezepte der nächsten 7 Tage oder ein einzelnes Rezept) und auf Bring! setzen
    async _openShop(recipes) {
      const target = this._bringTarget();
      if (!target) { this._openConfirm("Es ist keine Einkaufsliste (Bring!) verbunden.", "OK", async () => {}); return; }
      this._mh = {}; this._modal(`<div class="dlg-b center"><p class="hint2">Zutaten werden gesammelt …</p></div>`);
      let list = recipes;
      if (!list) {
        list = [];
        const today = sod(new Date());
        for (let i = 0; i < 7; i++) { const d = addDays(today, i); for (const s of this._slots(d)) { const m = this._meal(d, s); const slug = this._slugOf(m); if (slug) { try { list.push(await this._recipe(slug)); } catch (e) { /* weiter */ } } } }
      }
      const f = this._essenCfg().portionen;
      const items = new Map();
      list.forEach((r) => {
        const factor = r.servings ? f / r.servings : 1;
        (r.ingredients || []).forEach((i) => {
          const name = typeof i === "string" ? this._foodName(i) : (i.food?.name || i.note || "").trim();
          if (!name) return;
          const key = name.toLowerCase();
          const qty = typeof i === "string" ? "" : i.quantity ? `${String(Math.round(i.quantity * factor * 10) / 10).replace(".", ",")}${i.unit ? " " + (i.unit.abbreviation || i.unit.name) : ""}` : "";
          const o = items.get(key) || { name: name[0].toUpperCase() + name.slice(1), qty: [], from: new Set() };
          if (qty) o.qty.push(qty);
          o.from.add(r.name);
          items.set(key, o);
        });
      });
      const all = [...items.values()].sort((a, b) => a.name.localeCompare(b.name));
      if (!all.length) { this._modal(`<div class="dlg-b"><p>${recipes ? "Dieses Rezept hat keine Zutatenliste." : "In den nächsten 7 Tagen ist kein Essen mit Rezept geplant. Wähle beim Essen ein Rezept aus Mealie, dann klappt es."}</p></div><div class="dlg-f"><span class="sp"></span><button class="btn" data-m="close">OK</button></div>`); return; }
      const have = new Set(((this._todos[target] || []).filter((i) => i.status !== "completed")).map((i) => (i.summary || "").toLowerCase()));
      this._mh = {
        go: async () => {
          const sel = [...this.shadowRoot.querySelectorAll("#modal .shoppick input:checked")].map((x) => all[+x.value]);
          for (const o of sel) { try { await this._hass.callService("todo", "add_item", { item: o.name, ...(o.qty.length ? { description: o.qty.join(" + ") } : {}) }, { entity_id: target }); } catch (e) { /* weiter */ } }
          this._loadTodo(target);
          this._modal(""); this._flashMain(`${sel.length} Zutaten auf «${this._hass.states[target]?.attributes.friendly_name || "Einkauf"}»`);
        },
      };
      this._modal(`<div class="dlg-h"><ha-icon icon="mdi:cart-plus"></ha-icon><h2>Was fehlt?</h2></div>
        <div class="dlg-b"><p class="hint2">Für ${f} Portionen${list.length > 1 ? ` · ${list.length} Rezepte` : ` · ${esc(list[0].name)}`}. Häkchen weg bei allem, was ihr schon habt.</p>
          <div class="shoppick">${all.map((o, i) => `<label class="${have.has(o.name.toLowerCase()) ? "have" : ""}"><input type="checkbox" value="${i}" ${have.has(o.name.toLowerCase()) || BASICS.test(o.name) ? "" : "checked"}><span><b>${esc(o.name)}</b>${o.qty.length ? ` <small>${esc(o.qty.join(" + "))}</small>` : ""}${have.has(o.name.toLowerCase()) ? ` <small>· schon auf der Liste</small>` : ""}</span></label>`).join("")}</div></div>
        <div class="dlg-f"><span class="sp"></span><button class="btn ghost" data-m="close">Abbrechen</button><button class="btn" data-m="go">Auf die Einkaufsliste</button></div>`);
      this.shadowRoot.querySelector("#modal .dlg")?.classList.add("wide");
    }
    _flashMain(t) { this._msg = t; this._render(); clearTimeout(this._msgT); this._msgT = setTimeout(() => { this._msg = ""; this._render(); }, 4000); }

    // ---------- Kochmodus ----------
    async _openCook(slug) {
      let r;
      try { r = await this._recipe(slug); } catch (err) { this._openConfirm(`Rezept konnte nicht geladen werden: ${err.message || err}`, "OK", async () => {}); return; }
      this._modal("");
      this._cook = { r, step: 0, por: this._essenCfg().portionen, done: new Set(), timers: this._cook?.timers || [] };
      this._kidOpen = "__kochen__"; clearTimeout(this._kidT);
      this._renderKid();
    }
    _renderCook(k) {
      const app0 = this.shadowRoot.querySelector("#app");
      k.className = `kidview setview cookview ${app0?.classList.contains("dark") ? "dark" : ""}`;
      const c = this._cook, r = c.r;
      const steps = (r.instructions || []).map((s) => (typeof s === "string" ? { text: s } : s)).filter((s) => (s.text || "").trim());
      c.step = Math.max(0, Math.min(c.step, Math.max(0, steps.length - 1)));
      const f = r.servings ? c.por / r.servings : 1;
      const st = steps[c.step];
      const tm = [...String(st?.text || "").matchAll(/(\d+)(?:\s*[-–]\s*(\d+))?\s*(Minuten|Minute|Min\.?|min|Stunden|Stunde|Std\.?)/gi)].map((m) => ({ min: (+(m[2] || m[1])) * (/^(stund|std)/i.test(m[3]) ? 60 : 1), label: m[0] }));
      k.innerHTML = `<div class="kwrap setwrap">
        <header class="khead"><div class="kname">👩‍🍳 ${esc(r.name)}</div>${c.timers.map((t, i) => `<span class="cooktimer ${t.end - Date.now() <= 0 ? "ring" : ""}" data-k="c-tstop" data-i="${i}">⏱ <b data-end="${t.end}">${this._tleft(t.end)}</b></span>`).join("")}<button class="kbtn close" data-k="close" aria-label="Schliessen">✕</button></header>
        <div class="cookmain">
          <aside class="cooking"><div class="cookpor"><button class="kbtn" data-k="c-por" data-d="-1">−</button><b>${c.por} Portionen</b><button class="kbtn" data-k="c-por" data-d="1">＋</button></div>
            <ul>${(r.ingredients || []).map((i, n) => `<li class="${c.done.has(n) ? "done" : ""}" data-k="c-ing" data-i="${n}">${esc(this._scaleText(this._ingText(i), f))}</li>`).join("") || "<li>–</li>"}</ul></aside>
          <section class="cookstep">${steps.length ? `<div class="cookn">Schritt ${c.step + 1} von ${steps.length}${st.title ? ` · ${esc(st.title)}` : ""}</div>
            <p class="cooktext">${esc(st.text)}</p>
            <div class="cooktm">${tm.map((t) => `<button class="btn ghost" data-k="c-timer" data-min="${t.min}">⏱ ${esc(t.label)} starten</button>`).join("")}</div>
            <div class="cooknav"><button class="btn ghost big" data-k="c-step" data-d="-1" ${c.step === 0 ? "disabled" : ""}>← Zurück</button><button class="btn big" data-k="${c.step + 1 >= steps.length ? "close" : "c-step"}" data-d="1">${c.step + 1 >= steps.length ? "Fertig 🎉" : "Weiter →"}</button></div>`
            : `<p class="cooktext">Dieses Rezept hat keine Schritte.${r.url ? ` Original: ${esc(r.url)}` : ""}</p>`}</section>
        </div></div>`;
      clearInterval(this._cookT);
      if (c.timers.length) this._cookT = setInterval(() => this._cookTick(), 1000);
    }
    _tleft(end) { const s = Math.max(0, Math.round((end - Date.now()) / 1000)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; }
    _cookTick() {
      if (this._kidOpen !== "__kochen__") { clearInterval(this._cookT); return; }
      this.shadowRoot.querySelectorAll(".cooktimer b").forEach((b) => {
        const end = +b.dataset.end; b.textContent = this._tleft(end);
        if (end - Date.now() <= 0 && !b.parentNode.classList.contains("ring")) { b.parentNode.classList.add("ring"); this._jingle(); }
      });
    }
    async _cookClick(el) {
      const c = this._cook; if (!c) return;
      switch (el.dataset.k) {
        case "c-step": c.step += +el.dataset.d; break;
        case "c-por": c.por = Math.max(1, Math.min(30, c.por + +el.dataset.d)); break;
        case "c-ing": { const n = +el.dataset.i; c.done.has(n) ? c.done.delete(n) : c.done.add(n); break; }
        case "c-timer": c.timers.push({ end: Date.now() + +el.dataset.min * 60000 }); break;
        case "c-tstop": c.timers.splice(+el.dataset.i, 1); break;
        default: return;
      }
      this._renderKid();
    }

    // ================= Einstellungen =================
    _openSettings() {
      const open = () => { this._kidOpen = "__settings__"; this._setTab = this._setTab || "familie"; this._renderKid(); this._kidTouch(); };
      if (this._kidSettings().pin) this._parent("Einstellungen öffnen", open); else open();
    }
    _calNames(p) {
      return this._cals(p.kalender).map((id) => this._hass.states[id]?.attributes?.friendly_name || id).join(", ");
    }
    _renderSettings(k) {
      const app0 = this.shadowRoot.querySelector("#app");
      const prevBody = k.querySelector(".setbody");
      const scroll = prevBody ? prevBody.scrollTop : 0;
      k.className = `kidview setview ${app0?.classList.contains("dark") ? "dark" : ""}`;
      const tab = this._setTab;
      const tabs = [["familie", "👨‍👩‍👧", "Familie"], ["kinder", "⭐", "Kinder & Sterne"], ["bilder", "🖼️", "Bilder"], ["essen", "🍝", "Essen"], ["bald", "⏳", "Bald"], ["anzeige", "🎨", "Anzeige"]]
        .filter(([t]) => t !== "kinder" || this._kids().length);
      const liste = this._bildListe();
      const items = this._todos[liste] || [];
      const noList = !liste ? `<p class="sethint">Für diese Einstellungen braucht es die Liste «Planer Bilder». Oben auf «Jetzt anlegen» tippen.</p>` : "";
      let body = "";
      if (tab === "familie") {
        body = `<div class="setlist">${this._config.personen.map((p) => {
          const hid = this._hidden.has(p.name);
          const cal = this._calNames(p);
          return `<div class="setrow ${hid ? "off" : ""}">
            ${this._kidAvatar(p, 56)}
            <div class="settxt"><b>${esc(p.name)}</b><span>${cal ? `📅 ${esc(cal)}` : "Kein Kalender"}${p.bilder === false ? " · ohne Bilder" : ""}${hid ? " · ausgeblendet" : ""}</span></div>
            <button class="btn ghost" data-k="s-bday" data-name="${esc(p.name)}">🎂 ${this._bdayDate(p) ? `${this._bdayDate(p).d}.${this._bdayDate(p).m}.` : "Geburtstag"}</button>
            <button class="btn ghost" data-k="s-photo" data-name="${esc(p.name)}">Foto &amp; Farbe</button>
            <button class="btn ghost" data-k="s-person" data-name="${esc(p.name)}">${p.extra ? "Name &amp; Kalender" : "Kalender"}</button>
            <button class="btn ghost" data-k="s-hide" data-name="${esc(p.name)}">${hid ? "Einblenden" : "Ausblenden"}</button>
            ${p.extra ? `<button class="setdel" data-k="s-del" data-name="${esc(p.name)}" aria-label="${esc(p.name)} entfernen">🗑</button>` : `<span class="setdel ph"></span>`}
          </div>`;
        }).join("")}</div>
        ${this._config.personen_hinzufuegen === false ? "" : `<button class="btn setadd" data-k="s-add">＋ Familienmitglied hinzufügen</button>`}
        <p class="sethint">Ausblenden gilt nur für dieses Gerät. Fest eingerichtete Personen (aus der Konfiguration) lassen sich nicht löschen, ihre Kalender aber hier ändern.</p>`;
      } else if (tab === "kinder") {
        const st = this._kidSettings();
        body = `<div class="setlist">${this._kids().map((p) => {
          const d = this._kid(p);
          return `<div class="setrow">${this._kidAvatar(p, 56)}
            <div class="settxt"><b>${esc(p.name)}</b><span>${this._stars(p)} ★ · ${d.aufgaben.length} Tagesaufgaben · ${d.ziele.length} grosse Ziele</span></div>
            <button class="btn ghost" data-k="s-kid" data-name="${esc(p.name)}">Aufgaben &amp; Ziele</button>
            <button class="btn ghost" data-k="s-reward" data-name="${esc(p.name)}">Belohnung</button>
            <button class="btn ghost" data-k="s-stars0" data-name="${esc(p.name)}">Sterne auf 0</button>
          </div>`;
        }).join("")}</div>
        <div class="setcard"><b>Für alle Kinder</b>
          <span>${st.bestaetigen ? "✓ Sterne erst nach Bestätigung durch Eltern" : "Sterne zählen sofort"} · ${st.pin ? "🔒 Eltern-Code aktiv" : "kein Eltern-Code"} · ${st.ton ? "🔔 Ton an" : "🔕 Ton aus"}</span>
          <button class="btn ghost" data-k="s-kidopt">Ändern</button></div>`;
      } else if (tab === "bilder") {
        const it = this._bilderItems();
        body = `<p class="sethint">Ein Termin bekommt das Bild des ersten Themas, dessen Stichwort im Titel vorkommt. Antippen, um ein Bild zu ändern.</p>
          <div class="blist">${it.map((x, i) => `<button class="bitem" data-k="s-bild" data-i="${i}">${this._bildHtml(x.val, "bthumb")}<span class="bt"><b>${esc(x.name)}</b><span>${esc(x.keys)}</span></span>${x.changed ? `<span class="bchg">geändert</span>` : ""}</button>`).join("")}</div>
          <button class="btn setadd" data-k="s-bildneu">＋ Neues Thema</button>`;
      } else if (tab === "essen") {
        const fav = items.filter((i) => /^Essen ♥ /.test(i.summary || "")).sort((a, b) => a.summary.localeCompare(b.summary));
        const no = items.filter((i) => /^Essen ✗ /.test(i.summary || "")).sort((a, b) => a.summary.localeCompare(b.summary));
        const chip = (i, k2) => `<span class="setchip">${esc(i.summary.slice(8))}<button data-k="${k2}" data-uid="${esc(i.uid)}" aria-label="Entfernen">✕</button></span>`;
        const ec = this._essenCfg();
        body = `${noList}<div class="setcard col"><b>🍽️ Mahlzeiten</b>
            <div class="seg big">${[["immer", "Mittag und Abend"], ["wochenende", "Mittag nur am Wochenende"], ["abend", "Nur Abendessen"]].map(([v, t]) => `<button class="${ec.mahlzeiten === v ? "on" : ""}" data-k="s-mz" data-v="${v}">${t}</button>`).join("")}</div>
            <div class="settimes"><span>Portionen für Rezepte und Einkauf</span><button class="btn ghost" data-k="s-por" data-d="-1">−</button><b>${ec.portionen}</b><button class="btn ghost" data-k="s-por" data-d="1">＋</button></div>
            <button class="btn ghost" data-k="s-essen">🍽️ Essens-Ansicht öffnen</button></div>
          <div class="setcard col"><b>📖 Rezepte (Mealie)</b>
            <span class="sethint">${this._mealieId ? `Verbunden · ${(this._mealieList || []).length} Rezepte` : "Noch nicht verbunden."}</span>
            ${this._mealieId ? `<div class="settimes"><label>Adresse für Fotos <input type="text" data-k="s-murl" value="${esc(ec.mealie_url || this._mealieUrl())}"></label></div>` : this._mealieHelp()}</div>
          <div class="setcard col"><b>♥ Lieblingsessen</b><div class="setchips">${fav.map((i) => chip(i, "s-rm")).join("") || `<span class="sethint">Noch keine. Im Essen-Fenster auf das Herz tippen.</span>`}</div></div>
          <div class="setcard col"><b>Nicht mehr vorschlagen</b><div class="setchips">${no.map((i) => chip(i, "s-rm")).join("") || `<span class="sethint">Keine. ✕ antippen holt ein Essen zurück in die Vorschläge.</span>`}</div></div>`;
      } else if (tab === "bald") {
        const hid = items.filter((i) => /^Ausgeblendet: /.test(i.summary || ""));
        const cd = this._findByName("todo", this._config.countdowns);
        const cds = (this._todos[cd] || []).filter((i) => i.status !== "completed");
        body = `<div class="setcard col"><b>🎉 Countdowns</b><div class="setchips">${cds.map((i) => `<span class="setchip">${esc(i.summary)}${i.due ? ` <small>${esc(i.due.slice(8, 10) + "." + i.due.slice(5, 7) + ".")}</small>` : ""}<button data-k="s-cdrm" data-uid="${esc(i.uid)}" aria-label="Entfernen">✕</button></span>`).join("") || `<span class="sethint">Keine eigenen Countdowns.</span>`}</div>
            ${cd ? `<button class="btn ghost" data-k="s-cdadd">＋ Countdown</button>` : ""}</div>
          <div class="setcard col"><b>Bei «Bald» ausgeblendet</b><div class="setchips">${hid.map((i) => `<span class="setchip">${esc(i.summary.slice(14).split("|")[0])} <small>${esc((i.summary.split("|")[1] || "").slice(0, 10))}</small><button data-k="s-rm" data-uid="${esc(i.uid)}" aria-label="Wieder zeigen">↺</button></span>`).join("") || `<span class="sethint">Nichts ausgeblendet. In der grossen «Bald»-Ansicht einen Eintrag antippen, um ihn auszublenden.</span>`}</div></div>`;
      } else {
        const dk = lsGet("fp-dunkel", "");
        const nc = this._nightCfg();
        const seg = (k2, cur, opts) => `<div class="seg big">${opts.map(([v, t]) => `<button class="${cur === v ? "on" : ""}" data-k="${k2}" data-v="${v}">${t}</button>`).join("")}</div>`;
        body = `<div class="setcard col"><b>Ausrichtung</b>${seg("s-orient", this._orient, [["auto", "Automatisch"], ["hoch", "Hochformat"], ["quer", "Querformat"]])}</div>
          <div class="setcard col"><b>Dunkles Design</b>${seg("s-dark", dk, [["", `Wie Karte (${esc(String(this._config.dunkel || "auto"))})`], ["auto", "Wie Home Assistant"], ["sonne", "Nach Sonnenuntergang"], ["hell", "Immer hell"], ["dunkel", "Immer dunkel"]])}</div>
          <div class="setcard col"><b>🌙 Nachtmodus</b>
            ${seg("s-nmode", nc.modus, [["aus", "Aus"], ["uhr", "Grosse Uhr"], ["fotos", "Fotos"]])}
            ${nc.modus !== "aus" ? `<div class="settimes"><label>Von <input type="time" data-k="s-nvon" value="${nc.von}"></label><label>Bis <input type="time" data-k="s-nbis" value="${nc.bis}"></label></div>` : ""}
            ${nc.modus === "fotos" ? `<div class="settimes"><span>📁 ${esc(nc.ordnerName || "Alle Medien")}</span><button class="btn ghost" data-k="s-nfolder">Ordner wählen</button></div>` : ""}
            <span class="sethint">${nc.modus === "aus" ? "Nachts zeigt der Planer statt dem Kalender eine ruhige, dunkle Uhr oder eure Familienfotos." : "Antippen zeigt den Planer für 2 Minuten."}</span>
            ${nc.modus !== "aus" ? `<button class="btn ghost" data-k="s-ntest">Jetzt ansehen</button>` : ""}</div>
          <p class="sethint">Diese Einstellungen gelten nur für dieses Gerät. Familienplaner ${VERSION}.</p>`;
      }
      k.innerHTML = `<div class="kwrap setwrap">
        <header class="khead"><div class="kname">⚙️ Einstellungen</div><button class="kbtn close" data-k="close" aria-label="Schliessen">✕</button></header>
        <div class="setmain">
          <nav class="setnav">${tabs.map(([t, ic, name]) => `<button class="${t === tab ? "on" : ""}" data-k="s-tab" data-v="${t}"><span>${ic}</span>${name}</button>`).join("")}</nav>
          <div class="setbody">${body}</div>
        </div></div>`;
      const nb = k.querySelector(".setbody");
      if (nb && scroll) nb.scrollTop = scroll;
    }
    async _settingsClick(el) {
      const k = el.dataset.k, h = this._hass, liste = this._bildListe();
      const person = () => this._config.personen.find((x) => x.name === el.dataset.name);
      const need = () => { if (!liste) { this._openConfirm("Dafür braucht es die Liste «Planer Bilder». Oben auf «Jetzt anlegen» tippen.", "OK", async () => {}); return false; } return true; };
      switch (k) {
        case "s-tab": this._setTab = el.dataset.v; return this._renderKid();
        case "s-photo": { const p = person(); if (p) this._openPhoto(p); return; }
        case "s-bday": { const p = person(); if (p && need()) this._openBday(p); return; }
        case "s-mz": if (need()) await this._saveEssenCfg({ mahlzeiten: el.dataset.v }); this._render(); return;
        case "s-por": if (need()) await this._saveEssenCfg({ portionen: Math.max(1, Math.min(20, this._essenCfg().portionen + +el.dataset.d)) }); return;
        case "s-essen": return this._openEssen();
        case "s-nmode": this._setNightCfg({ modus: el.dataset.v }); return this._renderKid();
        case "s-nfolder": return this._openFolderPick();
        case "s-ntest": this._closeKid(); this._nightForce = true; this._nightSnooze = 0; return this._nightCheck();
        case "s-person": { const p = person(); if (p && need()) this._openPerson(p); return; }
        case "s-add": if (need()) this._openPerson(null); return;
        case "s-hide": { const n = el.dataset.name; this._hidden.has(n) ? this._hidden.delete(n) : this._hidden.add(n); lsSet("fp-hidden", JSON.stringify([...this._hidden])); this._render(); return; }
        case "s-del": {
          const p = person(); if (!p || !p.uid) return;
          return this._openConfirm(`${p.name} aus dem Planer entfernen? Die Kalender selbst bleiben unverändert.`, "Entfernen", async () => {
            await h.callService("todo", "remove_item", { item: p.uid }, { entity_id: liste });
            const foto = (this._todos[liste] || []).find((i) => i.summary === `Foto ${p.name}`);
            if (foto) await h.callService("todo", "remove_item", { item: foto.uid }, { entity_id: liste });
            await this._loadTodo(liste);
          });
        }
        case "s-kid": { const p = person(); if (p && need()) { this._kidSetTab = "tages"; this._openKidSettings(p); } return; }
        case "s-kidopt": { const p = this._kids()[0]; if (p && need()) { this._kidSetTab = "opt"; this._openKidSettings(p); } return; }
        case "s-reward": { const p = person(); if (p && need()) this._openReward(p); return; }
        case "s-stars0": { const p = person(); if (p) this._openConfirm(`Sterne von ${p.name} auf 0 setzen?`, "Auf 0 setzen", () => h.callService("counter", "reset", { entity_id: p.sterne })); return; }
        case "s-bild": { const it = this._bilderItems()[+el.dataset.i]; if (it) this._openBildKey(it.name, it.key); return; }
        case "s-bildneu": this._openBildKey("Neues Thema", ""); return;
        case "s-rm": if (liste && el.dataset.uid) { await h.callService("todo", "remove_item", { item: el.dataset.uid }, { entity_id: liste }); await this._loadTodo(liste); } return;
        case "s-cdrm": { const cd = this._findByName("todo", this._config.countdowns); if (cd) { await h.callService("todo", "remove_item", { item: el.dataset.uid }, { entity_id: cd }); await this._loadTodo(cd); } return; }
        case "s-cdadd": this._openCountdown(); return;
        case "s-orient": this._orient = el.dataset.v; lsSet("fp-orient", this._orient); this._render(); return;
        case "s-dark": lsSet("fp-dunkel", el.dataset.v); this._render(); return;
      }
    }

    _openRewards() {
      const ks = this._kids();
      if (ks.length === 1) return this._openKid(ks[0]);
      if (!this._bildListe()) { this._openConfirm("Dafür braucht es die Liste «Planer Bilder». Oben auf «Jetzt anlegen» tippen.", "OK", async () => {}); return; }
      this._kidOpen = "__menu__"; this._renderKid(); this._kidTouch();
    }
    _openKid(p) {
      if (!this._bildListe()) { this._openConfirm("Dafür braucht es die Liste «Planer Bilder». Oben auf «Jetzt anlegen» tippen.", "OK", async () => {}); return; }
      this._kidOpen = p.name; this._kidTab = "heute";
      this._renderKid(); this._kidTouch();
    }
    _closeKid() { this._kidOpen = null; clearTimeout(this._kidT); const k = this.shadowRoot.querySelector("#kid"); if (k) { k.className = ""; k.innerHTML = ""; } }
    _kidTouch() { clearTimeout(this._kidT); if (this._kidOpen === "__kochen__") return; this._kidT = setTimeout(() => { if (!this.shadowRoot.querySelector("#modal .dlg")) this._closeKid(); else this._kidTouch(); }, this._kidOpen === "__settings__" ? 120000 : this._kidOpen === "__essen__" ? 300000 : 30000); }
    _jar(n, ziel, uid = "main") {
      const r = Math.max(0, Math.min(1, n / Math.max(1, ziel)));
      const top = 40, bottom = 196, hgt = (bottom - top) * r;
      return `<svg class="jar" viewBox="0 0 160 210" aria-label="${n} von ${ziel} Sternen">
        <defs><clipPath id="jarclip-${uid}"><path d="M40 30 h80 v14 c22 10 30 28 30 50 v86 c0 14 -10 24 -24 24 h-92 c-14 0 -24 -10 -24 -24 v-86 c0 -22 8 -40 30 -50 z"/></clipPath>
          <linearGradient id="jarfill-${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd84d"/><stop offset="1" stop-color="#f2a900"/></linearGradient></defs>
        <g clip-path="url(#jarclip-${uid})"><rect x="0" y="0" width="160" height="210" fill="var(--jarbg)"/>
          <rect x="0" y="${bottom - hgt + 8}" width="160" height="${hgt + 10}" fill="url(#jarfill-${uid})"/>
          ${Array.from({ length: Math.min(n, 30) }, (_, k) => { const x = 22 + ((k * 37) % 116), y = bottom - 10 - ((k * 23) % Math.max(12, hgt - 14)); return y > bottom - hgt + 10 ? `<text x="${x}" y="${y}" font-size="16" fill="#fff8d6">★</text>` : ""; }).join("")}</g>
        <path d="M40 30 h80 v14 c22 10 30 28 30 50 v86 c0 14 -10 24 -24 24 h-92 c-14 0 -24 -10 -24 -24 v-86 c0 -22 8 -40 30 -50 z" fill="none" stroke="var(--jarline)" stroke-width="5"/>
        <rect x="34" y="16" width="92" height="18" rx="6" fill="var(--jarlid)"/>
      </svg>`;
    }
    _renderKid() {
      const k = this.shadowRoot.querySelector("#kid");
      if (k && this._kidOpen === "__bald__") return this._renderSoonBig(k);
      if (k && this._kidOpen === "__settings__") return this._renderSettings(k);
      if (k && this._kidOpen === "__essen__") return this._renderEssen(k);
      if (k && this._kidOpen === "__kochen__") return this._renderCook(k);
      if (k && this._kidOpen === "__menu__") {
        const app0 = this.shadowRoot.querySelector("#app");
        k.className = `kidview ${app0?.classList.contains("dark") ? "dark" : ""}`;
        const today0 = ymd(new Date());
        k.innerHTML = `<div class="kwrap">
          <header class="khead"><div class="kname">⭐ Sterne &amp; Belohnungen</div><button class="kbtn close" data-k="close" aria-label="Schliessen">✕</button></header>
          <div class="kmenu">${this._kids().map((p) => {
            const d = this._kid(p), n = this._stars(p), r = this._reward(p);
            const offen = d.aufgaben.filter((a) => !d.heute.done[a.id]).length;
            const ziele = d.ziele.filter((z) => !z.fertig);
            return `<button class="kmcard" data-k="pick" data-name="${esc(p.name)}" style="--c:${p.farbe}">
              ${this._kidAvatar(p, 120)}
              <span class="kmname">${esc(p.name)}${d.streak.n >= 2 ? ` <span class="fire">🔥${d.streak.n}</span>` : ""}</span>
              <span class="kmstars">${n} ★ <small>${r.text ? `→ ${esc(r.bild && !/^(url:|img:)/.test(r.bild) ? r.bild : "🎁")} ${esc(r.text)}` : ""}</small></span>
              <span class="kminfo">${d.aufgaben.length ? (offen ? `noch ${offen} ${offen === 1 ? "Aufgabe" : "Aufgaben"} heute` : "Alle Aufgaben erledigt ✓") : ""}</span>
              ${ziele.length ? `<span class="kmgoals">${ziele.slice(0, 3).map((z) => `<span>${esc(z.bild)} ${z.n}/${z.ziel}</span>`).join("")}</span>` : ""}
            </button>`;
          }).join("")}</div>
        </div>`;
        return;
      }
      const p = this._config.personen.find((x) => x.name === this._kidOpen);
      if (!k || !p) return;
      const app = this.shadowRoot.querySelector("#app");
      k.className = `kidview ${app?.classList.contains("dark") ? "dark" : ""}`;
      const d = this._kid(p), st = this._kidSettings(), r = this._reward(p), n = this._stars(p);
      const today = ymd(new Date());
      const hour = new Date().getHours();
      const zeitIcon = { morgen: "☀️", abend: "🌙", tag: "🕐" };
      const waiting = Object.values(d.heute.done).filter((v) => v === "wait").length + d.ziele.reduce((a, z) => a + (z.wait || 0), 0);
      const card = (a) => {
        const state = d.heute.done[a.id];
        return `<button class="kcard ${state === "ok" ? "ok" : state === "wait" ? "wait" : ""}" data-k="task" data-id="${esc(a.id)}">
          <span class="kpic">${esc(a.bild)}</span><span class="ktxt">${esc(a.text)}</span>
          <span class="kstate">${state === "ok" ? "✓" : state === "wait" ? "⏳" : zeitIcon[a.zeit] || ""}</span></button>`;
      };
      const groups = [["morgen", "Am Morgen"], ["tag", "Am Tag"], ["abend", "Am Abend"]].map(([z, t]) => [z, t, d.aufgaben.filter((a) => (a.zeit || "tag") === z)]).filter((g) => g[2].length);
      // aktuelle Tageszeit zuerst
      if (hour >= 16) groups.sort((a, b) => (b[0] === "abend") - (a[0] === "abend"));
      const zielCard = (z) => {
        const lock = this._goalLocked(z, today);
        const bel = z.belohnung || {};
        return `<div class="kgoal ${z.fertig ? "fertig" : ""}">
          <span class="kgjar">${this._jar(Math.min(z.n, z.ziel), z.ziel, "z" + String(z.id).replace(/[^a-z0-9]/gi, ""))}<span class="kgjn">${z.n}/${z.ziel}</span></span>
          <div class="kgbody"><b><span class="kgic">${esc(z.bild)}</span> ${esc(z.text)}</b>
            <small>${z.fertig ? "Geschafft! 🏆" : `noch ${Math.max(0, z.ziel - z.n - z.wait)} ★${z.oft === "tag" ? " · einmal pro Tag" : ""}`}</small></div>
          ${bel.text || bel.bild ? `<div class="kgrew">${bel.bild ? this._bildHtml(bel.bild, "kgrpic") : ""}<span>${esc(bel.text || "")}</span></div>` : ""}
          ${z.fertig ? `<button class="kgbtn again" data-k="goalagain" data-id="${esc(z.id)}">Nochmals</button>`
            : `<button class="kgbtn ${lock ? "done" : ""}" data-k="goal" data-id="${esc(z.id)}" ${lock ? "disabled" : ""}>${lock ? (z.wait ? "⏳" : "✓ Heute") : "+1 ★"}</button>`}
        </div>`;
      };
      const done = n >= r.ziel;
      k.innerHTML = `
        <div class="kwrap" style="--c:${p.farbe}">
          <header class="khead">${this._kids().length > 1 ? `<button class="kbtn" data-k="menu" aria-label="Zurück zur Übersicht">←</button>` : ""}${this._kidAvatar(p, 84)}<div class="kname">${esc(p.name)}${d.streak.n >= 2 ? `<span class="fire big">🔥 ${d.streak.n}</span>` : ""}</div>
            <button class="kbtn" data-k="album" aria-label="Sticker-Album">📒</button>
            <button class="kbtn" data-k="settings" aria-label="Einstellungen für Eltern">⚙️</button>
            <button class="kbtn close" data-k="close" aria-label="Schliessen">✕</button></header>
          <div class="kmain">
            <section class="kleft">
              ${this._jar(Math.min(n, r.ziel), r.ziel)}
              <div class="kcount">${n} ★</div>
              <button class="kreward ${done ? "ready" : ""}" data-k="${done ? "redeem" : "reward"}">
                ${r.bild ? this._bildHtml(r.bild, "krpic") : `<span class="krpic">🎁</span>`}
                <span>${done ? `<b>Geschafft!</b>${esc(r.text || "Belohnung")}` : r.text ? `${esc(r.text)}<small>noch ${r.ziel - n} ★</small>` : "Belohnung wählen"}</span></button>
              ${waiting ? `<button class="kconfirm" data-k="confirm">✓ Eltern bestätigen (${waiting})</button>` : ""}
            </section>
            <section class="kright">
              ${this._kidTab === "album" ? `
                <h3 class="ksect">Meine Sticker</h3>
                ${d.sticker.length ? `<div class="kalbum">${d.sticker.slice().reverse().map((x) => `<div class="kst">${this._bildHtml(x.bild, "kstpic")}<span>${esc(x.text)}</span><small>${esc(x.datum.slice(8, 10) + "." + x.datum.slice(5, 7) + ".")}</small></div>`).join("")}</div>` : `<p class="khint">Noch keine Sticker. Für jede Belohnung und jedes grosse Ziel gibt es einen.</p>`}
                <button class="kback" data-k="tab" data-v="heute">← Zurück</button>` : `
                ${groups.map(([z, t, list]) => `<h3 class="ksect">${zeitIcon[z]} ${t}</h3><div class="kcards">${list.map(card).join("")}</div>`).join("") || `<p class="khint">Noch keine Aufgaben. Eltern: ⚙️ antippen.</p>`}
                ${d.ziele.length ? `<h3 class="ksect">🏆 Grosse Ziele</h3><div class="kgoals">${d.ziele.map(zielCard).join("")}</div>` : ""}`}
            </section>
          </div>
        </div>`;
    }
    async _kidClick(e) {
      const el = e.target.closest("[data-k]");
      if (!el) return;
      if (el.dataset.k === "close") return this._closeKid();
      if (this._kidOpen === "__settings__") return this._settingsClick(el);
      if (this._kidOpen === "__essen__") return this._essenClick(el);
      if (this._kidOpen === "__kochen__") return this._cookClick(el);
      if (el.dataset.k === "pick") { this._kidOpen = el.dataset.name; this._kidTab = "heute"; return this._renderKid(); }
      if (el.dataset.k === "menu") { this._kidOpen = "__menu__"; return this._renderKid(); }
      if (el.dataset.k === "soonadd") return this._openCountdown();
      if (el.dataset.k === "soonitem") {
        const h = this._hass;
        if (el.dataset.uid) {
          const cd = this._findByName("todo", this._config.countdowns);
          const it = (this._todos[cd] || []).find((i) => i.uid === el.dataset.uid);
          if (it) this._openConfirm(`«${it.summary}» aus den Countdowns entfernen?`, "Entfernen", () => h.callService("todo", "remove_item", { item: it.uid }, { entity_id: cd }).then(() => this._loadTodo(cd)));
        } else if (el.dataset.key && this._bildListe()) {
          const liste = this._bildListe(), key = el.dataset.key;
          this._openConfirm(`«${el.dataset.title}» bei «Bald» ausblenden?`, "Ausblenden", () => h.callService("todo", "add_item", { item: `Ausgeblendet: ${key}`, description: "bald" }, { entity_id: liste }).then(() => this._loadTodo(liste)));
        }
        return;
      }
      const p = this._config.personen.find((x) => x.name === this._kidOpen);
      if (!p) return;
      const k = el.dataset.k, st = this._kidSettings(), today = ymd(new Date());
      if (k === "tab") { this._kidTab = el.dataset.v; return this._renderKid(); }
      if (k === "album") { this._kidTab = this._kidTab === "album" ? "heute" : "album"; return this._renderKid(); }
      if (k === "settings") return this._parent("Einstellungen für Eltern", () => this._openKidSettings(p));
      if (k === "reward") return this._parent("Belohnung festlegen", () => this._openReward(p));
      if (k === "redeem") return this._redeem(p);
      if (k === "confirm") return this._parent("Erledigte Aufgaben bestätigen", () => this._confirmKid(p));
      const d = this._kid(p);
      if (k === "task") {
        const id = el.dataset.id;
        const cur = d.heute.done[id];
        if (cur === "ok" || cur === "wait") return;
        d.heute.done[id] = st.bestaetigen ? "wait" : "ok";
        this._celebrate(el, st.bestaetigen ? 0 : 1);
        el.classList.add(st.bestaetigen ? "wait" : "ok");
        await this._saveKid(p, d);
        if (!st.bestaetigen) { await this._addStars(p, 1); await this._checkStreak(p); this._checkGoalReached(p); }
        return;
      }
      if (k === "goal") {
        const z = d.ziele.find((x) => x.id === el.dataset.id);
        if (!z || z.fertig || this._goalLocked(z, today)) return;
        if (st.bestaetigen) { z.wait = (z.wait || 0) + 1; z.waitDay = today; }
        else this._goalStep(z, today, 1);
        this._celebrate(el, st.bestaetigen ? 0 : 3);
        await this._saveKid(p, d);
        if (!st.bestaetigen && z.fertig) this._goalDone(p, z);
        return;
      }
      if (k === "goalagain") {
        const id = el.dataset.id;
        return this._parent("Dieses Ziel nochmals von vorne beginnen?", async () => {
          const d2 = this._kid(p), z = d2.ziele.find((x) => x.id === id);
          if (z) { z.n = 0; z.wait = 0; z.last = ""; z.fertig = false; }
          await this._saveKid(p, d2);
        });
      }
    }
    _goalLocked(z, today) { return z.oft === "tag" && (z.last === today || (z.wait > 0 && z.waitDay === today)); }
    _goalStep(z, today, cnt = 1) { z.n = Math.min(z.ziel, (z.n || 0) + cnt); z.last = today; z.wait = 0; delete z.waitDay; if (z.n >= z.ziel) z.fertig = true; }
    async _goalDone(p, z) {
      const d = this._kid(p), bel = z.belohnung || {};
      d.sticker.push({ bild: bel.bild || z.bild, text: bel.text || z.text, datum: ymd(new Date()) });
      await this._saveKid(p, d);
      this._party(p, bel.bild || z.bild, `Geschafft, ${p.name}!`, bel.text ? `${z.text} ${z.ziel}× – ${bel.text}` : `${z.text} ${z.ziel}×`);
    }
    async _confirmKid(p) {
      const d = this._kid(p), today = ymd(new Date());
      let add = 0;
      Object.keys(d.heute.done).forEach((id) => { if (d.heute.done[id] === "wait") { d.heute.done[id] = "ok"; add++; } });
      const finished = [];
      d.ziele.forEach((z) => { if (z.wait > 0 && !z.fertig) { this._goalStep(z, today, z.wait); if (z.fertig) finished.push(z); } });
      await this._saveKid(p, d);
      if (add) await this._addStars(p, add);
      await this._checkStreak(p);
      for (const z of finished) await this._goalDone(p, z);
      if (!finished.length) this._checkGoalReached(p);
    }
    // Bonus: alle Tagesaufgaben an 5 Tagen hintereinander erledigt
    async _checkStreak(p) {
      const d = this._kid(p), today = ymd(new Date()), yest = ymd(addDays(new Date(), -1));
      if (!d.aufgaben.length || d.streak.last === today) return;
      if (!d.aufgaben.every((a) => d.heute.done[a.id] === "ok")) return;
      d.streak = { n: d.streak.last === yest ? d.streak.n + 1 : 1, last: today };
      const bonus = d.streak.n % 5 === 0;
      await this._saveKid(p, d);
      if (bonus) { await this._addStars(p, 1); this._party(p, "🔥", `${d.streak.n} Tage am Stück! +1 ★`); }
    }
    _checkGoalReached(p) { setTimeout(() => this._checkGoalNow(p), 1500); }
    _checkGoalNow(p) {
      const r = this._reward(p);
      if (this._stars(p) >= r.ziel && this._partyFor !== `${p.name}|${r.text}|${r.ziel}`) {
        this._partyFor = `${p.name}|${r.text}|${r.ziel}`;
        this._party(p, r.bild || "🎁", `Geschafft, ${p.name}!`, r.text ? `${r.ziel} Sterne für: ${r.text}` : "");
      }
    }
    _redeem(p) {
      const r = this._reward(p);
      this._parent(`${p.name} hat ${r.ziel} Sterne gesammelt! Belohnung «${r.text || "Belohnung"}» einlösen? Danach beginnt das Sammeln wieder bei 0.`, async () => {
        await this._hass.callService("counter", "reset", { entity_id: p.sterne });
        const d = this._kid(p);
        d.sticker.push({ bild: r.bild || "🎁", text: r.text || "Belohnung", datum: ymd(new Date()) });
        await this._saveKid(p, d);
        this._partyFor = null;
        this._party(p, r.bild || "🎁", `Viel Spass, ${p.name}!`, r.text || "");
      });
    }
    // Grosse Feier mit Konfetti und kurzem Ton
    _party(p, bild, title, sub = "") {
      const el = this.shadowRoot.querySelector("#party");
      if (!el) return;
      const colors = ["#f2b400", "#d6336c", "#2b8a3e", "#1971c2", "#7048e8", "#e8590c"];
      el.className = "party on";
      el.innerHTML = `<div class="confetti">${Array.from({ length: 70 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${(Math.random() * 1.2).toFixed(2)}s;animation-duration:${(2.2 + Math.random() * 1.8).toFixed(2)}s;transform:rotate(${Math.round(Math.random() * 360)}deg)"></i>`).join("")}</div>
        <div class="pbox" style="--c:${p.farbe}">${this._bildHtml(bild, "ppic")}<h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}<small>Antippen zum Schliessen</small></div>`;
      clearTimeout(this._partyT);
      this._partyT = setTimeout(() => this._partyClose(), 9000);
      if (this._kidSettings().ton) this._jingle();
    }
    _partyClose() { const el = this.shadowRoot.querySelector("#party"); if (el) { el.className = ""; el.innerHTML = ""; } clearTimeout(this._partyT); }
    _jingle() {
      try {
        const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
        const ctx = this._actx || (this._actx = new A());
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.13;
          o.type = "triangle"; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
          o.start(t); o.stop(t + 0.4);
        });
      } catch (e) { /* ohne Ton */ }
    }

    // ---------- Einstellungen für Eltern ----------
    _openKidSettings(p) {
      const d = this._kid(p), st = this._kidSettings();
      let tab = this._kidSetTab || "tages", neuBild = "⭐", neuZeit = "morgen", neuZiel = 14;
      const draw = () => {
        this._kidSetTab = tab;
        const body = tab === "tages" ? `
          <div class="klist">${d.aufgaben.map((a, i) => `<div class="krow"><span class="kpic s">${esc(a.bild)}</span><span>${esc(a.text)}</span><small>${{ morgen: "☀️ Morgen", tag: "🕐 Tag", abend: "🌙 Abend" }[a.zeit] || ""}</small>${d.heute.done[a.id] ? `<button class="kreset" data-m="resettask" data-i="${i}" title="Heute wieder offen">↺ ${d.heute.done[a.id] === "ok" ? "✓" : "⏳"}</button>` : ""}<button class="nope" data-m="deltask" data-i="${i}" aria-label="Entfernen">✕</button></div>`).join("") || `<p class="hint2">Noch keine Tagesaufgaben.</p>`}</div>
          ${Object.keys(d.heute.done).length ? `<button class="btn ghost" data-m="resetall">↺ Alle Aufgaben von heute zurücksetzen</button>` : ""}
          <div class="sect">Vorlagen (antippen zum Hinzufügen)</div>
          <div class="sug">${TAGES_VORLAGEN.map(([t, b, z], i) => `<button data-m="addtv" data-i="${i}">${b} ${esc(t)} <small>${{ morgen: "☀️", tag: "🕐", abend: "🌙" }[z]}</small></button>`).join("")}</div>`
          : tab === "ziele" ? `
          <p class="hint2">Jedes grosse Ziel sammelt eigene Sterne für eine eigene Belohnung. Die Tagesaufgaben füllen nebenbei das Sternenglas.</p>
          <div class="klist">${d.ziele.map((z, i) => `<div class="krow"><button class="krowmain" data-m="editgoal" data-i="${i}"><span class="kpic s">${esc(z.bild)}</span><span>${esc(z.text)}</span><small>${z.fertig ? "🏆 geschafft" : `${z.n || 0} / ${z.ziel} ★`} → ${esc((z.belohnung && (z.belohnung.bild || "")) || "")} ${esc((z.belohnung && z.belohnung.text) || "–")}</small></button>${z.n || z.wait || z.fertig ? `<button class="kreset" data-m="resetgoal" data-i="${i}" title="Fortschritt auf 0">↺ 0</button>` : ""}<button class="nope" data-m="delgoal" data-i="${i}" aria-label="Entfernen">✕</button></div>`).join("") || `<p class="hint2">Noch keine grossen Ziele.</p>`}</div>
          <div class="sect">Vorlagen (antippen, dann anpassen)</div>
          <div class="sug">${LANG_VORLAGEN.map(([t, b, z, o, bt, bb], i) => `<button data-m="addlv" data-i="${i}">${b} ${esc(t)} <small>${z}× → ${bb} ${esc(bt)}</small></button>`).join("")}</div>
          <button class="btn ghost" data-m="newgoal">+ Eigenes Ziel</button>`
          : `
          <label class="chk"><input id="fp-best" type="checkbox" ${st.bestaetigen ? "checked" : ""}><span>Sterne erst nach Bestätigung durch Eltern</span></label>
          <label class="kw">Eltern-Code (4 Ziffern, leer = kein Code)<input id="fp-pinset" type="text" inputmode="numeric" maxlength="4" value="${esc(st.pin)}" placeholder="z. B. 2580"></label>
          <label class="chk"><input id="fp-ton" type="checkbox" ${st.ton ? "checked" : ""}><span>Ton bei der Feier</span></label>
          <p class="hint2">Gilt für alle Kinder. Der Code schützt Einstellungen, Bestätigen und Einlösen.</p>
          <div class="flash"></div>`;
        const own = tab === "tages" ? `
          <div class="sect">${tab === "tages" ? "Eigene Tagesaufgabe" : "Eigenes grosses Ziel"}</div>
          <div class="kown"><span class="kpic s" id="fp-nb">${neuBild}</span><input id="fp-nt" type="text" maxlength="30" placeholder="${tab === "tages" ? "z. B. Velohelm aufhängen" : "z. B. Allein einschlafen"}">
            ${tab === "tages" ? `<select id="fp-nz"><option value="morgen" ${neuZeit === "morgen" ? "selected" : ""}>☀️ Morgen</option><option value="tag" ${neuZeit === "tag" ? "selected" : ""}>🕐 Tag</option><option value="abend" ${neuZeit === "abend" ? "selected" : ""}>🌙 Abend</option></select>`
              : `<select id="fp-ng">${[5, 7, 10, 14, 21, 30].map((x) => `<option value="${x}" ${x === neuZiel ? "selected" : ""}>${x} Tage</option>`).join("")}</select>`}
            <button class="btn" data-m="addown">Hinzufügen</button></div>
          <div class="emo small">${KIND_EMOJIS.map((e) => `<button data-m="nb" data-v="${e}" class="${e === neuBild ? "on" : ""}">${e}</button>`).join("")}</div>` : "";
        this._modal(`
          <div class="dlg-h" style="--c:${p.farbe}"><span class="bar"></span><h2>Aufgaben von ${esc(p.name)}</h2></div>
          <div class="dlg-b">
            <div class="seg ktabs">${[["tages", "Tagesaufgaben"], ["ziele", "Grosse Ziele"], ["opt", "Einstellungen"]].map(([v, t]) => `<button data-m="tab" data-v="${v}" class="${tab === v ? "on" : ""}">${t}</button>`).join("")}</div>
            ${body}${own}
          </div>
          <div class="dlg-f"><span class="sp"></span>${tab === "opt" ? `<button class="btn" data-m="saveopt">Speichern</button>` : ""}<button class="btn ${tab === "opt" ? "ghost" : ""}" data-m="close">Fertig</button></div>`);
        this.shadowRoot.querySelector("#modal .dlg").classList.add("wide");
      };
      const uid = () => Math.random().toString(36).slice(2, 8);
      const save = async () => { await this._saveKid(p, d); draw(); };
      this._mh = {
        tab: (el) => { tab = el.dataset.v; draw(); },
        nb: (el) => { neuBild = el.dataset.v; const b = this.shadowRoot.querySelector("#fp-nb"); if (b) b.textContent = neuBild; this.shadowRoot.querySelectorAll("#modal .emo button").forEach((x) => x.classList.toggle("on", x === el)); },
        addtv: (el) => { const [t, b, z] = TAGES_VORLAGEN[+el.dataset.i]; d.aufgaben.push({ id: uid(), text: L(t), bild: b, zeit: z }); save(); },
        addlv: (el) => { const [t, b, z, o, bt, bb] = LANG_VORLAGEN[+el.dataset.i]; this._openGoalEditor(p, null, { text: L(t), bild: b, ziel: z, oft: o, belohnung: { text: L(bt), bild: bb } }); },
        newgoal: () => this._openGoalEditor(p, null, { text: "", bild: "⭐", ziel: 5, oft: "frei", belohnung: {} }),
        editgoal: (el) => this._openGoalEditor(p, +el.dataset.i, null),
        deltask: (el) => { d.aufgaben.splice(+el.dataset.i, 1); save(); },
        // Zurücksetzen: Aufgabe wieder offen, ein bereits gezählter Stern wird abgezogen
        resettask: async (el) => {
          const a = d.aufgaben[+el.dataset.i]; if (!a) return;
          const was = d.heute.done[a.id]; delete d.heute.done[a.id];
          await this._saveKid(p, d);
          if (was === "ok" && this._stars(p) > 0) await this._hass.callService("counter", "decrement", { entity_id: p.sterne });
          draw();
        },
        resetall: async () => {
          const ok = Object.values(d.heute.done).filter((v) => v === "ok").length;
          d.heute.done = {};
          await this._saveKid(p, d);
          for (let k = 0; k < Math.min(ok, this._stars(p)); k++) await this._hass.callService("counter", "decrement", { entity_id: p.sterne });
          draw();
        },
        resetgoal: async (el) => {
          const z = d.ziele[+el.dataset.i]; if (!z) return;
          z.n = 0; z.wait = 0; z.last = ""; z.fertig = false; delete z.waitDay;
          await save();
        },
        delgoal: (el) => { d.ziele.splice(+el.dataset.i, 1); save(); },
        addown: () => {
          const t = this.shadowRoot.querySelector("#fp-nt").value.trim();
          if (!t) return;
          if (tab === "tages") { neuZeit = this.shadowRoot.querySelector("#fp-nz").value; d.aufgaben.push({ id: uid(), text: t, bild: neuBild, zeit: neuZeit }); }
          else return;
          save();
        },
        saveopt: async () => {
          const pin = this.shadowRoot.querySelector("#fp-pinset").value.trim();
          if (pin && !/^\d{4}$/.test(pin)) { const f = this.shadowRoot.querySelector("#modal .flash"); if (f) f.textContent = "Der Code muss genau 4 Ziffern haben."; return; }
          await this._saveKidSettings({ bestaetigen: this.shadowRoot.querySelector("#fp-best").checked, pin, ton: this.shadowRoot.querySelector("#fp-ton").checked });
          this._modal("");
        },
      };
      draw();
    }

    _openGoalEditor(p, idx, preset) {
      const d = this._kid(p);
      const src = idx != null ? d.ziele[idx] : preset;
      if (!src) return;
      const g = { text: src.text || "", bild: src.bild || "⭐", ziel: src.ziel || 5, oft: src.oft || "frei", belohnung: { text: src.belohnung?.text || "", bild: src.belohnung?.bild || "" } };
      const BEL_EMOJIS = ["🛻", "🚗", "🚒", "🚂", "🦖", "🧸", "🍭", "🍫", "🍦", "🍟", "🍕", "🧁", "🎈", "🫧", "📖", "🖍️", "🧩", "🎧", "⚽", "🏊", "🎬", "🦁", "🛝", "🎁", "⭐", "👑"];
      const draw = () => {
        this._modal(`
          <div class="dlg-h" style="--c:${p.farbe}"><span class="bar"></span><h2>${idx != null ? "Ziel bearbeiten" : "Neues grosses Ziel"}</h2></div>
          <div class="dlg-b">
            <div class="kown"><span class="kpic s">${esc(g.bild)}</span><input id="fp-gt" type="text" maxlength="30" placeholder="z. B. Töpfchen" value="${esc(g.text)}"></div>
            <div class="emo small">${KIND_EMOJIS.map((e) => `<button data-m="gb" data-v="${e}" class="${e === g.bild ? "on" : ""}">${e}</button>`).join("")}</div>
            <div class="sect">Wie oft zählt es?</div>
            <div class="seg">${[["frei", "Jedes Mal"], ["tag", "Einmal pro Tag"]].map(([v, t]) => `<button data-m="go" data-v="${v}" class="${g.oft === v ? "on" : ""}">${t}</button>`).join("")}</div>
            <div class="zielrow"><span>Sterne bis zur Belohnung</span>
              <button class="add" data-m="gzm" aria-label="Weniger"><ha-icon icon="mdi:minus"></ha-icon></button><b>${g.ziel}</b>
              <button class="add" data-m="gzp" aria-label="Mehr"><ha-icon icon="mdi:plus"></ha-icon></button></div>
            <div class="sect">Belohnung</div>
            <div class="kown"><span class="kpic s">${esc(g.belohnung.bild || "🎁")}</span><input id="fp-gbt" type="text" maxlength="30" placeholder="z. B. Monstertruck" value="${esc(g.belohnung.text)}"></div>
            <div class="emo small">${BEL_EMOJIS.map((e) => `<button data-m="gbb" data-v="${e}" class="${e === g.belohnung.bild ? "on" : ""}">${e}</button>`).join("")}</div>
            <div class="rwquick">${BELOHNUNGEN.map(([t, e], i) => `<button data-m="gq" data-i="${i}" class="${L(t) === g.belohnung.text ? "on" : ""}"><span class="qe">${e}</span><span>${esc(t)}</span></button>`).join("")}</div>
            <div class="flash"></div>
          </div>
          <div class="dlg-f"><span class="sp"></span><button class="btn ghost" data-m="back">Abbrechen</button><button class="btn" data-m="gsave">Speichern</button></div>`);
        this.shadowRoot.querySelector("#modal .dlg").classList.add("wide");
      };
      const keep = () => { const t = this.shadowRoot.querySelector("#fp-gt"); if (t) g.text = t.value; const b = this.shadowRoot.querySelector("#fp-gbt"); if (b) g.belohnung.text = b.value; };
      this._mh = {
        gb: (el) => { keep(); g.bild = el.dataset.v; draw(); },
        go: (el) => { keep(); g.oft = el.dataset.v; draw(); },
        gzm: () => { keep(); g.ziel = Math.max(1, g.ziel - 1); draw(); },
        gzp: () => { keep(); g.ziel = Math.min(30, g.ziel + 1); draw(); },
        gbb: (el) => { keep(); g.belohnung.bild = el.dataset.v; draw(); },
        gq: (el) => { keep(); const [t, e] = BELOHNUNGEN[+el.dataset.i]; g.belohnung = { text: L(t), bild: e }; draw(); },
        back: () => this._openKidSettings(p),
        gsave: async () => {
          keep();
          g.text = g.text.trim(); g.belohnung.text = g.belohnung.text.trim();
          if (!g.text) { const f = this.shadowRoot.querySelector("#modal .flash"); if (f) f.textContent = "Bitte einen Namen für das Ziel eingeben."; return; }
          const d2 = this._kid(p);
          if (idx != null && d2.ziele[idx]) {
            const z = d2.ziele[idx];
            Object.assign(z, { text: g.text, bild: g.bild, ziel: g.ziel, oft: g.oft, belohnung: g.belohnung });
            z.fertig = z.n >= z.ziel;
          } else d2.ziele.push({ id: Math.random().toString(36).slice(2, 8), ...g, n: 0, wait: 0, last: "" });
          await this._saveKid(p, d2);
          this._kidSetTab = "ziele";
          this._openKidSettings(p);
        },
      };
      draw();
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
          this.shadowRoot.querySelector("#fp-in").value = L(t); wahl = e; setZ(z); prev();
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
          <div class="rwquick">${BELOHNUNGEN.map(([t, e, z], i) => `<button data-m="quick" data-i="${i}" class="${L(t) === r.text ? "on" : ""}"><span class="qe">${e}</span><span>${esc(t)}</span><small>${z} ★</small></button>`).join("")}</div>
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

    // «Bald»: Geburtstage, Countdowns, Schulferien (ausgeblendete Einträge weggelassen)
    _soonItems(ferienAnzahl = 1) {
      const items = [];
      const t = sod(new Date());
      (this._bdays || []).forEach((e) => { const n = daysUntil(e.start); if (n >= 0) items.push({ n, d: sod(e.start), icon: "mdi:cake-variant-outline", title: e.title, key: `${e.title}|${ymd(e.start)}` }); });
      const cd = this._findByName("todo", this._config.countdowns);
      (this._todos[cd] || []).filter((i) => i.status !== "completed" && i.due).forEach((i) => {
        const d = parseYmd(i.due); const n = daysUntil(d); if (n >= 0) items.push({ n, d, icon: "mdi:party-popper", title: i.summary, uid: i.uid });
      });
      alleFerien().filter(([a, b]) => ymd(t) <= b).slice(0, ferienAnzahl).forEach((f) => {
        const a = parseYmd(f[0]), e = parseYmd(f[1]); const n = daysUntil(a); const key = `${f[2]}|${f[0]}`;
        items.push(n <= 0 ? { n: 0, d: a, icon: "mdi:beach", title: `${f[2]} bis ${e.getDate()}. ${MOS[e.getMonth()]}`, live: true, key } : { n, d: a, icon: "mdi:beach", title: f[2], key });
      });
      const hidden = this._ausgeblendet();
      return items.filter((x) => !(x.key && hidden.includes(x.key))).sort((a, b) => a.n - b.n);
    }
    _soonBild(i) {
      const emo = { "mdi:cake-variant-outline": "🎂", "mdi:party-popper": "🎉", "mdi:beach": "🏖️" }[i.icon] || "⭐";
      const custom = this._customBilder().find((m) => i.title.toLowerCase().includes(m.key.toLowerCase()));
      return custom ? custom.val : emo;
    }
    _soonWhen(i) {
      if (i.live) return `<span class="bheute">Jetzt! 🎉</span>`;
      if (i.n === 0) return `<span class="bheute">Heute! 🎉</span>`;
      if (i.n === 1) return `<span class="bheute">Morgen</span>`;
      return `<span class="bnum">${i.n}</span><span class="bsmall">Tage</span>`;
    }
    _soonPanel() {
      const items = this._soonItems(1);
      const cd = this._findByName("todo", this._config.countdowns);
      return `<div class="panel soon" data-act="soonbig" role="button" aria-label="Bald gross anzeigen">
        <div class="ph"><ha-icon icon="mdi:timer-sand"></ha-icon><h3>Bald</h3>${cd ? `<button class="add" data-act="addcd" aria-label="Countdown hinzufügen"><ha-icon icon="mdi:plus"></ha-icon></button>` : ""}</div>
        <ul class="cd kidsoon">${items.slice(0, this._isQuer() ? 6 : 4).map((i) => `<li class="${i.live || i.n === 0 ? "heute" : ""}">
            ${this._bildHtml(this._soonBild(i), "bpic")}
            <span class="btxt"><b>${esc(i.title)}</b><span class="bwhen">${this._soonWhen(i)}</span></span></li>`).join("") || `<li class="ph-empty">Noch nichts geplant.</li>`}</ul>
      </div>`;
    }
    _openSoon() { this._kidOpen = "__bald__"; this._renderKid(); this._kidTouch(); }
    _renderSoonBig(k) {
      const app0 = this.shadowRoot.querySelector("#app");
      k.className = `kidview ${app0?.classList.contains("dark") ? "dark" : ""}`;
      const items = this._soonItems(3);
      const cd = this._findByName("todo", this._config.countdowns);
      k.innerHTML = `<div class="kwrap">
        <header class="khead"><div class="kname">⏳ Bald</div>
          ${cd ? `<button class="kbtn" data-k="soonadd" aria-label="Countdown hinzufügen">＋</button>` : ""}
          <button class="kbtn close" data-k="close" aria-label="Schliessen">✕</button></header>
        <div class="sbig">${items.slice(0, 24).map((i) => `<button class="sbcard ${i.live || i.n === 0 ? "heute" : ""}" data-k="soonitem" data-uid="${esc(i.uid || "")}" data-key="${esc(i.key || "")}" data-title="${esc(i.title)}">
            ${this._bildHtml(this._soonBild(i), "sbpic")}
            <b>${esc(i.title)}</b>
            <span class="bwhen">${this._soonWhen(i)}</span>
            <small>${WDL[i.d.getDay()]}, ${i.d.getDate()}. ${MO[i.d.getMonth()]}</small>
          </button>`).join("") || `<p class="khint">Noch nichts geplant.</p>`}</div>
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
        case "meal": this._openMeal(parseYmd(el.dataset.day), el.dataset.slot || "abend"); break;
        case "essen": this._openEssen(); break;
        case "vote": this._vote(el.dataset.title, el.dataset.key, el.dataset.name, +el.dataset.s); break;
        case "voteskip": lsSet("fp-rate-skip", (lsGet("fp-rate-skip", "") + "," + el.dataset.key).split(",").slice(-20).join(",")); this._render(); break;
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
        case "einstellungen": this._openSettings(); break;
        case "bdparty": { const { members } = this._bdayToday(); if (members.length) this._bdayParty(members[0].p, members[0].b); break; }
        case "addperson": this._openPerson(null); break;
        case "kidview": { const p = this._config.personen.find((x) => x.name === el.dataset.name); if (p) this._openKid(p); break; }
        case "rewards": this._openRewards(); break;
        case "soonbig": this._openSoon(); break;
        case "stargive": case "reward": case "redeem": {
          const p = this._config.personen.find((x) => x.name === el.dataset.name);
          if (!p || !p.sterne) break;
          if (a === "stargive") {
            const before = Math.max(0, parseInt(h.states[p.sterne]?.state, 10) || 0);
            h.callService("counter", "increment", { entity_id: p.sterne });
            this._celebrate(el, before + 1 >= this._reward(p).ziel ? 9 : 1);
            this._checkGoalReached(p);
          } else if (a === "reward") this._openReward(p);
          else {
            const r = this._reward(p);
            this._redeem(p);
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
      const kid = el.closest && el.closest("#kid");
      const app = kid || this.shadowRoot.querySelector("#app");
      const host = app.getBoundingClientRect();
      if (kid) { host.y -= kid.scrollTop; }
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
    _openMeal(day, slot = "abend") {
      const ess = this._cals([this._config.essensplan])[0];
      if (!this._slots(day).includes(slot)) slot = "abend";
      const cur = this._meal(day, slot);
      const two = this._slots(day).length > 1;
      const label = `${WDL[day.getDay()]}, ${day.getDate()}. ${MO[day.getMonth()]}`;
      const titel = two ? `${slot === "mittag" ? "Mittagessen" : "Abendessen"} am ${label}` : `Essen am ${label}`;
      if (!ess) { this._mh = {}; this._modal(`<div class="dlg-h"><h2>Essensplan</h2></div><div class="dlg-b"><p>Der Kalender «${esc(this._config.essensplan)}» fehlt noch. Oben auf «Jetzt anlegen» tippen.</p></div><div class="dlg-f"><button class="btn" data-m="close">OK</button></div>`); return; }
      this._prefetch();
      const { fav } = this._mealPrefs();
      const vors = this._mealSuggest(day, 8, [], slot).filter((x) => x.title !== cur?.title);
      const shown = new Set(vors.map((x) => x.title.toLowerCase()));
      const favs = [...fav.values()].map((f) => f.title).filter((t) => !shown.has(t.toLowerCase()) && t !== cur?.title);
      favs.forEach((t) => shown.add(t.toLowerCase()));
      const idea = this._newIdea([...shown]);
      if (idea) shown.add(idea.name.toLowerCase());
      const rest = this._suggest.filter((x) => !shown.has(x.toLowerCase()) && x !== cur?.title).slice(0, 12);
      let slug = this._slugOf(cur);
      const findRecipe = (t) => (this._mealieList || []).find((r) => r.name.toLowerCase() === t.trim().toLowerCase());
      const save = async (v, s) => { v = (v || "").trim(); const r = s !== undefined ? null : findRecipe(v); this._modal(""); await this._saveMeal(day, slot, v, s !== undefined ? s : r ? r.slug : (v === cur?.title ? slug : ""), cur); };
      const inp = () => this.shadowRoot.querySelector("#fp-in");
      const favBtn = () => { const t = inp().value.trim(); const b = this.shadowRoot.querySelector('[data-m="fav"]'); if (b) { const on = this._mealPrefs().fav.has(t.toLowerCase()); b.classList.toggle("on", on); b.innerHTML = `<ha-icon icon="${on ? "mdi:heart" : "mdi:heart-outline"}"></ha-icon>${on ? "Lieblingsessen" : "Als Lieblingsessen"}`; } };
      const recipeHits = () => {
        const box = this.shadowRoot.querySelector("#fp-rhits"); if (!box) return;
        const q = inp().value.trim().toLowerCase();
        const hits = q.length >= 2 ? (this._mealieList || []).filter((r) => r.name.toLowerCase().includes(q) && r.name.toLowerCase() !== q).slice(0, 6) : [];
        box.innerHTML = hits.length ? `<span class="lbl">Rezepte in Mealie</span>${hits.map((r) => `<span class="mchip"><button data-m="pickr" data-slug="${esc(r.slug)}" data-v="${esc(r.name)}">📖 ${esc(r.name)}${this._mins(r) ? `<small>${this._mins(r)} Min.</small>` : ""}</button></span>`).join("")}` : "";
      };
      this._mh = {
        save: () => save(inp().value),
        del: () => save("", ""),
        pick: (el) => { inp().value = el.dataset.v; save(el.dataset.v, el.dataset.slug || undefined); },
        pickr: (el) => save(el.dataset.v, el.dataset.slug),
        fav: async () => { const t = inp().value.trim(); if (!t) return; await this._toggleMealPref("♥", t); favBtn(); },
        nope: async (el) => { const t = el.dataset.v; await this._toggleMealPref("✗", t); el.closest(".mchip")?.remove(); },
        fill: () => this._openFillWeek(),
        cook: () => { this._modal(""); this._openCook(slug); },
        recipe: () => this._openRecipe(slug),
        all: () => { this._modal(""); this._openEssen("woche"); },
      };
      const chip = (x, why) => `<span class="mchip ${x.fav ? "fav" : ""}"><button data-m="pick" data-v="${esc(x.title)}" ${x.slug ? `data-slug="${esc(x.slug)}"` : ""}>${x.fav ? '<ha-icon icon="mdi:heart"></ha-icon>' : ""}${x.slug ? "📖 " : ""}${esc(x.title)}${why ? `<small>${esc(why)}</small>` : ""}</button><button class="nope" data-m="nope" data-v="${esc(x.title)}" aria-label="${esc(x.title)} nicht mehr vorschlagen" title="Nicht mehr vorschlagen"><ha-icon icon="mdi:close"></ha-icon></button></span>`;
      this._modal(`
        <div class="dlg-h"><ha-icon icon="${two ? (slot === "mittag" ? "mdi:white-balance-sunny" : "mdi:weather-night") : "mdi:silverware-fork-knife"}"></ha-icon><h2>${titel}</h2></div>
        <div class="dlg-b">
          <div class="mealin"><input id="fp-in" type="text" autofocus placeholder="Was gibt es?" value="${esc(cur?.title || "")}" enterkeyhint="done">
            <button class="btn ghost favbtn" data-m="fav"></button></div>
          ${slug ? `<div class="mealrec"><button class="btn ghost" data-m="recipe">📖 Rezept</button><button class="btn" data-m="cook">👩‍🍳 Kochen</button></div>` : ""}
          <div class="sug" id="fp-rhits"></div>
          ${vors.length ? `<div class="sug"><span class="lbl">Vorschläge</span>${vors.map((x) => chip(x, x.why)).join("")}</div>` : `<p class="hint2">Noch keine Vorschläge: Sobald ein paar Wochen geplant sind, lernt der Planer eure Gewohnheiten. Lieblingsessen mit dem Herz markieren.</p>`}
          ${idea ? `<div class="sug"><span class="lbl">Neu ausprobieren</span><span class="mchip new"><button data-m="pick" data-v="${esc(idea.name)}" data-slug="${esc(idea.slug)}">✨ ${esc(idea.name)}${this._mins(idea) ? `<small>${this._mins(idea)} Min.</small>` : ""}</button></span></div>` : ""}
          ${favs.length ? `<div class="sug"><span class="lbl">Weitere Lieblingsessen</span>${favs.map((t) => chip({ title: t, fav: true }, "")).join("")}</div>` : ""}
          ${rest.length ? `<div class="sug"><span class="lbl">Schon gekocht</span>${rest.map((t) => chip({ title: t }, "")).join("")}</div>` : ""}
        </div>
        <div class="dlg-f">${cur ? `<button class="btn ghost" data-m="del">Entfernen</button>` : ""}<button class="btn ghost" data-m="fill"><ha-icon icon="mdi:auto-fix"></ha-icon>Woche füllen</button>${this._kidOpen === "__essen__" ? "" : `<button class="btn ghost" data-m="all">🍽️ Alles zum Essen</button>`}<span class="sp"></span><button class="btn ghost" data-m="close">Abbrechen</button><button class="btn" data-m="save">Speichern</button></div>`);
      this.shadowRoot.querySelector("#modal .dlg").classList.add("wide");
      favBtn();
      inp().addEventListener("input", () => { favBtn(); recipeHits(); });
      inp().addEventListener("keydown", (e) => { if (e.key === "Enter") this._mh.save(); });
    }

    // Leere Mahlzeiten der nächsten 7 Tage mit Vorschlägen füllen (mit Vorschau)
    _openFillWeek() {
      const today = sod(new Date());
      const plan = [], extra = [];
      for (let k = 0; k < 7; k++) {
        const d = addDays(today, k);
        for (const s of this._slots(d)) {
          if (this._meal(d, s)) continue;
          const best = this._mealSuggest(d, 8, extra, s).find((x) => !plan.some((p) => p.title.toLowerCase() === x.title.toLowerCase()));
          if (best) { plan.push({ d, s, title: best.title, slug: best.slug, why: best.why }); extra.push({ title: best.title, d, slot: s, slug: best.slug }); }
        }
      }
      if (!plan.length) { this._openConfirm(this._mealHist?.length ? "Die nächsten 7 Tage sind schon geplant." : "Noch zu wenig Erfahrung: Plane zuerst ein paar Essen von Hand oder markiere Lieblingsessen.", "OK", async () => {}); return; }
      const two = plan.some((p) => p.s === "mittag");
      this._mh = {
        ok: async () => {
          const sel = [...this.shadowRoot.querySelectorAll("#modal .fillist input:checked")].map((x) => plan[+x.value]);
          this._modal("");
          for (const p of sel) await this._saveMeal(p.d, p.s, p.title, p.slug, null);
        },
      };
      this._modal(`
        <div class="dlg-h"><ha-icon icon="mdi:auto-fix"></ha-icon><h2>Vorschlag für die Woche</h2></div>
        <div class="dlg-b"><ul class="fillist">${plan.map((p, i) => `<li><label><input type="checkbox" value="${i}" checked><span>${WD[p.d.getDay()]} ${p.d.getDate()}.${p.d.getMonth() + 1}.${two ? ` ${p.s === "mittag" ? "☀️" : "🌙"}` : ""}</span><b>${p.slug ? "📖 " : ""}${esc(p.title)}</b>${p.why ? `<small>${esc(p.why)}</small>` : ""}</label></li>`).join("")}</ul>
          <p class="hint2">Bereits geplante Mahlzeiten bleiben, wie sie sind. Häkchen weg bei allem, was nicht passt.</p></div>
        <div class="dlg-f"><span class="sp"></span><button class="btn ghost" data-m="close">Abbrechen</button><button class="btn" data-m="ok">Übernehmen</button></div>`);
    }
    // Rezepte rund um heute laden (für Reste, Zeiten, Einkauf)
    async _prefetch() {
      if (!this._mealieId || this._prefetching) return;
      this._prefetching = true;
      const t = sod(new Date());
      const slugs = new Set();
      (this._mealHist || []).forEach((e) => { const dd = Math.round((e.d - t) / 864e5); if (e.slug && dd >= -3 && dd <= 7) slugs.add(e.slug); });
      let n = 0;
      for (const s of slugs) { if (this._recipeCache?.[s]) continue; try { await this._recipe(s); n++; } catch (e) { /* weiter */ } if (n >= 15) break; }
      this._prefetching = false;
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
    _bilderItems() {
      const custom = this._customBilder();
      const items = THEMEN.map((t) => {
        const first = t.keys.split("|")[0];
        const key = /^[a-zäöü ]+$/i.test(first) ? first : t.name;
        const c = custom.find((m) => t.re.test(m.key) || m.key.toLowerCase() === key.toLowerCase());
        return { name: t.name, keys: t.keys.replace(/\\[bs]|\\\.|\?/g, "").split("|").slice(0, 4).join(", "), val: c ? c.val : "url:" + t.url, key, changed: !!c };
      });
      custom.filter((m) => !THEMEN.some((t) => t.re.test(m.key))).forEach((m) => items.push({ name: m.key, keys: m.key, val: m.val, key: m.key, changed: true }));
      return items;
    }
    _openBilderListe() {
      const items = this._bilderItems();
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
        remove: async () => { await this._setPhotoValue(p, ""); this._modal(""); },
        edit: () => this._openPerson(p),
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
        <div class="dlg-f">${p.extra ? `<button class="btn ghost" data-m="edit">Name &amp; Kalender</button>` : ""}${img ? `<button class="btn ghost" data-m="remove">Foto entfernen</button><button class="btn ghost" data-m="crop">Ausschnitt</button>` : ""}<span class="sp"></span><button class="btn ghost" data-m="close">Abbrechen</button><button class="btn" data-m="pick">Foto wählen</button></div>`);
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
          await this._setPhotoValue(p, `${cropId}|${origId}|${z.toFixed(2)}|${cx.toFixed(3)}|${cy.toFixed(3)}`);
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
  .wcorner { display:flex; flex-direction:column; justify-content:flex-end; gap:8px; align-self:stretch; }
  .addp { display:inline-flex; align-items:center; gap:5px; align-self:flex-start; margin-left:8px; padding:6px 10px; border-radius:10px; border:1.5px dashed var(--ink3); color:var(--ink2); font-size:13px; font-weight:600; }
  .addp ha-icon { --mdc-icon-size:18px; }
  .addp:active { background:var(--soft); }
  .whead .wcorner .famlegend { padding-bottom:0; }
  .farben.left { justify-content:flex-start; max-width:none; }
  .farben.left .lbl { text-align:left; }
  .calpick { display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:6px; max-height:220px; overflow:auto; }
  .calpick label, .chk { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:10px; background:var(--soft); font-size:14px; cursor:pointer; }
  .dlg-b .calpick input, .dlg-b .chk input { width:20px; height:20px; padding:0; margin:0; border:0; flex:none; accent-color:var(--accent); }
  .chk { background:none; padding:4px 0; }
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
  /* «Bald» für Kinder: Bild, Name, Monde oder grosse Zahl */
  .kidsoon { gap:8px; }
  .kidsoon li { gap:10px; padding:6px 8px 6px 6px; border-radius:14px; background:var(--soft); align-items:center; }
  .kidsoon li.heute { background:color-mix(in srgb, #f2b400 25%, var(--paper)); box-shadow:inset 0 0 0 2px #f2b400; }
  .bpic { width:46px; height:46px; border-radius:12px; overflow:hidden; flex:none; display:grid; place-items:center; font-size:32px; line-height:1; background:var(--paper); }
  .bpic img { width:100%; height:100%; object-fit:cover; display:block; }
  .btxt { display:flex; flex-direction:column; min-width:0; flex:1; gap:2px; }
  .btxt b { font-size:15px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .bwhen { display:flex; align-items:baseline; gap:6px; flex-wrap:wrap; }
  .bmoons { font-size:19px; line-height:1; letter-spacing:1px; }
  .bnum { font-family:var(--f-disp); font-size:24px; font-weight:800; line-height:1; color:var(--ink); }
  .bsmall { font-size:12px; font-weight:600; color:var(--ink2); }
  .bheute { font-family:var(--f-disp); font-size:19px; font-weight:800; color:#c48a00; }
  .dark .bheute { color:#ffd866; }
  .soon[data-act] { cursor:pointer; }
  .soon[data-act]:active { transform:scale(.99); }
  .sbig { display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:18px; align-content:start; }
  .sbcard { display:flex; flex-direction:column; align-items:center; gap:8px; padding:22px 14px 18px; border-radius:26px; background:var(--paper); box-shadow:0 4px 12px rgba(0,0,0,.08); text-align:center; }
  .sbcard.heute { background:#fff1bf; box-shadow:0 0 0 4px #f2b400; }
  .dark .sbcard.heute { background:#3d3311; }
  .sbcard b { font-size:20px; font-weight:800; line-height:1.2; }
  .sbcard .bwhen { justify-content:center; }
  .sbcard .bnum { font-size:44px; }
  .sbcard .bheute { font-size:28px; }
  .sbcard .bsmall { font-size:16px; }
  .sbcard small { color:var(--ink2); font-size:14px; font-weight:600; }
  .sbpic { width:120px; height:100px; border-radius:22px; overflow:hidden; display:grid; place-items:center; font-size:76px; line-height:1; background:var(--soft); }
  .sbpic img { width:100%; height:100%; object-fit:cover; display:block; }
  .hoch .kidsoon { gap:6px; }
  .hoch .kidsoon li { padding:4px 6px 4px 4px; gap:8px; }
  .hoch .bpic { width:40px; height:40px; font-size:28px; border-radius:10px; }
  .hoch .btxt b { font-size:14px; }
  .hoch .bmoons, .hoch .bheute { font-size:17px; }
  .hoch .bnum { font-size:20px; }
  .hoch .soon .abf { margin-top:6px; padding-top:6px; }
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
  /* Kinder-Ansicht */
  #kid:empty, #party:empty { display:none; }
  .kidview { position:fixed; inset:0; z-index:15; background:var(--bg); color:var(--ink); font-family:var(--f-ui); overflow:auto; animation:pop .18s ease-out;
    --f-ui:'Figtree', system-ui, -apple-system, sans-serif; --f-disp:'Bricolage Grotesque', 'Figtree', system-ui, sans-serif; --accent:#1d2430;
    --bg:#fff9ec; --paper:#ffffff; --ink:#1d2430; --ink2:#5b6676; --ink3:#a0a8b4; --soft:#f4ecd9; --line:#eadfc6; --jarbg:#fff4cf; --jarline:#c9b37a; --jarlid:#b08d4a; }
  .kidview.dark { --bg:#141a22; --paper:#1d2530; --ink:#eef2f6; --ink2:#a9b3c0; --ink3:#6e7887; --soft:#26303d; --line:#2f3a48; --jarbg:#2a2f36; --jarline:#8d7d55; --jarlid:#7a6334; }
  .kwrap { min-height:100%; display:flex; flex-direction:column; padding:20px 24px 28px; gap:18px; }
  .khead { display:flex; align-items:center; gap:16px; }
  .kname { font-family:var(--f-disp); font-size:40px; font-weight:800; flex:1; display:flex; align-items:center; gap:14px; }
  .kav { display:inline-grid; place-items:center; border-radius:50%; overflow:hidden; background:var(--c); color:#fff; font-family:var(--f-disp); font-weight:800; flex:none; box-shadow:0 0 0 4px var(--paper), 0 0 0 7px var(--c); }
  .kav img { width:100%; height:100%; object-fit:cover; }
  .khead .kav { font-size:40px; }
  .kbtn { width:64px; height:64px; border-radius:20px; background:var(--paper); font-size:30px; display:grid; place-items:center; box-shadow:0 2px 6px rgba(0,0,0,.08); text-align:center; }
  .kbtn.close { background:var(--ink); color:var(--bg); font-size:28px; font-weight:800; }
  .fire { font-size:14px; font-weight:800; color:#e8590c; margin-left:4px; }
  .fire.big { font-size:26px; background:#fff0e0; padding:4px 12px; border-radius:16px; }
  .dark .fire.big { background:#3a2614; }
  /* Essen: zwei Mahlzeiten, Bewertung, Essens-Ansicht, Kochmodus */
  .meal.two { font-size:12px; margin-top:0; padding:2px 6px; }
  .meal.two span { -webkit-line-clamp:1; }
  .meal.big.two { min-width:140px; max-width:38%; margin-left:6px; }
  .meal.big.two:first-of-type { margin-left:auto; }
  .rateband { position:relative; display:flex; align-items:center; gap:18px; flex-wrap:wrap; margin:0 0 10px; padding:10px 54px 10px 16px; border-radius:20px; background:var(--paper); box-shadow:0 2px 8px rgba(0,0,0,.08), inset 0 0 0 2px #f2b400; }
  .rbq { display:flex; flex-direction:column; min-width:150px; }
  .rbt { font-size:13px; font-weight:700; color:var(--ink2); }
  .rbq b { font-family:var(--f-disp); font-size:20px; font-weight:800; }
  .rbp { display:flex; gap:14px; flex-wrap:wrap; }
  .rbperson { display:flex; align-items:center; gap:4px; padding:4px 8px 4px 4px; border-radius:30px; background:var(--soft); }
  .rbperson .kav { font-size:18px; box-shadow:0 0 0 2px var(--paper), 0 0 0 4px var(--c); margin-right:4px; }
  .rbf { font-size:30px; line-height:1; width:44px; height:44px; border-radius:50%; display:grid; place-items:center; transition:transform .15s; }
  .rbf.on { background:#ffe28a; transform:scale(1.15); }
  .rbf.dim { opacity:.35; }
  .rbf:active { transform:scale(.9); }
  .rbx { position:absolute; right:10px; top:50%; transform:translateY(-50%); width:36px; height:36px; border-radius:50%; background:var(--soft); color:var(--ink2); font-weight:800; }
  .mealrec { display:flex; gap:8px; margin:8px 0 2px; }
  .mchip.new button { background:#fff1bf; }
  .dark .mchip.new button { background:#4a3c12; }
  .fillist label { display:flex; align-items:baseline; gap:10px; width:100%; }
  .fillist small { color:var(--ink2); font-size:12px; margin-left:auto; text-align:right; }
  .esstools { display:flex; gap:10px; flex-wrap:wrap; }
  .essweek { display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:12px; }
  .essday { display:flex; flex-direction:column; gap:8px; padding:12px; border-radius:20px; background:var(--paper); box-shadow:0 1px 3px rgba(0,0,0,.05); }
  .essday.today { box-shadow:0 0 0 3px #f2b400; }
  .essdh { display:flex; align-items:baseline; gap:8px; }
  .essdh b { font-family:var(--f-disp); font-size:19px; }
  .essdh span { color:var(--ink2); font-size:13px; font-weight:600; }
  .essslot { position:relative; display:flex; align-items:center; gap:10px; padding:8px; border-radius:14px; background:var(--soft); text-align:left; min-height:62px; }
  .essslot.empty { color:var(--ink3); }
  .esst { display:flex; flex-direction:column; gap:2px; min-width:0; flex:1; }
  .esst small { font-size:12px; color:var(--ink2); font-weight:600; }
  .esst b { font-size:15px; font-weight:700; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
  .essimg { width:58px; height:46px; border-radius:10px; overflow:hidden; flex:none; background:var(--line); display:block; }
  .essimg img { width:100%; height:100%; object-fit:cover; display:block; }
  .essimg.big { width:100%; height:130px; border-radius:14px; }
  .esscook { font-size:24px; padding:4px; }
  .essfaces { display:flex; gap:2px; font-size:15px; }
  .essfaces i { font-style:normal; }
  .essfaces.big { gap:10px; }
  .essfaces.big span { display:flex; flex-direction:column; align-items:center; }
  .essfaces.big i { font-size:28px; }
  .essfaces.big small { font-size:11px; color:var(--ink2); font-weight:600; }
  .essno { width:34px; font-family:var(--f-disp); font-size:22px; font-weight:800; color:var(--ink3); text-align:center; }
  .esssearch { display:flex; gap:10px; }
  .esssearch input { flex:1; font:inherit; font-size:16px; padding:12px 14px; border-radius:14px; border:1px solid var(--line); background:var(--paper); color:var(--ink); }
  .essgrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px; }
  .esscard { display:flex; flex-direction:column; gap:6px; padding:10px; border-radius:18px; background:var(--paper); text-align:left; box-shadow:0 1px 3px rgba(0,0,0,.05); }
  .esscard b { font-size:15px; }
  .esscard small { color:var(--ink2); font-size:12px; }
  .esshelp { margin:4px 0 0; padding-left:20px; display:flex; flex-direction:column; gap:6px; font-size:14px; }
  .recipehead { display:grid; grid-template-columns:minmax(160px, 260px) 1fr; gap:16px; align-items:start; }
  .recipehead .essimg.big { height:170px; }
  .ingl { margin:6px 0 0; padding-left:20px; columns:2; column-gap:24px; font-size:15px; line-height:1.5; }
  .planpick { display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:8px; }
  .planpick button { display:flex; flex-direction:column; align-items:flex-start; gap:2px; padding:10px; border-radius:12px; background:var(--soft); text-align:left; }
  .planpick button.taken { opacity:.65; }
  .planpick small { color:var(--ink2); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
  .shoppick { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:6px 14px; margin-top:8px; }
  .shoppick label { display:flex; align-items:flex-start; gap:8px; padding:6px 4px; font-size:15px; }
  .shoppick label.have { opacity:.6; }
  .shoppick small { color:var(--ink2); font-size:12px; }
  .cookmain { flex:1; min-height:0; display:grid; grid-template-columns:minmax(240px, 34%) 1fr; gap:24px; }
  .cooking { overflow:auto; padding:16px; border-radius:22px; background:var(--paper); }
  .cookpor { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px; }
  .cookpor .kbtn { width:48px; height:48px; font-size:24px; }
  .cookpor b { font-size:18px; }
  .cooking ul { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; }
  .cooking li { padding:10px 12px; border-radius:12px; font-size:17px; background:var(--soft); cursor:pointer; }
  .cooking li.done { text-decoration:line-through; opacity:.5; }
  .cookstep { display:flex; flex-direction:column; gap:16px; padding:24px; border-radius:22px; background:var(--paper); overflow:auto; }
  .cookn { font-size:15px; font-weight:700; color:var(--ink2); }
  .cooktext { flex:1; margin:0; font-size:clamp(22px, 2.6vw, 34px); line-height:1.45; font-weight:500; }
  .cooktm { display:flex; gap:10px; flex-wrap:wrap; }
  .cooknav { display:flex; justify-content:space-between; gap:12px; }
  .btn.big { padding:16px 28px; font-size:20px; border-radius:16px; }
  .btn:disabled { opacity:.35; }
  .cooktimer { display:inline-flex; align-items:center; gap:6px; padding:10px 16px; border-radius:16px; background:var(--paper); font-size:20px; cursor:pointer; }
  .cooktimer.ring { background:#ffe28a; color:#1d2430; animation:bdhop .6s ease-in-out infinite; }
  @media (max-width: 760px) { .cookmain, .recipehead { grid-template-columns:1fr; } .ingl { columns:1; } }
  /* Geburtstag */
  .bdband { position:relative; overflow:hidden; display:flex; align-items:center; gap:18px; flex-wrap:wrap; margin:0 0 10px; padding:10px 16px; border-radius:20px; cursor:pointer;
    background:linear-gradient(100deg, #fff1bf, #ffd6e7 55%, #d9ecff); color:#1d2430; box-shadow:0 2px 8px rgba(0,0,0,.08); }
  .dark .bdband { background:linear-gradient(100deg, #4a3c12, #4a1f33 55%, #1c3550); color:#fff; }
  .bdm { position:relative; display:flex; align-items:center; gap:12px; }
  .bdm .kav { font-size:22px; box-shadow:0 0 0 3px #fff, 0 0 0 5px var(--c); }
  .bdm b { display:block; font-family:var(--f-disp); font-size:22px; font-weight:800; }
  .bdm small { font-size:14px; font-weight:700; opacity:.75; }
  .bdo { position:relative; font-size:15px; font-weight:700; }
  .bdconf i { position:absolute; top:-10px; width:7px; height:12px; border-radius:2px; opacity:.8; animation:bdfall 3.2s linear infinite; }
  @keyframes bdfall { to { transform:translateY(90px) rotate(320deg); opacity:0; } }
  .av .ring { position:relative; }
  .avb { position:absolute; right:-8px; top:-8px; font-size:22px; line-height:1; filter:drop-shadow(0 1px 2px rgba(0,0,0,.3)); animation:bdhop 1.6s ease-in-out infinite; }
  @keyframes bdhop { 50% { transform:translateY(-4px) rotate(-8deg); } }
  .ppic.round { width:200px; height:200px; border-radius:50%; }
  .ppic.round img { width:100%; height:100%; object-fit:cover; }
  /* Nachtmodus */
  #night:empty { display:none; }
  .night { position:fixed; inset:0; z-index:18; background:#000; color:#7d8794; font-family:'Figtree', system-ui, sans-serif; display:grid; place-items:center; overflow:hidden; cursor:pointer; }
  .night .nwrap { text-align:center; transition:transform 2s ease; }
  .night .nclock { font-family:'Bricolage Grotesque', 'Figtree', sans-serif; font-size:min(30vw, 260px); font-weight:700; line-height:1; letter-spacing:-.02em; color:#9aa4b1; }
  .night .ndate { font-size:min(5vw, 36px); margin-top:10px; }
  .night .nnext { font-size:min(4vw, 26px); margin-top:22px; color:#5f6976; display:flex; align-items:center; justify-content:center; gap:8px; }
  .night .nnext ha-icon { --mdc-icon-size:30px; }
  .night.fotos { place-items:stretch; }
  .nimg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:0; transition:opacity 2.5s ease; filter:brightness(.8); }
  .nimg.on { opacity:1; animation:kb 22s ease-out forwards; }
  @keyframes kb { from { transform:scale(1.02); } to { transform:scale(1.1); } }
  .nsmall { position:absolute; left:28px; bottom:24px; display:flex; flex-direction:column; color:#fff; text-shadow:0 2px 10px rgba(0,0,0,.6); }
  .nsmall .nclock { font-size:64px; color:#fff; }
  .nsmall .ndate { font-size:20px; margin:0; }
  .settimes { display:flex; align-items:center; gap:14px; flex-wrap:wrap; font-size:15px; font-weight:600; }
  .settimes input { font:inherit; padding:8px 10px; border-radius:10px; border:1px solid var(--line); background:var(--bg); color:var(--ink); }
  /* Einstellungen */
  .homebtn.wide { width:100px; }
  .kidview.setview { --bg:#f3f5f8; --soft:#e9edf2; --line:#dde2e8; }
  .kidview.setview.dark { --bg:#11161d; --soft:#232c37; --line:#2f3a48; }
  .setwrap { height:100%; min-height:0; }
  .setmain { flex:1; min-height:0; display:grid; grid-template-columns:230px 1fr; gap:22px; }
  .setnav { display:flex; flex-direction:column; gap:6px; }
  .setnav button { display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:16px; font-size:17px; font-weight:700; color:var(--ink2); text-align:left; }
  .setnav button span { font-size:24px; width:30px; text-align:center; }
  .setnav button.on { background:var(--paper); color:var(--ink); box-shadow:0 2px 6px rgba(0,0,0,.06); }
  .setbody { overflow:auto; display:flex; flex-direction:column; gap:14px; padding:2px 2px 20px; }
  .setlist { display:flex; flex-direction:column; gap:10px; }
  .setrow { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:18px; background:var(--paper); box-shadow:0 1px 3px rgba(0,0,0,.05); flex-wrap:wrap; }
  .setrow.off { opacity:.6; }
  .setrow .kav { font-size:24px; box-shadow:0 0 0 3px var(--paper), 0 0 0 5px var(--c); margin:0 6px 0 4px; }
  .settxt { flex:1; min-width:150px; display:flex; flex-direction:column; gap:3px; }
  .settxt b { font-size:18px; }
  .settxt span { font-size:13px; color:var(--ink2); }
  .setrow .btn { padding:12px 16px; font-size:15px; }
  .setdel { width:44px; height:44px; border-radius:12px; font-size:20px; display:grid; place-items:center; background:color-mix(in srgb, #c92a2a 12%, var(--paper)); }
  .setdel.ph { background:none; }
  .setadd { align-self:flex-start; padding:12px 18px; font-size:15px; }
  .sethint { margin:0; color:var(--ink2); font-size:14px; }
  .setcard { display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:16px; border-radius:18px; background:var(--paper); box-shadow:0 1px 3px rgba(0,0,0,.05); }
  .setcard.col { flex-direction:column; align-items:flex-start; }
  .setcard > b { font-size:17px; }
  .setcard > span { flex:1; color:var(--ink2); font-size:14px; }
  .setchips { display:flex; flex-wrap:wrap; gap:8px; }
  .setchip { display:inline-flex; align-items:center; gap:6px; padding:6px 6px 6px 12px; border-radius:12px; background:var(--soft); font-size:14px; font-weight:600; }
  .setchip small { color:var(--ink2); font-weight:500; }
  .setchip button { width:28px; height:28px; border-radius:8px; background:var(--paper); font-size:13px; font-weight:700; color:var(--ink2); }
  .seg.big { flex-wrap:wrap; }
  .seg.big button { padding:10px 16px; font-size:15px; }
  .setview .blist { max-height:none; }
  @media (max-width: 760px) { .homebtn.wide { width:76px; } .homebtn.wide span { font-size:9px; } .setmain { grid-template-columns:1fr; } .setnav { flex-direction:row; overflow-x:auto; } .setnav button { padding:10px 12px; font-size:14px; white-space:nowrap; } }
  .kmain { display:grid; grid-template-columns:minmax(220px, 300px) 1fr; gap:24px; align-items:start; }
  .kleft { display:flex; flex-direction:column; align-items:center; gap:12px; position:sticky; top:0; }
  .jar { width:100%; max-width:220px; height:auto; }
  .kcount { font-family:var(--f-disp); font-size:44px; font-weight:800; color:#e0a200; line-height:1; }
  .kreward { display:flex; align-items:center; gap:12px; width:100%; padding:12px; border-radius:20px; background:var(--paper); font-size:18px; font-weight:700; box-shadow:0 2px 6px rgba(0,0,0,.06); }
  .kreward span:last-child { display:flex; flex-direction:column; line-height:1.2; }
  .kreward small { color:var(--ink2); font-weight:600; font-size:15px; }
  .kreward.ready { background:#fff1bf; box-shadow:0 0 0 4px #f2b400; animation:wiggle 1.2s ease-in-out infinite; }
  .dark .kreward.ready { background:#3d3311; }
  @keyframes wiggle { 0%,100% { transform:rotate(0); } 25% { transform:rotate(-2deg); } 75% { transform:rotate(2deg); } }
  .krpic { width:72px; height:56px; border-radius:14px; overflow:hidden; flex:none; display:grid; place-items:center; font-size:42px; background:var(--soft); }
  .krpic img, .kstpic img, .ppic img { width:100%; height:100%; object-fit:cover; display:block; }
  .kconfirm { width:100%; padding:14px; border-radius:16px; background:var(--ink); color:var(--bg); font-weight:700; font-size:16px; text-align:center; }
  .ksect { font-family:var(--f-disp); font-size:24px; margin:4px 0 10px; }
  .kright { display:flex; flex-direction:column; gap:6px; min-width:0; }
  .kcards { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:14px; margin-bottom:12px; }
  .kcard { position:relative; display:flex; flex-direction:column; align-items:center; gap:8px; padding:18px 10px 14px; border-radius:24px; background:var(--paper); box-shadow:0 3px 8px rgba(0,0,0,.07); text-align:center; transition:transform .12s; }
  .kcard:active { transform:scale(.95); }
  .kpic { font-size:64px; line-height:1; }
  .kpic.s { font-size:28px; }
  .ktxt { font-size:18px; font-weight:700; }
  .kstate { position:absolute; top:10px; right:12px; font-size:22px; }
  .kcard.ok { background:#d8f5df; box-shadow:0 0 0 4px #2f9e44; }
  .kcard.ok .kstate { color:#2f9e44; font-weight:900; font-size:30px; }
  .kcard.wait { background:#fff3cd; box-shadow:0 0 0 4px #f2b400; }
  .dark .kcard.ok { background:#16351f; } .dark .kcard.wait { background:#3d3311; }
  .kgoals { display:flex; flex-direction:column; gap:12px; }
  .kgoal { display:flex; align-items:center; gap:14px; padding:14px 16px; border-radius:22px; background:var(--paper); box-shadow:0 3px 8px rgba(0,0,0,.07); }
  .kgoal .kpic { font-size:52px; }
  .kgoal.fertig { background:#fff1bf; } .dark .kgoal.fertig { background:#3d3311; }
  .kgbody { flex:1; display:flex; flex-direction:column; gap:6px; min-width:0; }
  .kgbody b { font-size:19px; }
  .kgbody small { color:var(--ink2); font-size:14px; font-weight:600; }
  .kgjar { position:relative; width:78px; flex:none; display:flex; flex-direction:column; align-items:center; }
  .kgjar .jar { width:78px; }
  .kgjn { font-family:var(--f-disp); font-weight:800; font-size:16px; color:#c48a00; margin-top:-2px; }
  .kgic { font-size:24px; vertical-align:-3px; }
  .kgoal.fertig .kgjar .jar { filter:drop-shadow(0 0 8px #f2b400); }
  .kreset { padding:4px 9px; border-radius:9px; background:var(--paper); font-size:13px; font-weight:700; color:var(--ink2); white-space:nowrap; }
  .kgstars { display:flex; flex-wrap:wrap; gap:2px; font-size:26px; line-height:1; color:var(--line); }
  .kgstars span.on { color:#f2b400; }
  .kgstars span.wait { color:#f2b400; opacity:.4; }
  .kgrew { display:flex; flex-direction:column; align-items:center; gap:2px; font-size:13px; font-weight:700; color:var(--ink2); max-width:96px; text-align:center; }
  .kgrpic { width:64px; height:52px; border-radius:14px; overflow:hidden; display:grid; place-items:center; font-size:44px; background:var(--soft); }
  .kgrpic img { width:100%; height:100%; object-fit:cover; }
  .kgbtn.again { background:var(--soft); color:var(--ink); }
  .krowmain { display:flex; align-items:center; gap:10px; flex:1; min-width:0; text-align:left; }
  .stgoals { display:flex; flex-wrap:wrap; gap:6px; }
  .stgoals span { font-size:12.5px; font-weight:700; padding:3px 8px; border-radius:10px; background:var(--paper); }
  .kdots { display:flex; flex-wrap:wrap; gap:5px; }
  .kdots span { width:18px; height:18px; border-radius:50%; background:var(--soft); box-shadow:inset 0 0 0 2px var(--line); }
  .kdots span.on { background:#f2b400; box-shadow:none; }
  .kgbtn { padding:16px 20px; border-radius:18px; background:var(--c); color:#fff; font-weight:800; font-size:20px; white-space:nowrap; min-width:92px; text-align:center; }
  .kgbtn.done { background:var(--soft); color:var(--ink2); }
  .kalbum { display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:12px; }
  .kst { display:flex; flex-direction:column; align-items:center; gap:4px; padding:12px; border-radius:20px; background:var(--paper); transform:rotate(-2deg); box-shadow:0 3px 8px rgba(0,0,0,.08); text-align:center; font-weight:700; }
  .kst:nth-child(2n) { transform:rotate(2deg); }
  .kst small { color:var(--ink3); }
  .kstpic { width:84px; height:64px; border-radius:14px; overflow:hidden; display:grid; place-items:center; font-size:52px; }
  .khint { color:var(--ink2); font-size:17px; }
  .kback { align-self:flex-start; padding:12px 16px; border-radius:14px; background:var(--paper); font-weight:700; margin-top:8px; }
  .starsp.tile { cursor:pointer; text-align:left; width:100%; }
  .hoch .side.tileonly { grid-template-columns:1fr 1.3fr .62fr; }
  .quer .starsp.tile .tilebody { flex-direction:row; justify-content:flex-start; }
  .starsp.tile:active { transform:scale(.98); }
  .tilebody { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:4px 0 6px; }
  .tilestar { font-size:46px; line-height:1; }
  .tilekids { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
  .tilekids .kav { font-size:20px; box-shadow:0 0 0 3px var(--paper), 0 0 0 5px var(--c); }
  .tilehint { font-size:13px; font-weight:700; color:var(--ink2); text-align:center; }
  .kmenu { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:22px; align-content:start; }
  .kmcard { display:flex; flex-direction:column; align-items:center; gap:10px; padding:28px 18px 22px; border-radius:30px; background:var(--paper); box-shadow:0 4px 12px rgba(0,0,0,.08), inset 0 -6px 0 color-mix(in srgb, var(--c) 35%, transparent); text-align:center; }
  .kmcard:active { transform:scale(.97); }
  .kmcard .kav { font-size:56px; }
  .kmname { font-family:var(--f-disp); font-size:34px; font-weight:800; margin-top:6px; }
  .kmstars { font-family:var(--f-disp); font-size:30px; font-weight:800; color:#e0a200; display:flex; flex-direction:column; align-items:center; }
  .kmstars small { font-family:var(--f-ui); font-size:15px; color:var(--ink2); font-weight:700; }
  .kminfo { font-size:15px; font-weight:600; color:var(--ink2); }
  .kmgoals { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; }
  .kmgoals span { font-size:15px; font-weight:700; padding:4px 10px; border-radius:12px; background:var(--soft); }
  .kidopen { display:flex; align-items:center; gap:8px; font-weight:700; font-size:14px; margin-right:auto; padding:2px 6px 2px 2px; border-radius:20px; }
  .kidopen ha-icon { --mdc-icon-size:18px; color:var(--ink3); }
  .kidopen .kav { box-shadow:0 0 0 2px var(--paper), 0 0 0 4px var(--c); font-size:14px; }
  /* Feier */
  .party { position:fixed; inset:0; z-index:30; display:grid; place-items:center; background:rgba(12,18,26,.55); overflow:hidden; }
  .confetti { position:absolute; inset:0; pointer-events:none; }
  .confetti i { position:absolute; top:-20px; width:12px; height:18px; border-radius:3px; animation-name:fall; animation-timing-function:linear; animation-iteration-count:1; animation-fill-mode:both; }
  @keyframes fall { to { top:105%; transform:translateX(40px) rotate(720deg); } }
  .pbox { position:relative; background:#fff; color:#1d2430; border-radius:32px; padding:32px 40px 22px; text-align:center; box-shadow:0 0 0 8px var(--c), 0 30px 80px rgba(0,0,0,.35); animation:boom .5s cubic-bezier(.2,1.6,.4,1); max-width:min(560px, 90vw); }
  @keyframes boom { from { transform:scale(.3); opacity:0; } }
  .ppic { width:220px; height:160px; margin:0 auto 10px; border-radius:24px; overflow:hidden; display:grid; place-items:center; font-size:130px; line-height:1; }
  .pbox h2 { margin:6px 0 4px; font-family:'Bricolage Grotesque', sans-serif; font-size:40px; }
  .pbox p { margin:0 0 8px; font-size:20px; color:#5b6676; }
  .pbox small { color:#97a1ae; }
  /* Eltern-Code */
  .pindots { display:flex; gap:14px; justify-content:center; margin:6px 0; }
  .pindots span { width:18px; height:18px; border-radius:50%; box-shadow:inset 0 0 0 2px var(--ink3); }
  .pindots span.on { background:var(--ink); box-shadow:none; }
  .pinpad { display:grid; grid-template-columns:repeat(3, 72px); gap:10px; justify-content:center; }
  .pinpad button { height:60px; border-radius:16px; background:var(--soft); font-size:24px; font-weight:700; text-align:center; }
  /* Eltern-Einstellungen */
  .ktabs { align-self:flex-start; }
  .klist { display:flex; flex-direction:column; gap:6px; }
  .krow { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:12px; background:var(--soft); font-size:15px; font-weight:600; }
  .krow small { margin-left:auto; color:var(--ink2); font-weight:500; }
  .krow .nope { color:var(--ink3); padding:4px 8px; font-size:16px; }
  .kown { display:flex; gap:8px; align-items:center; }
  .kown input { flex:1; }
  .kown select { font:inherit; font-size:15px; padding:11px 8px; border-radius:12px; border:1.5px solid var(--line); background:var(--bg); color:var(--ink); }
  .emo.small { grid-template-columns:repeat(10, 1fr); }
  .emo.small button { font-size:20px; border-radius:10px; }
  @media (max-width: 700px) { .kmain { grid-template-columns:1fr; } .kleft { position:static; } .kname { font-size:28px; } .kpic { font-size:48px; } }
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
  window.customCards.push({ type: "familienplaner-card", name: "Familienplaner", description: "Wochenplan der Familie mit Essen, Einkauf und Ämtli / Family week planner with meals, shopping and chores" });
  console.info(`%c FAMILIENPLANER %c ${VERSION} `, "background:#18212d;color:#fff;border-radius:4px 0 0 4px;padding:2px 4px", "background:#f2c200;color:#18212d;border-radius:0 4px 4px 0;padding:2px 4px");
})();
