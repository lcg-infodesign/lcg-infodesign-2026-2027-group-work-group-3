/* ==================================================
   DATI E VARIABILI GENERALI
   ================================================== */

// Array che contiene tutti i satelliti letti dal CSV.
let satellites = [];
let data;

// Stato iniziale della pagina: anno più recente e vista generale.
let selectedYear = 2023;
let viewMode = "home";
let selectedOrbit = null;

// Variabili usate per mostrare e scorrere i satelliti di un'orbita.
let orbitList = [];
let orbitPosition = 0;
let zoomPoints = [];
let hoverSatellite = null;
let detailSatellite = null;

// Stato della riproduzione automatica della timeline e del trascinamento.
let playTimer = null;
let drag = null;

// Nomi estesi delle orbite, utilizzati nelle etichette e nella scheda satellite.
const ORBIT_NAMES = {
  HEO: "HIGHLY ELLIPTICAL",
  GEO: "GEOSTATIONARY",
  MEO: "MEDIUM EARTH",
  LEO: "LOW EARTH"
};

// Inclinazione dell'ellisse HEO nella visualizzazione principale.
const tilt = -0.4;
const MONO = '"IBM Plex Mono Locale", "IBM Plex Mono", monospace';

// Colori usati per distinguere le categorie dei satelliti.
const colors = {
  "Commerciale": "#93c572",
  "Governativo": "#6894e9",
  "Militare": "#ed8395",
  "Civile": "#c49ce7",
  "Altro / ibridi": "#57d0bd"
};

// Contenitore HTML nel quale viene inserito il canvas di p5.js.
const surface = document.getElementById("orbitSurface");

// Funzione breve per recuperare un elemento HTML tramite il suo ID.
const element = id => document.getElementById(id);


// ==================================================
// CARICAMENTO DEL CSV

async function setup() {
  // Controllo che il contenitore del canvas esista nella pagina.
  if (!surface) {
    console.error("Non trovo l'elemento orbitSurface nell'HTML.");
    return;
  }

  // Creo il canvas con le dimensioni attuali del contenitore.
  const canvas = createCanvas(
    Math.max(1, surface.clientWidth),
    Math.max(1, surface.clientHeight)
  );

  // Inserisco il canvas dentro orbitSurface e gli assegno il suo ID.
  canvas.parent("orbitSurface");
  canvas.id("orbitCanvas");

  // Il disegno viene aggiornato solo quando viene chiamato redraw().
  noLoop();

  // Attivo tutti gli eventi di mouse, touch, slider e tastiera.
  attachInteractions(canvas.elt);

  // Imposto subito i valori iniziali dell'interfaccia.
  updateTimelineUI();
  updateViewUI();

  // Aspetto il caricamento del font prima di ridisegnare il canvas.
  if (document.fonts) {
    document.fonts.load('9px "IBM Plex Mono Locale"').then(() => redraw());
  }

  // Carico direttamente il CSV e attendo che p5.js restituisca la tabella.
  try {
    data = await loadTable("assets/satelliti.csv", ",", "header");

    // Converto le righe del CSV in oggetti satellite più semplici da usare.
    satellites = readUCS(data);

    console.log("Satelliti caricati:", satellites.length);

    // Preparo l'elenco dei satelliti per l'orbita selezionata.
    rebuildOrbitList();

    // Aggiorno statistiche e visualizzazione dopo il caricamento.
    updateStatsPanel();
    redraw();

  } catch (error) {
    // Mostro un messaggio chiaro se il CSV non viene caricato o letto.
    console.error("Errore durante il caricamento del CSV:", error);

    alert(
      "Non riesco a caricare il CSV.\n" +
      "Controlla che il file si chiami satelliti.csv " +
      "e si trovi nella cartella assets."
    );
  }
}


// ==================================================
// DISEGNO PRINCIPALE
// ==================================================

function draw() {
  // Colore di sfondo della visualizzazione.
  background("#0b1314");

  // Griglia di riferimento dietro alle orbite.
  drawGrid();

  // La modalità home mostra tutte le orbite; le altre mostrano lo zoom.
  if (viewMode === "home") {
    drawOrbits();
  } else {
    drawZoom(viewMode === "detail");
  }

  // Aggiorno i conteggi in base all'anno selezionato.
  updateStatsPanel();
}


// Disegna la griglia regolare sullo sfondo del canvas.
function drawGrid() {
  stroke(111, 142, 136, 17);
  strokeWeight(1);

  // Linee verticali.
  for (let x = 0.5; x < width; x += 32) {
    line(x, 0, x, height);
  }

  // Linee orizzontali.
  for (let y = 0.5; y < height; y += 32) {
    line(0, y, width, y);
  }
}


// ==================================================
// ORBITE PRINCIPALI DELLA HOMEPAGE
// ==================================================

