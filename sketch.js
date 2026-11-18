let satellites = [];
let selectedYear = 2023; // La timeline ora è controllata dall'utente (1957–2023)
let viewMode = "home"; // home → zoom orbita → dettaglio satellite
let selectedOrbit = null;
let orbitList = [];
let orbitPosition = 0;
let zoomPoints = [];
let hoverSatellite = null;
let detailSatellite = null;
let playTimer = null;
let drag = null;
const ORBIT_NAMES = { HEO: "HIGH ELLIPTICAL", GEO: "GEOSTATIONARY", MEO: "MEDIUM EARTH", LEO: "LOW EARTH" };
const tilt = -0.4;
const MONO = '"IBM Plex Mono Locale", "IBM Plex Mono", monospace';

const colors = {
  "Commerciale": "#93c572",
  "Governativo": "#6894e9",
  "Militare": "#ed8395",
  "Civile": "#c49ce7",
  "Altro / ibridi": "#57d0bd"
};

const surface = document.getElementById("orbitSurface");
const element = id => document.getElementById(id);

function setup() {
  let canvas = createCanvas(surface.clientWidth, surface.clientHeight);
  canvas.parent("orbitSurface");
  canvas.id("orbitCanvas");
  noLoop();
  attachInteractions(canvas.elt);
  updateTimelineUI();
  updateViewUI();

  // Ridisegno quando il font del grafico è pronto
  document.fonts.load('9px "IBM Plex Mono Locale"').then(() => redraw());

  // Carico il dataset da assets/satelliti.csv (serve Live Server)
  fetch("assets/satelliti.csv")
    .then(response => {
      if (!response.ok) throw new Error("file non trovato");
      return response.text();
    })
    .then(text => loadData(readUCS(text)))
    .catch(error => alert("Impossibile caricare satelliti.csv: " + error.message));
}

function draw() {
  background("#0b1314");
  drawGrid();
  updateStatsPanel();
  if (viewMode === "home") {
    drawOrbits();
  } else {
    drawZoom(viewMode === "detail");
  }
}

function drawGrid() {
  stroke(111, 142, 136, 17);
  strokeWeight(1);
  for (let x = 0.5; x < width; x += 32) line(x, 0, x, height);
  for (let y = 0.5; y < height; y += 32) line(0, y, width, y);
}

function drawOrbits() {
  let cx = width * 0.5;
  let cy = height * 0.51;
  let radius = Math.min(width * 0.36, height * 0.465, 350);
  let ellipseA = radius * 0.98;
  let ellipseB = radius * 0.56;

  // Orbita HEO tratteggiata
  push();
  translate(cx, cy);
  rotate(tilt);
  noFill();
  stroke("#516360");
  drawingContext.setLineDash([4, 6]);
  ellipse(0, 0, ellipseA * 2, ellipseB * 2);
  drawingContext.setLineDash([]);
  pop();

  // Orbite LEO, MEO e GEO
  for (let orbit of [{ name: "LEO", size: 0.60 }, { name: "MEO", size: 0.80 }, { name: "GEO", size: 0.955 }]) {
    noFill();
    stroke("#536461");
    circle(cx, cy, radius * orbit.size * 2);

    noStroke();
    fill("#aab8b4");
    textFont(MONO);
    textSize(9);
    textAlign(CENTER, BASELINE);
    text(orbit.name, cx, cy - radius * orbit.size - 9);
  }

  // Scritta HEO vicino all'ellisse
  let t = -0.1;
  let ex = Math.cos(t) * ellipseA;
  let ey = Math.sin(t) * ellipseB;
  let labelX = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt);
  let labelY = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
  noStroke();
  fill("#99a8a3");
  textFont(MONO);
  textSize(9);
  textAlign(LEFT, BOTTOM);
  text("HEO", labelX + 6, labelY - 4);

  // Terra
  fill("#e0e8e5");
  circle(cx, cy, 10);
}