function drawOrbits() {
  // Centro della visualizzazione e raggio massimo delle orbite.
  const cx = width * 0.5;
  const cy = height * 0.51;
  const radius = Math.min(width * 0.36, height * 0.465, 350);

  // Dimensioni dell'ellisse HEO.
  const ellipseA = radius * 0.98;
  const ellipseB = radius * 0.56;

  // Disegno dell'orbita HEO tratteggiata e inclinata.
  push();
  translate(cx, cy);
  rotate(tilt);
  noFill();
  stroke("#516360");
  drawingContext.setLineDash([4, 6]);
  ellipse(0, 0, ellipseA * 2, ellipseB * 2);
  drawingContext.setLineDash([]);
  pop();

  // Dimensioni relative delle tre orbite circolari.
  const orbits = [
    { name: "LEO", size: 0.60 },
    { name: "MEO", size: 0.80 },
    { name: "GEO", size: 0.955 }
  ];

  // Disegno delle orbite circolari e delle rispettive etichette.
  for (const orbit of orbits) {
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

  // Disegno i punti che rappresentano i satelliti.
  drawSatellites();

  // Calcolo la posizione dell'etichetta HEO lungo l'ellisse inclinata.
  const t = -0.1;
  const ex = Math.cos(t) * ellipseA;
  const ey = Math.sin(t) * ellipseB;
  const labelX = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt);
  const labelY = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);

  noStroke();
  fill("#99a8a3");
  textFont(MONO);
  textSize(9);
  textAlign(LEFT, BOTTOM);
  text("HEO", labelX + 6, labelY - 4);

  // La Terra è rappresentata dal cerchio centrale.
  fill("#e0e8e5");
  circle(cx, cy, 10);
}


// ==================================================
// SATELLITI NELLA HOMEPAGE
// ==================================================

function drawSatellites() {
  const cx = width * 0.5;
  const cy = height * 0.51;
  const radius = Math.min(width * 0.36, height * 0.465, 350);

  // Recupero solo i satelliti lanciati entro l'anno selezionato.
  const visible = getVisibleSatellites();

  noStroke();

  // Disegno ogni satellite nella posizione calcolata per la sua orbita.
  for (let i = 0; i < visible.length; i++) {
    const sat = visible[i];
    const point = positionFor(sat, sat.index, cx, cy, radius);

    fill(colors[sat.category] || "#d3dad7");
    circle(
      point.x,
      point.y,
      Math.max(2.28, Math.min(2.96, radius / 95))
    );
  }

  // Aggiorno il contatore visibile nella pagina.
  element("visibleCount").textContent = formatNumber(visible.length);
}


// Calcola una posizione fissa per ogni satellite, in base al suo indice e orbita.
function positionFor(sat, i, cx, cy, radius) {
  const angle = randomFixed(i, 1) * TWO_PI;
  const distance = randomFixed(i, 2);

  // Per HEO uso una posizione su un'ellisse inclinata.
  if (sat.orbit === "HEO") {
    const x = Math.cos(angle) * (0.78 + 0.18 * distance) * radius;
    const y = Math.sin(angle) * (0.48 + 0.075 * distance) * radius;

    return {
      x: cx + x * Math.cos(tilt) - y * Math.sin(tilt),
      y: cy + x * Math.sin(tilt) + y * Math.cos(tilt)
    };
  }

  // Per le altre orbite calcolo una distanza diversa dal centro.
  let r;

  if (sat.orbit === "LEO") {
    r = (0.08 + Math.sqrt(distance) * 0.51) * radius;
  } else if (sat.orbit === "MEO") {
    r = (0.64 + distance * 0.14) * radius;
  } else if (sat.orbit === "GEO") {
    r = (0.86 + distance * 0.082) * radius;
  } else {
    r = (0.61 + distance * 0.34) * radius;
  }

  return {
    x: cx + Math.cos(angle) * r,
    y: cy + Math.sin(angle) * r
  };
}


// Genera un numero pseudo-casuale sempre uguale per lo stesso indice e parametro.
// In questo modo i satelliti non cambiano posizione a ogni ridisegno.
function randomFixed(index, salt) {
  let n =
    Math.imul(index + 1, 374761393) ^
    Math.imul(salt + 1, 668265263);

  n = Math.imul(n ^ (n >>> 13), 1274126177);

  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}


// ==================================================
// RIDIMENSIONAMENTO DEL CANVAS
// ==================================================

function windowResized() {
  // Non eseguo il ridimensionamento se il contenitore non esiste.
  if (!surface) return;

  resizeCanvas(
    Math.max(1, surface.clientWidth),
    Math.max(1, surface.clientHeight)
  );

  // Dopo il ridimensionamento correggo la posizione dello slider dell'orbita.
  if (viewMode !== "home") {
    orbitPosition = Math.min(orbitPosition, orbitMaxPosition());
    updateOrbitSlider();
  }

  redraw();
}