function drawSatellites() {
  let cx = width * 0.5;
  let cy = height * 0.51;
  let radius = Math.min(width * 0.36, height * 0.465, 350);
  let visible = 0;

  noStroke();
  for (let i = 0; i < satellites.length; i++) {
    let sat = satellites[i];
    if (sat.year !== null && sat.year > selectedYear) continue;

    let p = positionFor(sat, i, cx, cy, radius);
    fill(colors[sat.category] || "#d3dad7");
    circle(p.x, p.y, Math.max(2.28, Math.min(2.96, radius / 95)));
    visible++;
  }

  element("visibleCount").textContent = formatNumber(visible);
}

function positionFor(sat, i, cx, cy, radius) {
  let angle = randomFixed(i, 1) * TWO_PI;
  let distance = randomFixed(i, 2);

  if (sat.orbit == "HEO") {
    let x = Math.cos(angle) * (0.78 + 0.18 * distance) * radius;
    let y = Math.sin(angle) * (0.48 + 0.075 * distance) * radius;
    return { x: cx + x * Math.cos(tilt) - y * Math.sin(tilt),
             y: cy + x * Math.sin(tilt) + y * Math.cos(tilt) };
  }

  let r;
  if (sat.orbit == "LEO") r = (0.08 + Math.sqrt(distance) * 0.51) * radius;
  else if (sat.orbit == "MEO") r = (0.64 + distance * 0.14) * radius;
  else if (sat.orbit == "GEO") r = (0.86 + distance * 0.082) * radius;
  else r = (0.61 + distance * 0.34) * radius;

  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}