// ==================================================
// LETTURA E ORGANIZZAZIONE DEL CSV
// ==================================================

function readUCS(table) {
  const result = [];

  // Normalizzo le intestazioni, così posso confrontarle senza differenze di maiuscole o spazi.
  const headers = table.columns.map(normalizza);

  // Cerca il primo valore disponibile tra i possibili nomi della stessa colonna.
  function get(row, ...names) {
    for (const name of names) {
      const index = headers.indexOf(normalizza(name));

      if (index !== -1) {
        const value = row[index];

        if (value !== undefined && value !== null && value.trim() !== "") {
          return value.trim();
        }
      }
    }

    return "";
  }

  // Leggo una riga alla volta e trasformo i campi in un oggetto satellite.
  for (let r = 0; r < table.getRowCount(); r++) {
    const row = [];

    for (let c = 0; c < table.getColumnCount(); c++) {
      row.push(table.getString(r, c) || "");
    }

    // Nome del satellite: provo più intestazioni possibili.
    const name = get(
      row,
      "Current Official Name of Satellite",
      "Name of Satellite",
      "Satellite Name",
      "Name"
    );

    // Salto le righe che non contengono un nome.
    if (!name) continue;

    // Estraggo l'anno dalla data di lancio, quando è presente.
    const launch = get(row, "Date of Launch", "Launch Date");
    const yearMatch = launch.match(/\b(?:19|20)\d{2}\b/);
    const year = yearMatch ? Number(yearMatch[0]) : NaN;

    // Classifico il satellite usando il campo Users.
    const users = get(row, "Users").toLowerCase();
    const categoryMatches = [];

    // Verifico separatamente le quattro categorie principali.
    if (/commercial|commerciale/.test(users)) {
      categoryMatches.push("Commerciale");
    }
    if (/government|governativo/.test(users)) {
      categoryMatches.push("Governativo");
    }
    if (/military|militare/.test(users)) {
      categoryMatches.push("Militare");
    }
    if (/civil|civile|academic|amateur/.test(users)) {
      categoryMatches.push("Civile");
    }

    // Se il campo indica più gruppi, oppure non ne indica uno solo, uso Altro / ibridi.
    let category = "Altro / ibridi";
    if (categoryMatches.length === 1 && !/[\/;]/.test(users)) {
      category = categoryMatches[0];
    }

    // Riconosco il tipo di orbita a partire dalla descrizione contenuta nel CSV.
    const orbitText = get(row, "Class of Orbit", "Orbit Class").toUpperCase();
    let orbit = "ALTRO";

    if (orbitText.includes("LEO") || orbitText.includes("LOW EARTH")) {
      orbit = "LEO";
    } else if (orbitText.includes("MEO") || orbitText.includes("MEDIUM EARTH")) {
      orbit = "MEO";
    } else if (orbitText.includes("GEO") || orbitText.includes("GEOSTATIONARY")) {
      orbit = "GEO";
    } else if (orbitText.includes("HEO") || orbitText.includes("ELLIPTIC")) {
      orbit = "HEO";
    }

    // Inserisco i dati già ripuliti nell'array principale.
    result.push({
      name: name,
      category: category,
      orbit: orbit,
      year: Number.isFinite(year) ? year : null,
      index: result.length,
      launch: launch,
      country: get(
        row,
        "Country of Operator/Owner",
        "Country of Operator",
        "Country"
      ),
      operator: get(
        row,
        "Operator/Owner",
        "Operator",
        "Owner"
      ),
      purpose: get(
        row,
        "Purpose",
        "Mission"
      ),
      orbitType: get(
        row,
        "Type of Orbit",
        "Orbit Type"
      )
    });
  }

  // Interrompo il caricamento se nessuna riga contiene un satellite valido.
  if (result.length === 0) {
    throw new Error("Non sono stati trovati satelliti validi.");
  }

  return result;
}


// Porta le intestazioni in una forma uniforme per poterle confrontare.
function normalizza(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}


// ==================================================
// DATI VISIBILI E STATISTICHE
// ==================================================

// Formatta i numeri usando il punto come separatore delle migliaia.
function formatNumber(number) {
  return String(Math.trunc(number))
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}


// Restituisce i satelliti già lanciati entro l'anno selezionato.
// I satelliti senza anno di lancio rimangono sempre visibili, come nella versione originale.
function getVisibleSatellites() {
  return satellites.filter(satellite =>
    satellite.year === null || satellite.year <= selectedYear
  );
}


// Costruisce il testo con percentuale e numero assoluto per il pannello categorie.
function percentText(count, total) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return `${pct}% · ${formatNumber(count)}`;
}