// Numero fisso per ogni satellite: stesso indice, stessa posizione
function randomFixed(index, salt) {
  let n = Math.imul(index + 1, 374761393) ^ Math.imul(salt + 1, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function windowResized() {
  resizeCanvas(surface.clientWidth, surface.clientHeight);
  if (viewMode !== "home") {
    orbitPosition = Math.min(orbitPosition, orbitMaxPosition());
    updateOrbitSlider();
  }
  redraw();
}

function loadData(records) {
  satellites = records;
  rebuildOrbitList();
  updateStatsPanel();
  redraw();
}

// Lettura e normalizzazione del database CSV
// Legge un CSV, anche con virgole tra virgolette o celle su più righe
function parseCSV(csv) {
  csv = csv.replace(/^\uFEFF/, "");
  let rows = [], row = [], cell = "", quoted = false;
  for (let i = 0; i < csv.length; i++) {
    let ch = csv[i];
    if (ch === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && csv[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

// Uniformo le intestazioni: non contano spazi, maiuscole e accenti
function normalize(text) {
  return String(text || "").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

// Trasforma il CSV dell'UCS in un array di satelliti
function readUCS(csv) {
  let rows = parseCSV(csv);
  if (rows.length < 2) throw new Error("Il CSV non contiene righe utili.");
  let headers = rows.shift().map(normalize);

  let result = [];
  for (let row of rows) {
    // Creo un oggetto con le colonne della riga
    let record = {};
    headers.forEach((name, i) => record[name] = (row[i] || "").trim());
    let get = (...names) => {
      for (let name of names) if (record[normalize(name)]) return record[normalize(name)];
      return "";
    };

    let name = get("Current Official Name of Satellite", "Name of Satellite", "Name");
    if (!name) continue;

    // Prendo l'anno di lancio dalla data (gg/mm/aaaa)
    let year = parseInt(get("Date of Launch").split("/").pop(), 10);

    // Decido la categoria in base agli utilizzatori
    let users = get("Users").toLowerCase();
    let orbitText = get("Class of Orbit").toUpperCase();

    // Se gli utilizzatori sono più di uno, il satellite va in "Altro / ibridi"
    let groups = [
      ["Commerciale", /commercial|commerciale/],
      ["Governativo", /government|governativo/],
      ["Militare", /military|militare/],
      ["Civile", /civil|civile|academic|amateur/]
    ].filter(group => group[1].test(users));
    let category = (groups.length === 1 && !/[\/;]/.test(users)) ? groups[0][0] : "Altro / ibridi";

    // Riconosco l'orbita dal testo della colonna
    let orbit = "ALTRO";
    if (orbitText.includes("LEO") || orbitText.includes("LOW EARTH")) orbit = "LEO";
    else if (orbitText.includes("MEO") || orbitText.includes("MEDIUM EARTH")) orbit = "MEO";
    else if (orbitText.includes("GEO") || orbitText.includes("GEOSTATIONARY")) orbit = "GEO";
    else if (orbitText.includes("HEO") || orbitText.includes("ELLIPTIC") || orbitText.includes("HIGHLY ELLIPTICAL") || orbitText.includes("ELLIPTICAL")) orbit = "HEO";

    result.push({
      name, category, orbit, year: Number.isFinite(year) ? year : null,
      index: result.length,
      launch: get("Date of Launch"),
      country: get("Country of Operator/Owner"),
      operator: get("Operator/Owner"),
      purpose: get("Purpose"),
      orbitType: get("Type of Orbit")
    });
  }
  if (!result.length) throw new Error("Non sono stati trovati satelliti validi.");
  return result;
}

// Scrive i numeri con il punto delle migliaia (es. 7.000)
function formatNumber(number) {
  return String(Math.trunc(number)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}


function getVisibleSatellites() {
  return satellites.filter(s => s.year === null || s.year <= selectedYear);
}

function percentText(count, total) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return `${pct}% · ${formatNumber(count)}`;
}

function countryGroup(countryText) {
  const text = String(countryText || "").toLowerCase();
  const europe = /(europe|italy|france|germany|spain|united kingdom|uk|luxembourg|netherlands|belgium|sweden|norway|denmark|finland|poland|portugal|greece|romania|czech|austria|switzerland|esa|eumetsat)/;
  if (/united states|usa/.test(text)) return 'usa';
  if (/china/.test(text)) return 'cina';
  if (/russia/.test(text)) return 'russia';
  if (/multinational|international|\//.test(text) || text.includes(',')) return 'multi';
  if (europe.test(text)) return 'europa';
  return 'altro';
}

function updateStatsPanel() {
  const visible = getVisibleSatellites();
  const total = visible.length;
  element("visibleCount").textContent = formatNumber(total);

  const categories = {
    commerciale: visible.filter(s => s.category === "Commerciale").length,
    governativo: visible.filter(s => s.category === "Governativo").length,
    militare: visible.filter(s => s.category === "Militare").length,
    civile: visible.filter(s => s.category === "Civile").length,
    altro: visible.filter(s => s.category === "Altro / ibridi").length
  };
  element("stat-commerciale").textContent = percentText(categories.commerciale, total);
  element("stat-governativo").textContent = percentText(categories.governativo, total);
  element("stat-militare").textContent = percentText(categories.militare, total);
  element("stat-civile").textContent = percentText(categories.civile, total);
  element("stat-altro").textContent = percentText(categories.altro, total);

  const countryCounts = { usa: 0, europa: 0, cina: 0, russia: 0, multi: 0, altro: 0 };
  for (const sat of visible) countryCounts[countryGroup(sat.country)]++;
  element("country-usa").textContent = formatNumber(countryCounts.usa);
  element("country-europa").textContent = formatNumber(countryCounts.europa);
  element("country-cina").textContent = formatNumber(countryCounts.cina);
  element("country-russia").textContent = formatNumber(countryCounts.russia);
  element("country-multi").textContent = formatNumber(countryCounts.multi);
  element("country-altro").textContent = formatNumber(countryCounts.altro);
}

// -----------------------------------------------------------------------------
// NAVIGAZIONE INTERATTIVA: il layout originale resta sempre montato.
// Le modifiche si applicano solamente al contenuto del riquadro orbitale.
// -----------------------------------------------------------------------------

function attachInteractions(canvasElement) {
  const slider = element("yearSlider");
  slider.addEventListener("input", () => {
    stopPlaying();
    setYear(Number(slider.value));
  });
  element("playButton").addEventListener("click", togglePlaying);
  element("backToOrbits").addEventListener("click", showHome);
  element("backToZoom").addEventListener("click", () => openOrbit(selectedOrbit, true));
  element("allOrbitButton").addEventListener("click", showHome);
  element("allOrbitButton").addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showHome(); }
  });

  element("orbitSlider").addEventListener("input", event => {
    orbitPosition = Math.min(orbitMaxPosition(), Math.max(0, Number(event.target.value)));
    hideTooltip();
    updateOrbitSlider();
    redraw();
  });

  document.querySelectorAll(".orbit-key [data-orbit]").forEach(item => {
    item.addEventListener("click", () => openOrbit(item.dataset.orbit));
    item.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openOrbit(item.dataset.orbit); }
    });
  });

  canvasElement.addEventListener("pointerdown", e => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (viewMode === "detail") return;
    drag = { id: e.pointerId, y: e.clientY, startY: e.clientY, startX: e.clientX, moved: false };
    canvasElement.setPointerCapture(e.pointerId);
    if (viewMode === "zoom") {
      surface.classList.add("is-dragging");
      e.preventDefault();
    }
  });
  canvasElement.addEventListener("pointermove", e => {
    const loc = canvasPoint(e);
    if (drag && drag.id === e.pointerId) {
      const traveled = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
      if (traveled > 5) drag.moved = true;
      if (viewMode === "zoom" && drag.moved) {
        // Trascinamento verticale stile mappa; nessun movimento orizzontale.
        scrollOrbit(-(e.clientY - drag.y) * (orbitMaxPosition() / Math.max(1, height)));
        e.preventDefault();
      }
      drag.y = e.clientY;
      hideTooltip();
    } else if (viewMode === "zoom") {
      showPointHover(loc.x, loc.y);
    }
  });
  canvasElement.addEventListener("pointerup", e => {
    if (!drag || drag.id !== e.pointerId) return;
    const wasDrag = drag.moved;
    drag = null;
    surface.classList.remove("is-dragging");
    const loc = canvasPoint(e);
    if (!wasDrag && viewMode === "home") {
      const picked = pickHomeOrbit(loc.x, loc.y);
      if (picked) openOrbit(picked);
    } else if (!wasDrag && viewMode === "zoom") {
      const picked = satelliteAt(loc.x, loc.y);
      if (picked) openSatellite(picked);
    }
  });
  canvasElement.addEventListener("pointercancel", () => {
    drag = null;
    surface.classList.remove("is-dragging");
  });
  canvasElement.addEventListener("pointerleave", () => { if (!drag) hideTooltip(); });
  canvasElement.addEventListener("wheel", e => {
    if (viewMode !== "zoom") return;
    e.preventDefault();
    scrollOrbit(e.deltaY / 5);
    hideTooltip();
  }, { passive: false });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (viewMode === "detail") openOrbit(selectedOrbit, true);
      else if (viewMode === "zoom") showHome();
    } else if (viewMode === "zoom" && e.target !== element("orbitSlider") &&
      e.target !== element("yearSlider") && ["ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      scrollOrbit(e.key === "ArrowDown" ? 3 : -3);
    }
  });
}