// Raggruppa il paese dell'operatore nelle categorie mostrate nel pannello.
function countryGroup(countryText) {
  const text = String(countryText || "").toLowerCase();

  const europe = /(europe|italy|france|germany|spain|united kingdom|uk|luxembourg|netherlands|belgium|sweden|norway|denmark|finland|poland|portugal|greece|romania|czech|austria|switzerland|esa|eumetsat)/;

  if (/united states|usa/.test(text)) return "usa";
  if (/china/.test(text)) return "cina";
  if (/russia/.test(text)) return "russia";

  if (/multinational|international|\//.test(text) || text.includes(",")) {
    return "multi";
  }

  if (europe.test(text)) return "europa";

  return "altro";
}


// Aggiorna tutti i numeri del pannello laterale.
function updateStatsPanel() {
  const visible = getVisibleSatellites();
  const total = visible.length;

  element("visibleCount").textContent = formatNumber(total);

  // Conteggi per categoria. Un solo ciclo sostituisce i cinque filtri separati.
  const categories = {
    commerciale: 0,
    governativo: 0,
    militare: 0,
    civile: 0,
    altro: 0
  };

  for (const satellite of visible) {
    if (satellite.category === "Commerciale") {
      categories.commerciale++;
    } else if (satellite.category === "Governativo") {
      categories.governativo++;
    } else if (satellite.category === "Militare") {
      categories.militare++;
    } else if (satellite.category === "Civile") {
      categories.civile++;
    } else if (satellite.category === "Altro / ibridi") {
      categories.altro++;
    }
  }

  // Scrivo percentuale e conteggio nei rispettivi elementi HTML.
  element("stat-commerciale").textContent = percentText(categories.commerciale, total);
  element("stat-governativo").textContent = percentText(categories.governativo, total);
  element("stat-militare").textContent = percentText(categories.militare, total);
  element("stat-civile").textContent = percentText(categories.civile, total);
  element("stat-altro").textContent = percentText(categories.altro, total);

  // Conteggi per area geografica.
  const countryCounts = {
    usa: 0,
    europa: 0,
    cina: 0,
    russia: 0,
    multi: 0,
    altro: 0
  };

  for (const satellite of visible) {
    countryCounts[countryGroup(satellite.country)]++;
  }

  // Aggiorno i sei numeri mostrati nella lista dei paesi.
  element("country-usa").textContent = formatNumber(countryCounts.usa);
  element("country-europa").textContent = formatNumber(countryCounts.europa);
  element("country-cina").textContent = formatNumber(countryCounts.cina);
  element("country-russia").textContent = formatNumber(countryCounts.russia);
  element("country-multi").textContent = formatNumber(countryCounts.multi);
  element("country-altro").textContent = formatNumber(countryCounts.altro);
}


// ==================================================
// EVENTI E INTERAZIONI
// ==================================================

function attachInteractions(canvasElement) {
  const slider = element("yearSlider");

  // Quando cambia l'anno fermo PLAY e aggiorno la visualizzazione.
  slider.addEventListener("input", () => {
    stopPlaying();
    setYear(Number(slider.value));
  });

  // Pulsanti principali e pulsanti per tornare alle viste precedenti.
  element("playButton").addEventListener("click", togglePlaying);
  element("backToOrbits").addEventListener("click", showHome);
  element("backToZoom").addEventListener("click", () => {
    openOrbit(selectedOrbit, true);
  });
  element("allOrbitButton").addEventListener("click", showHome);

  // Mantengo anche l'attivazione da tastiera già presente per il pulsante TUTTE.
  element("allOrbitButton").addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showHome();
    }
  });

  // Slider verticale: sposta il punto di osservazione lungo l'orbita selezionata.
  element("orbitSlider").addEventListener("input", event => {
    orbitPosition = Math.min(
      orbitMaxPosition(),
      Math.max(0, Number(event.target.value))
    );

    hideTooltip();
    updateOrbitSlider();
    redraw();
  });

  // I pulsanti HEO, GEO, MEO e LEO aprono la relativa orbita.
  document.querySelectorAll(".orbit-key [data-orbit]").forEach(item => {
    item.addEventListener("click", () => {
      openOrbit(item.dataset.orbit);
    });

    // Mantengo la selezione da tastiera già prevista nel codice originale.
    item.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openOrbit(item.dataset.orbit);
      }
    });
  });

  // Inizio del trascinamento sul canvas.
  canvasElement.addEventListener("pointerdown", event => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if (viewMode === "detail") return;

    drag = {
      id: event.pointerId,
      y: event.clientY,
      startY: event.clientY,
      startX: event.clientX,
      moved: false
    };

    canvasElement.setPointerCapture(event.pointerId);

    if (viewMode === "zoom") {
      surface.classList.add("is-dragging");
      event.preventDefault();
    }
  });

  // Movimento del puntatore: trascina la vista oppure mostra il tooltip.
  canvasElement.addEventListener("pointermove", event => {
    const loc = canvasPoint(event);

    if (drag && drag.id === event.pointerId) {
      const traveled = Math.hypot(
        event.clientX - drag.startX,
        event.clientY - drag.startY
      );

      if (traveled > 5) {
        drag.moved = true;
      }

      if (viewMode === "zoom" && drag.moved) {
        scrollOrbit(
          -(event.clientY - drag.y) *
          (orbitMaxPosition() / Math.max(1, height))
        );

        event.preventDefault();
      }

      drag.y = event.clientY;
      hideTooltip();

    } else if (viewMode === "zoom") {
      showPointHover(loc.x, loc.y);
    }
  });

  // Fine del trascinamento: se il puntatore non si è mosso, interpreto il gesto come clic.
  canvasElement.addEventListener("pointerup", event => {
    if (!drag || drag.id !== event.pointerId) return;

    const wasDrag = drag.moved;
    drag = null;

    surface.classList.remove("is-dragging");

    const loc = canvasPoint(event);

    if (!wasDrag && viewMode === "home") {
      const picked = pickHomeOrbit(loc.x, loc.y);

      if (picked) {
        openOrbit(picked);
      }

    } else if (!wasDrag && viewMode === "zoom") {
      const picked = satelliteAt(loc.x, loc.y);

      if (picked) {
        openSatellite(picked);
      }
    }
  });

  // Se il puntatore viene annullato, azzero lo stato del trascinamento.
  canvasElement.addEventListener("pointercancel", () => {
    drag = null;
    surface.classList.remove("is-dragging");
  });

  // Nascondo il tooltip quando il puntatore esce dal canvas e non sta trascinando.
  canvasElement.addEventListener("pointerleave", () => {
    if (!drag) hideTooltip();
  });

  // La rotella del mouse permette di scorrere l'orbita nella vista zoom.
  canvasElement.addEventListener("wheel", event => {
    if (viewMode !== "zoom") return;

    event.preventDefault();
    scrollOrbit(event.deltaY / 5);
    hideTooltip();
  }, { passive: false });

  // Mantengo i comandi da tastiera già presenti: ESC torna alla vista precedente,
  // mentre le frecce verticali scorrono l'orbita quando è aperta.
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (viewMode === "detail") {
        openOrbit(selectedOrbit, true);
      } else if (viewMode === "zoom") {
        showHome();
      }

    } else if (
      viewMode === "zoom" &&
      event.target !== element("orbitSlider") &&
      event.target !== element("yearSlider") &&
      ["ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      event.preventDefault();
      scrollOrbit(event.key === "ArrowDown" ? 3 : -3);
    }
  });
}


// ==================================================
// TIMELINE: CAMBIO ANNO E PLAY
// ==================================================

function setYear(year) {
  // Limito l'anno all'intervallo disponibile nella timeline.
  selectedYear = Math.max(1957, Math.min(2023, Math.round(year)));

  // Memorizzo la posizione relativa dello slider dell'orbita.
  const oldProgress = orbitMaxPosition() > 0
    ? orbitPosition / orbitMaxPosition()
    : 0;

  // Ricostruisco la lista con i satelliti visibili nel nuovo anno.
  rebuildOrbitList();

  // Mantengo la posizione relativa precedente dopo il nuovo conteggio.
  orbitPosition = Math.min(
    orbitMaxPosition(),
    oldProgress * orbitMaxPosition()
  );

  hideTooltip();

  // Se il satellite aperto non è ancora stato lanciato, torno alla vista zoom.
  if (
    viewMode === "detail" &&
    detailSatellite &&
    detailSatellite.year !== null &&
    detailSatellite.year > selectedYear
  ) {
    viewMode = "zoom";
    detailSatellite = null;
  }

  updateTimelineUI();
  updateViewUI();
  updateStatsPanel();
  redraw();
}


// Aggiorna il numero dell'anno e il valore dello slider principale.
function updateTimelineUI() {
  element("yearSlider").value = selectedYear;
  element("yearValue").textContent = selectedYear;

  element("yearSlider").style.setProperty(
    "--progress",
    `${(selectedYear - 1957) / (2023 - 1957) * 100}%`
  );
}