function setYear(year) {
  selectedYear = Math.max(1957, Math.min(2023, Math.round(year)));
  const oldProgress = orbitMaxPosition() > 0 ? orbitPosition / orbitMaxPosition() : 0;
  rebuildOrbitList();
  orbitPosition = Math.min(orbitMaxPosition(), oldProgress * orbitMaxPosition());
  hideTooltip();
  if (viewMode === "detail" && detailSatellite && detailSatellite.year !== null && detailSatellite.year > selectedYear) {
    viewMode = "zoom";
    detailSatellite = null;
  }
  updateTimelineUI();
  updateViewUI();
  updateStatsPanel();
  redraw();
}

function updateTimelineUI() {
  element("yearSlider").value = selectedYear;
  element("yearValue").textContent = selectedYear;
  element("yearSlider").style.setProperty("--progress", `${(selectedYear - 1957) / (2023 - 1957) * 100}%`);
}

function togglePlaying() {
  if (playTimer !== null) { stopPlaying(); return; }
  if (selectedYear >= 2023) setYear(1957);
  playTimer = window.setInterval(() => {
    if (selectedYear >= 2023) { stopPlaying(); return; }
    setYear(selectedYear + 1);
    if (selectedYear === 2023) stopPlaying();
  }, 165);
  const button = element("playButton");
  button.innerHTML = "<span>Ⅱ</span> <span>PAUSA</span>";
  button.setAttribute("aria-label", "Metti in pausa la timeline");
  button.setAttribute("aria-pressed", "true");
}