// Avvia o mette in pausa l'avanzamento automatico degli anni.
function togglePlaying() {
  // Se un timer è già attivo, il pulsante lo ferma.
  if (playTimer !== null) {
    stopPlaying();
    return;
  }

  // Se siamo già all'ultimo anno, riparto dal 1957.
  if (selectedYear >= 2023) {
    setYear(1957);
  }

  // Avanzo di un anno ogni 165 millisecondi.
  playTimer = window.setInterval(() => {
    if (selectedYear >= 2023) {
      stopPlaying();
      return;
    }

    setYear(selectedYear + 1);

    if (selectedYear === 2023) {
      stopPlaying();
    }
  }, 165);

  // Cambio il testo del pulsante per indicare che la timeline è in riproduzione.
  const button = element("playButton");
  button.innerHTML = "<span>Ⅱ</span> <span>PAUSA</span>";
}


// Ferma il timer e ripristina l'etichetta PLAY.
function stopPlaying() {
  if (playTimer !== null) {
    window.clearInterval(playTimer);
    playTimer = null;
  }

  const button = element("playButton");
  button.innerHTML = "<span>▶</span> <span>PLAY</span>";
}


// ==================================================
// NAVIGAZIONE TRA HOME, ORBITA E DETTAGLIO
// ==================================================

// Torna alla vista generale con tutte le orbite.
function showHome() {
  viewMode = "home";
  detailSatellite = null;
  hoverSatellite = null;

  hideTooltip();
  updateViewUI();
  redraw();
}


// Apre l'orbita scelta. preservePosition mantiene lo scorrimento quando si torna dal dettaglio.
function openOrbit(orbit, preservePosition = false) {
  if (!ORBIT_NAMES[orbit]) return;

  if (orbit !== selectedOrbit || !preservePosition) {
    orbitPosition = 0;
  }

  selectedOrbit = orbit;
  viewMode = "zoom";
  detailSatellite = null;
  hoverSatellite = null;

  rebuildOrbitList();
  hideTooltip();
  updateViewUI();
  redraw();
}


// Mostra i dati del satellite selezionato nella scheda laterale al canvas.
function openSatellite(sat) {
  if (!sat) return;

  detailSatellite = sat;
  viewMode = "detail";
  hideTooltip();

  // Riempio i campi della scheda usando i valori letti dal CSV.
  element("detailName").textContent = sat.name;
  element("detailMeta").textContent =
    `${sat.orbitType || ORBIT_NAMES[sat.orbit] || "ORBITA NON SPECIFICATA"} • ${sat.year || "DATA NON DISPONIBILE"}`;

  element("detailOrbit").textContent = sat.orbit;
  element("detailCategory").textContent = sat.category;
  element("detailLaunch").textContent = sat.launch || "Non disponibile";
  element("detailCountry").textContent = sat.country || "Non disponibile";
  element("detailOperator").textContent = sat.operator || "Non disponibile";
  element("detailPurpose").textContent = sat.purpose || "Non disponibile";

  updateViewUI();
  redraw();
}


// Aggiorna classi CSS e visibilità degli elementi in base alla vista attiva.
function updateViewUI() {
  surface.classList.toggle("is-home", viewMode === "home");
  surface.classList.toggle("is-zoom", viewMode === "zoom");
  surface.classList.toggle("is-detail", viewMode === "detail");

  element("orbitInteraction").hidden = viewMode !== "zoom";
  element("satelliteDetail").hidden = viewMode !== "detail";

  // Evidenzio il pulsante dell'orbita selezionata.
  document.querySelectorAll(".orbit-key [data-orbit]").forEach(item => {
    item.classList.toggle(
      "is-active",
      viewMode !== "home" && item.dataset.orbit === selectedOrbit
    );
  });

  // Evidenzio TUTTE quando viene mostrata la homepage.
  element("allOrbitButton").classList.toggle(
    "is-active",
    viewMode === "home"
  );

  // Nella vista zoom aggiorno nome e descrizione estesa dell'orbita.
  if (viewMode === "zoom") {
    const label = element("zoomOrbitLabel");

    label.replaceChildren(
      document.createTextNode(selectedOrbit + " ")
    );

    const name = document.createElement("span");
    name.textContent = ORBIT_NAMES[selectedOrbit];
    label.appendChild(name);

    updateOrbitSlider();
  }
}


// ==================================================
// PREPARAZIONE E SCORRIMENTO DELLE ORBITE
// ==================================================

// Crea la lista dei satelliti appartenenti all'orbita selezionata e visibili nell'anno scelto.
function rebuildOrbitList() {
  if (selectedOrbit) {
    orbitList = satellites.filter(satellite =>
      satellite.orbit === selectedOrbit &&
      (satellite.year === null || satellite.year <= selectedYear)
    );
  } else {
    orbitList = [];
  }

  orbitPosition = Math.min(orbitPosition, orbitMaxPosition());
  updateOrbitSlider();
}


// Numero di punti di riferimento calcolato in base all'altezza del canvas.
function orbitVisibleSlots() {
  return Math.max(24, Math.min(50, Math.round(height / 12)));
}