function stopPlaying() {
  if (playTimer !== null) { window.clearInterval(playTimer); playTimer = null; }
  const button = element("playButton");
  button.innerHTML = "<span>▶</span> <span>PLAY</span>";
  button.setAttribute("aria-label", "Avvia animazione timeline");
  button.setAttribute("aria-pressed", "false");
}

function showHome() {
  viewMode = "home";
  detailSatellite = null;
  hoverSatellite = null;
  hideTooltip();
  updateViewUI();
  redraw();
}

function openOrbit(orbit, preservePosition = false) {
  if (!ORBIT_NAMES[orbit]) return;
  if (orbit !== selectedOrbit || !preservePosition) orbitPosition = 0;
  selectedOrbit = orbit;
  viewMode = "zoom";
  detailSatellite = null;
  hoverSatellite = null;
  rebuildOrbitList();
  hideTooltip();
  updateViewUI();
  redraw();
}

function openSatellite(sat) {
  if (!sat) return;
  detailSatellite = sat;
  viewMode = "detail";
  hideTooltip();
  element("detailName").textContent = sat.name;
  element("detailMeta").textContent = `${sat.orbitType || ORBIT_NAMES[sat.orbit] || "ORBITA NON SPECIFICATA"} • ${sat.year || "DATA NON DISPONIBILE"}`;
  element("detailOrbit").textContent = sat.orbit;
  element("detailCategory").textContent = sat.category;
  element("detailLaunch").textContent = sat.launch || "Non disponibile";
  element("detailCountry").textContent = sat.country || "Non disponibile";
  element("detailOperator").textContent = sat.operator || "Non disponibile";
  element("detailPurpose").textContent = sat.purpose || "Non disponibile";
  updateViewUI();
  redraw();
}

function updateViewUI() {
  surface.classList.toggle("is-home", viewMode === "home");
  surface.classList.toggle("is-zoom", viewMode === "zoom");
  surface.classList.toggle("is-detail", viewMode === "detail");
  element("orbitInteraction").hidden = viewMode !== "zoom";
  element("satelliteDetail").hidden = viewMode !== "detail";
  document.querySelectorAll(".orbit-key [data-orbit]").forEach(item => {
    item.classList.toggle("is-active", viewMode !== "home" && item.dataset.orbit === selectedOrbit);
  });
  element("allOrbitButton").classList.toggle("is-active", viewMode === "home");
  if (viewMode === "zoom") {
    const label = element("zoomOrbitLabel");
    label.replaceChildren(document.createTextNode(selectedOrbit + " "));
    const name = document.createElement("span");
    name.textContent = ORBIT_NAMES[selectedOrbit];
    label.appendChild(name);
    updateOrbitSlider();
  }
}

function rebuildOrbitList() {
  orbitList = selectedOrbit
    ? satellites.filter(s => s.orbit === selectedOrbit && (s.year === null || s.year <= selectedYear))
    : [];
  orbitPosition = Math.min(orbitPosition, orbitMaxPosition());
  updateOrbitSlider();
}

function orbitVisibleSlots() {
  return Math.max(24, Math.min(50, Math.round(height / 12)));
}
// La levetta ha sempre la stessa escursione: un giro completo dell’orbita,
// indipendente dal numero di satelliti presenti in LEO/MEO/GEO/HEO.
function orbitMaxPosition() { return 1000; }