// Valore massimo dello slider verticale dell'orbita.
function orbitMaxPosition() {
  return 1000;
}


// Aggiorna slider, contatore di avanzamento e posizione dell'icona grafica.
function updateOrbitSlider() {
  const slider = element("orbitSlider");
  if (!slider) return;

  slider.max = orbitMaxPosition().toString();
  slider.value = Math.min(
    orbitMaxPosition(),
    Math.max(0, orbitPosition)
  ).toString();

  const fraction = orbitPosition / orbitMaxPosition();
  const degrees = Math.round(fraction * 360);
  const slots = zoomVisibleSlots();

  const start = orbitList.length
    ? Math.round(fraction * Math.max(0, orbitList.length - slots)) + 1
    : 0;

  const end = Math.min(
    orbitList.length,
    Math.max(0, start - 1) + slots
  );

  // Mostro i gradi e l'intervallo di satelliti attualmente visualizzato.
  element("orbitProgress").textContent = orbitList.length <= slots
    ? `${degrees}° / 360° · ${formatNumber(orbitList.length)} SAT.`
    : `${degrees}° / 360° · ${formatNumber(start)}–${formatNumber(end)} / ${formatNumber(orbitList.length)}`;

  // L'icona della mano segue la posizione verticale dello slider.
  const rail = document.querySelector(".orbit-slider-frame");
  const hand = element("orbitHand");

  if (rail && hand && rail.clientHeight > 0) {
    hand.style.top = `${9 + (rail.clientHeight - 18) * fraction}px`;
  }
}


// Sposta la posizione nell'orbita e ridisegna i satelliti visibili.
function scrollOrbit(delta) {
  if (viewMode !== "zoom") return;

  orbitPosition = Math.max(
    0,
    Math.min(orbitMaxPosition(), orbitPosition + delta)
  );

  hoverSatellite = null;
  updateOrbitSlider();
  redraw();
}


// ==================================================
// GEOMETRIA E DISEGNO DELLO ZOOM ORBITALE
// ==================================================

// Calcola centro e raggi degli archi mostrati nella vista zoom.
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


// Numero di satelliti che possono essere mostrati contemporaneamente nello zoom.
function zoomVisibleSlots() {
  return Math.max(40, Math.min(110, Math.round(width / 13)));
}


// Disegna l'arco orbitale e i satelliti della vista selezionata.
function drawZoom(quiet = false) {
  const g = zoomGeometry();
  const guideColor = quiet ? "#334544" : "#8ea3a0";
  const faintColor = quiet ? "#213130" : "#5f6e6b";
  const fraction = orbitPosition / orbitMaxPosition();

  const slots = Math.min(orbitList.length, zoomVisibleSlots());

  // Se i satelliti sono pochi, li distribuisco tutti lungo l'arco e faccio ruotare la posizione.
  const rotateAll = orbitList.length > 0 && orbitList.length <= zoomVisibleSlots();

  const start = rotateAll
    ? 0
    : Math.round(fraction * Math.max(0, orbitList.length - slots));

  const end = rotateAll
    ? orbitList.length
    : Math.min(orbitList.length, start + slots);

  // Disegno prima gli archi guida, dal più esterno a quello principale.
  push();
  noFill();
  stroke(faintColor);
  strokeWeight(0.8);
  beginShape();

  for (let j = 0; j <= 180; j++) {
    const angle = Math.PI + Math.PI * j / 180;
    vertex(
      g.cx + g.faintRadius * Math.cos(angle),
      g.cy + g.faintRadius * Math.sin(angle)
    );
  }

  endShape();

  stroke(guideColor);
  strokeWeight(1.3);
  beginShape();

  for (let j = 0; j <= 180; j++) {
    const angle = Math.PI + Math.PI * j / 180;
    vertex(
      g.cx + g.mainRadius * Math.cos(angle),
      g.cy + g.mainRadius * Math.sin(angle)
    );
  }

  endShape();
  pop();

  // L'etichetta dell'orbita non viene disegnata sopra la scheda di dettaglio.
  if (!quiet && selectedOrbit) {
    noStroke();
    fill("#d5dfdc");
    textFont(MONO);
    textSize(10);
    textAlign(CENTER, BOTTOM);
    text(selectedOrbit, g.cx, g.cy - g.mainRadius - 8);
  }

  // Svuoto i punti precedenti: l'elenco verrà ricreato durante questo disegno.
  zoomPoints = [];

  // Se non ci sono satelliti nell'anno selezionato, mostro il messaggio centrale.
  if (!orbitList.length) {
    if (!quiet) {
      noStroke();
      fill("#b4c4c0");
      textFont(MONO);
      textSize(11);
      textAlign(CENTER, CENTER);
      text(
        "NESSUN SATELLITE PER L'ANNO SELEZIONATO",
        width * 0.5,
        height * 0.46
      );
    }

    return;
  }

  // Disegno i satelliti presenti nell'intervallo corrente.
  for (let idx = start; idx < end; idx++) {
    const sat = orbitList[idx];
    const local = idx - start;

    // Calcolo la posizione angolare lungo la metà inferiore dell'arco.
    const t = rotateAll
      ? (((local + 0.5) / slots + fraction) % 1)
      : (slots <= 1 ? 0.5 : local / (slots - 1));

    const angle = Math.PI + Math.PI * t;
    const radialMix = 0.08 + 0.78 * randomFixed(sat.index, 4);
    const radius = g.innerRadius + (g.mainRadius - g.innerRadius) * radialMix;
    const x = g.cx + radius * Math.cos(angle);
    const y = g.cy + radius * Math.sin(angle);

    // Salvo la posizione per poter riconoscere hover e clic sul satellite.
    zoomPoints.push({
      sat: sat,
      x: x,
      y: y
    });

    if (quiet) {
      noStroke();
      fill("#647c76");
      circle(x, y, 3.2);

    } else {
      const selected = hoverSatellite === sat;

      // Cerchio esterno per evidenziare il satellite sotto il puntatore.
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


// ==================================================
// SELEZIONE SATELLITI E TOOLTIP
// ==================================================

// Restituisce il satellite più vicino al punto indicato, entro 12 pixel.
function satelliteAt(x, y) {
  let best = null;
  let distance = 12;

  for (const point of zoomPoints) {
    const d = Math.hypot(x - point.x, y - point.y);

    if (d < distance) {
      best = point.sat;
      distance = d;
    }
  }

  return best;
}


// Evidenzia il satellite sotto il puntatore e mostra il relativo tooltip.
function showPointHover(x, y) {
  const sat = satelliteAt(x, y);

  if (hoverSatellite !== sat) {
    hoverSatellite = sat;
    redraw();
  }

  const canvas = element("orbitCanvas");
  canvas.style.cursor = sat ? "pointer" : "";

  const tooltip = element("orbitTooltip");

  if (!sat) {
    tooltip.hidden = true;
    return;
  }

  tooltip.replaceChildren(document.createTextNode(sat.name));

  const meta = document.createElement("span");
  meta.textContent =
    `${sat.category.toUpperCase()} · ${sat.year || "ANNO N.D."} · CLICCA PER DETTAGLIO`;
  tooltip.appendChild(meta);

  // Evito che il tooltip esca dai bordi del canvas.
  tooltip.style.left = `${Math.min(width - 245, x + 16)}px`;
  tooltip.style.top = `${Math.max(10, Math.min(height - 65, y + 12))}px`;
  tooltip.hidden = false;
}


// Nasconde il tooltip e rimuove l'evidenziazione del satellite.
function hideTooltip() {
  if (element("orbitTooltip")) {
    element("orbitTooltip").hidden = true;
  }

  const canvas = element("orbitCanvas");
  if (canvas) {
    canvas.style.cursor = "";
  }

  if (hoverSatellite !== null) {
    hoverSatellite = null;
    redraw();
  }
}


// Converte le coordinate del puntatore nelle coordinate interne del canvas.
function canvasPoint(event) {
  const rect = element("orbitCanvas").getBoundingClientRect();

  return {
    x: (event.clientX - rect.left) * width / rect.width,
    y: (event.clientY - rect.top) * height / rect.height
  };
}


// ==================================================
// SELEZIONE DELLE ORBITE NELLA HOMEPAGE
// ==================================================

// Capisce quale orbita è stata cliccata nella vista generale.
function pickHomeOrbit(x, y) {
  const cx = width * 0.5;
  const cy = height * 0.51;
  const radius = Math.min(width * 0.36, height * 0.465, 350);

  const dx = x - cx;
  const dy = y - cy;

  // Ruoto le coordinate del puntatore per confrontarle con l'ellisse HEO.
  const dx0 = dx * Math.cos(tilt) + dy * Math.sin(tilt);
  const dy0 = -dx * Math.sin(tilt) + dy * Math.cos(tilt);

  const ellipseA = radius * 0.98;
  const ellipseB = radius * 0.56;

  // Distanza del puntatore dal bordo dell'ellisse HEO.
  const ellipseDist = Math.abs(
    Math.hypot(dx0 / ellipseA, dy0 / ellipseB) - 1
  ) * Math.min(ellipseA, ellipseB);

  if (ellipseDist < 12) return "HEO";

  // Per le orbite circolari uso la distanza dal centro.
  const r = Math.hypot(dx, dy) / radius;

  if (r > 1.04) return null;
  if (r < 0.69) return "LEO";
  if (r < 0.865) return "MEO";

  return "GEO";
}