function updateOrbitSlider() {
  const slider = element("orbitSlider");
  if (!slider) return;
  slider.max = orbitMaxPosition().toString();
  slider.value = Math.min(orbitMaxPosition(), Math.max(0, orbitPosition)).toString();
  const fraction = orbitMaxPosition() > 0 ? orbitPosition / orbitMaxPosition() : 0;
  const degrees = Math.round(fraction * 360);
  const slots = zoomVisibleSlots();
  const start = orbitList.length ? Math.round(fraction * Math.max(0, orbitList.length - slots)) + 1 : 0;
  const end = Math.min(orbitList.length, Math.max(0, start - 1) + slots);
  element("orbitProgress").textContent = orbitList.length <= slots
    ? `${degrees}° / 360° · ${formatNumber(orbitList.length)} SAT.`
    : `${degrees}° / 360° · ${formatNumber(start)}–${formatNumber(end)} / ${formatNumber(orbitList.length)}`;
  // L'icona a forma di mano segue davvero il cursore verticale.
  const rail = document.querySelector(".orbit-slider-frame");
  const hand = element("orbitHand");
  if (rail && hand && rail.clientHeight > 0) {
    hand.style.top = `${9 + (rail.clientHeight - 18) * fraction}px`;
  }
}

function scrollOrbit(delta) {
  if (viewMode !== "zoom") return;
  orbitPosition = Math.max(0, Math.min(orbitMaxPosition(), orbitPosition + delta));
  hoverSatellite = null;
  updateOrbitSlider();
  redraw();
}

// La mezz'orbita è uno schema, non una posizione astronomica in scala.
// I satelliti scorrono lungo l'arco: la rotazione espone tutto il CSV dell'orbita,
// in gruppi leggibili e cliccabili, anche per le migliaia di elementi in LEO.
function zoomGeometry() {
  const outerRadius = Math.min(width * 0.39, height * 0.92, 620);
  return {
    cx: width * 0.52,
    cy: height - 8,
    mainRadius: outerRadius - 58,
    faintRadius: outerRadius,
    innerRadius: Math.max(80, outerRadius - 170)
  };
}

function zoomVisibleSlots() {
  return Math.max(40, Math.min(110, Math.round(width / 13)));
}

function drawZoom(quiet = false) {
  const g = zoomGeometry();
  const guideColor = quiet ? "#334544" : "#8ea3a0";
  const faintColor = quiet ? "#213130" : "#5f6e6b";
  const alpha = quiet ? 70 : 255;
  const fraction = orbitMaxPosition() > 0 ? orbitPosition / orbitMaxPosition() : 0;
  const slots = Math.min(orbitList.length, zoomVisibleSlots());
  // Per le orbite con pochi satelliti (come HEO, 59 nel CSV), la vecchia
  // finestra includeva TUTTI i punti: muovere la levetta non cambiava nulla.
  // In quel caso ruotiamo realmente la disposizione sull'arco di 180 gradi.
  // La corsa 0–360° è un ciclo completo e può essere ripercorsa all'indietro.
  const rotateAll = orbitList.length > 0 && orbitList.length <= zoomVisibleSlots();
  const start = rotateAll ? 0 : Math.round(fraction * Math.max(0, orbitList.length - slots));
  const end = rotateAll ? orbitList.length : Math.min(orbitList.length, start + slots);

  // Una circonferenza principale visibile e una più distante appena accennata.
  push();
  noFill();
  stroke(faintColor);
  strokeWeight(0.8);
  beginShape();
  for (let j = 0; j <= 180; j++) {
    const angle = Math.PI + Math.PI * j / 180;
    vertex(g.cx + g.faintRadius * Math.cos(angle), g.cy + g.faintRadius * Math.sin(angle));
  }
  endShape();

  stroke(guideColor);
  strokeWeight(1.3);
  beginShape();
  for (let j = 0; j <= 180; j++) {
    const angle = Math.PI + Math.PI * j / 180;
    vertex(g.cx + g.mainRadius * Math.cos(angle), g.cy + g.mainRadius * Math.sin(angle));
  }
  endShape();
  pop();

  // Piccola etichetta orbita
  if (!quiet && selectedOrbit) {
    noStroke();
    fill("#d5dfdc");
    textFont(MONO);
    textSize(10);
    textAlign(CENTER, BOTTOM);
    text(selectedOrbit, g.cx, g.cy - g.mainRadius - 8);
  }

  zoomPoints = [];
  if (!orbitList.length) {
    if (!quiet) {
      noStroke();
      fill("#b4c4c0");
      textFont(MONO);
      textSize(11);
      textAlign(CENTER, CENTER);
      text("NESSUN SATELLITE PER L'ANNO SELEZIONATO", width * 0.5, height * 0.46);
    }
    return;
  }

  for (let idx = start; idx < end; idx++) {
    const sat = orbitList[idx];
    const local = idx - start;
    const t = rotateAll
      ? (((local + 0.5) / slots + fraction) % 1)
      : (slots <= 1 ? 0.5 : local / (slots - 1));
    const angle = Math.PI + Math.PI * t;
    // Posizionamento nel semicerchio, distribuito in modo casuale e non sulle linee.
    const radialMix = 0.08 + 0.78 * randomFixed(sat.index, 4);
    const radius = g.innerRadius + (g.mainRadius - g.innerRadius) * radialMix;
    const x = g.cx + radius * Math.cos(angle);
    const y = g.cy + radius * Math.sin(angle);
    zoomPoints.push({ sat, x, y });

    if (quiet) {
      noStroke();
      fill(`rgba(100,124,118,${alpha / 255})`);
      circle(x, y, 3.2);
    } else {
      const selected = hoverSatellite === sat;
      if (selected) {
        noFill();
        stroke("#e9ed49");
        strokeWeight(1);
        circle(x, y, 14);
      }
      noStroke();
      fill(colors[sat.category] || "#d3dad7");
      circle(x, y, selected ? 8 : 5.8);
    }
  }
}

function satelliteAt(x, y) {
  let best = null, distance = 12;
  for (const point of zoomPoints) {
    const d = Math.hypot(x - point.x, y - point.y);
    if (d < distance) { best = point.sat; distance = d; }
  }
  return best;
}

function showPointHover(x, y) {
  const sat = satelliteAt(x, y);
  if (hoverSatellite !== sat) {
    hoverSatellite = sat;
    redraw();
  }
  const canvas = element("orbitCanvas");
  canvas.style.cursor = sat ? "pointer" : "";
  const tooltip = element("orbitTooltip");
  if (!sat) { tooltip.hidden = true; return; }
  tooltip.replaceChildren(document.createTextNode(sat.name));
  const meta = document.createElement("span");
  meta.textContent = `${sat.category.toUpperCase()} · ${sat.year || "ANNO N.D."} · CLICCA PER DETTAGLIO`;
  tooltip.appendChild(meta);
  tooltip.style.left = `${Math.min(width - 245, x + 16)}px`;
  tooltip.style.top = `${Math.max(10, Math.min(height - 65, y + 12))}px`;
  tooltip.hidden = false;
}

function hideTooltip() {
  if (element("orbitTooltip")) element("orbitTooltip").hidden = true;
  const canvas = element("orbitCanvas");
  if (canvas) canvas.style.cursor = "";
  if (hoverSatellite !== null) { hoverSatellite = null; redraw(); }
}

function canvasPoint(event) {
  const rect = element("orbitCanvas").getBoundingClientRect();
  return { x: (event.clientX - rect.left) * width / rect.width,
    y: (event.clientY - rect.top) * height / rect.height };
}

// La selezione in homepage funziona sia cliccando i punti sia le orbite.
// Si preferisce la traiettoria HEO se il clic è vicino all'ellisse inclinata.
function pickHomeOrbit(x, y) {
  const cx = width * 0.5, cy = height * 0.51;
  const radius = Math.min(width * 0.36, height * 0.465, 350);
  const dx = x - cx, dy = y - cy;
  const dx0 = dx * Math.cos(tilt) + dy * Math.sin(tilt);
  const dy0 = -dx * Math.sin(tilt) + dy * Math.cos(tilt);
  const ellipseA = radius * 0.98, ellipseB = radius * 0.56;
  const ellipseDist = Math.abs(Math.hypot(dx0 / ellipseA, dy0 / ellipseB) - 1) * Math.min(ellipseA, ellipseB);
  if (ellipseDist < 12) return "HEO";
  const r = Math.hypot(dx, dy) / radius;
  if (r > 1.04) return null;
  if (r < 0.69) return "LEO";
  if (r < 0.865) return "MEO";
  return "GEO";
}
