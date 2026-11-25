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

// Posizioni dei satelliti disegnati nella homepage, usate per hover e clic.
let homePoints = [];

// Aree cliccabili dei nomi delle orbite nella homepage (una per etichetta).
let homeLabels = [];

// Nome dell'orbita sotto il puntatore nella homepage (null se nessuno).
let hoverLabel = null;

// Paese selezionato nel menu laterale: "tutti" oppure una chiave di countryGroup().
let selectedCountry = "tutti";

// Velocità di rotazione dei satelliti nella vista di un'orbita.
// Uguale per tutte le orbite: aumentare questo valore le fa girare tutte più in fretta.
const ROTATION_SPEED = 3;

// Dimensioni relative delle orbite circolari rispetto al raggio della homepage.
const ORBIT_SIZES = {
  LEO: 0.60,
  MEO: 0.80,
  GEO: 0.955
};

// Ricorda se la scheda satellite è stata aperta dalla homepage (TUTTE) o dallo zoom di un'orbita.
let detailFromHome = false;

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

  // Ridimensiono il canvas ogni volta che cambia la dimensione del suo contenitore.
  if (window.ResizeObserver) {
    new ResizeObserver(() => windowResized()).observe(surface);
  }

  // Il disegno viene aggiornato solo quando viene chiamato redraw().
  noLoop();

  // Attivo tutti gli eventi di mouse, touch, slider e tastiera.
  attachInteractions(canvas.elt);

  // Imposto subito i valori iniziali dell'interfaccia.
  updateTimelineUI();
  updateViewUI();

  // Aspetto il caricamento del font, poi ridisegno il canvas con il font corretto.
  if (document.fonts) {
    await document.fonts.load('9px "IBM Plex Mono Locale"');
    redraw();
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


// Centro e raggio della homepage: centrata nella superficie e il più grande possibile.
function homeGeometry() {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const radius = Math.min(width * 0.42, (height * 0.5 - 26) / 0.96);

  return { cx: cx, cy: cy, radius: radius };
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
  // Svuoto le aree dei nomi delle orbite: vengono ricreate a ogni disegno.
  homeLabels = [];

  // Centro della visualizzazione e raggio massimo delle orbite.
  const { cx, cy, radius } = homeGeometry();

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

  // Disegno delle orbite circolari e delle relative etichette.
  for (const orbit of orbits) {
    noFill();

    // Cerchio principale dell'orbita.
    stroke("#536461");
    circle(cx, cy, radius * orbit.size * 2);

    // Nome dell'orbita: lo salvo anche come area cliccabile.
    const labelY = cy - radius * orbit.size - 9;

    noStroke();
    fill(hoverLabel === orbit.name ? "#e9ed49" : "#aab8b4");
    textFont(MONO);
    textSize(9);
    textAlign(CENTER, BASELINE);
    text(orbit.name, cx, labelY);

    const halfWidth = textWidth(orbit.name) / 2 + 4;
    homeLabels.push({
      orbit: orbit.name,
      x1: cx - halfWidth,
      x2: cx + halfWidth,
      y1: labelY - 12,
      y2: labelY + 4
    });
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
  fill(hoverLabel === "HEO" ? "#e9ed49" : "#99a8a3");
  textFont(MONO);
  textSize(9);
  textAlign(LEFT, BOTTOM);
  text("HEO", labelX + 6, labelY - 4);

  // Salvo l'area cliccabile del nome HEO.
  const heoWidth = textWidth("HEO");
  homeLabels.push({
    orbit: "HEO",
    x1: labelX + 2,
    x2: labelX + 10 + heoWidth,
    y1: labelY - 16,
    y2: labelY + 2
  });

  // La Terra è rappresentata dal cerchio centrale.
  fill("#e0e8e5");
  circle(cx, cy, 10);
}


// ==================================================
// SATELLITI NELLA HOMEPAGE
// ==================================================

function drawSatellites() {
  const { cx, cy, radius } = homeGeometry();

  // Recupero solo i satelliti lanciati entro l'anno selezionato e del paese scelto.
  const visible = getVisibleSatellites().filter(matchesCountry);

  noStroke();

  // Svuoto l'elenco dei punti: viene ricreato a ogni disegno della homepage.
  homePoints = [];

  const dotSize = Math.max(2.28, Math.min(2.96, radius / 95));

  // Disegno ogni satellite nella posizione calcolata per la sua orbita.
  for (let i = 0; i < visible.length; i++) {
    const sat = visible[i];
    const point = avoidLabels(positionFor(sat, sat.index, cx, cy, radius), cx, cy);

    // Salvo la posizione per riconoscere hover e clic sul satellite.
    homePoints.push({ sat: sat, x: point.x, y: point.y });

    // Anello giallo sul satellite sotto il puntatore, come nello zoom.
    if (hoverSatellite === sat) {
      noFill();
      stroke("#e9ed49");
      strokeWeight(1);
      circle(point.x, point.y, 12);
      noStroke();
    }

    fill(colors[sat.category] || "#d3dad7");
    circle(point.x, point.y, dotSize);
  }
}


// Se un satellite cade sopra il nome di un'orbita, lo sposto lungo il suo cerchio
// finché non è più sopra il nome. Così i nomi restano visibili e cliccabili.
function avoidLabels(point, cx, cy) {
  let p = point;

  for (let k = 0; k < 60 && labelAt(p.x, p.y) !== null; k++) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const angle = Math.atan2(dy, dx) + 0.02;
    const r = Math.hypot(dx, dy);

    p = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  return p;
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


// Vero se il satellite appartiene al paese selezionato (o se è selezionato TUTTI).
function matchesCountry(satellite) {
  return selectedCountry === "tutti" || countryGroup(satellite.country) === selectedCountry;
}


// Satelliti da contare nel pannello in alto: quelli dell'anno, filtrati per orbita e per paese.
// Nuovi filtri (per esempio categoria o paese) si aggiungono qui.
function getCountedSatellites() {
  const orbit = currentOrbitFilter();

  return getVisibleSatellites().filter(satellite =>
    (!orbit || satellite.orbit === orbit) && matchesCountry(satellite)
  );
}


// Restituisce l'orbita a cui limitare il conteggio: solo quando ne è aperta una.
function currentOrbitFilter() {
  if (viewMode === "zoom") return selectedOrbit;
  if (viewMode === "detail" && !detailFromHome) return selectedOrbit;

  return null;
}


// Costruisce il testo con percentuale e numero assoluto per il pannello categorie.
function percentText(count, total) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return `${pct}% - ${formatNumber(count)}`;
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

  // Il conteggio in alto segue anno, orbita aperta e gli eventuali altri filtri.
  element("visibleCount").textContent = formatNumber(getCountedSatellites().length);

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

  // La voce TUTTI mostra il totale dei satelliti dell'anno.
  element("country-tutti").textContent = formatNumber(visible.length);
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
  element("backToZoom").addEventListener("click", goBackFromDetail);
  element("allOrbitButton").addEventListener("click", showHome);

  // Clic su un paese: filtra la visualizzazione e il conteggio. TUTTI annulla il filtro.
  document.querySelectorAll(".country-list [data-country]").forEach(item => {
    item.addEventListener("click", () => {
      setCountry(item.dataset.country);
    });
  });

  // La voce HOMEPAGE nel menu in alto riporta alla vista d'insieme di tutte le orbite.
  element("navHome").addEventListener("click", event => {
    event.preventDefault();
    showHome();
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

    } else if (viewMode === "home") {
      // Nella homepage: hover sui satelliti e sui nomi delle orbite.
      showHomeHover(loc.x, loc.y);
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
      // Se il clic cade su un satellite apro la sua pagina, altrimenti scelgo l'orbita.
      const hitSat = satelliteAt(loc.x, loc.y);

      if (hitSat) {
        openSatellite(hitSat);
        return;
      }

      // Se il clic cade sul nome di un'orbita apro il dettaglio di quell'orbita.
      const labelOrbit = labelAt(loc.x, loc.y);

      if (labelOrbit) {
        openOrbit(labelOrbit);
        return;
      }

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
        goBackFromDetail();
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
    // Torno alla homepage se la scheda era stata aperta da lì, altrimenti allo zoom.
    viewMode = detailFromHome ? "home" : "zoom";
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

  // Memorizzo da dove arrivo, così il pulsante "indietro" torna nel posto giusto.
  detailFromHome = viewMode === "home";

  detailSatellite = sat;
  viewMode = "detail";
  hideTooltip();

  // Riempio i campi della scheda usando i valori letti dal CSV.
  element("detailName").textContent = sat.name;
  element("detailMeta").textContent =
    `${sat.orbitType || ORBIT_NAMES[sat.orbit] || "ORBITA NON SPECIFICATA"} - ${sat.year || "DATA NON DISPONIBILE"}`;

  element("detailOrbit").textContent = sat.orbit;
  element("detailCategory").textContent = sat.category;
  element("detailLaunch").textContent = sat.launch || "Non disponibile";
  element("detailCountry").textContent = sat.country || "Non disponibile";
  element("detailOperator").textContent = sat.operator || "Non disponibile";
  element("detailPurpose").textContent = sat.purpose || "Non disponibile";

  updateViewUI();
  redraw();
}


// Imposta il paese selezionato, evidenzia la voce scelta e aggiorna visualizzazione e conteggi.
function setCountry(country) {
  selectedCountry = country;

  document.querySelectorAll(".country-list [data-country]").forEach(item => {
    item.querySelector("i").classList.toggle("is-active", item.dataset.country === country);
  });

  // Se è aperta un'orbita, ricostruisco la sua lista con il nuovo filtro.
  rebuildOrbitList();
  updateStatsPanel();
  redraw();
}


// Torna alla vista da cui era stata aperta la scheda: homepage oppure orbita.
function goBackFromDetail() {
  if (detailFromHome) {
    showHome();
  } else {
    openOrbit(selectedOrbit, true);
  }
}


// Aggiorna classi CSS e visibilità degli elementi in base alla vista attiva.
function updateViewUI() {
  surface.classList.toggle("is-home", viewMode === "home");
  surface.classList.toggle("is-zoom", viewMode === "zoom");
  surface.classList.toggle("is-detail", viewMode === "detail");

  element("orbitInteraction").hidden = viewMode !== "zoom";
  element("satelliteDetail").hidden = viewMode !== "detail";

  // Nella scheda satellite nascondo la vista principale e mostro solo la pagina del satellite.
  element("mainLayout").hidden = viewMode === "detail";
  document.documentElement.classList.toggle("is-detail-page", viewMode === "detail");

  // Il testo del pulsante indietro cambia in base alla provenienza.
  element("backToZoom").textContent = detailFromHome
    ? "← TORNA ALLA HOME"
    : "← TORNA ALL'ORBITA";

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
      (satellite.year === null || satellite.year <= selectedYear) &&
      matchesCountry(satellite)
    );
  } else {
    orbitList = [];
  }

  orbitPosition = Math.min(orbitPosition, orbitMaxPosition());
  updateOrbitSlider();
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
  // L'icona della mano segue la posizione verticale dello slider.
  const rail = document.querySelector(".orbit-slider-frame");
  const hand = element("orbitHand");

  if (rail && hand && rail.clientHeight > 0) {
    // La barra ha il valore 0 in basso: la manina deve partire dallo stesso lato.
    hand.style.top = `${9 + (rail.clientHeight - 18) * (1 - fraction)}px`;
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
    mainRadius: outerRadius - 58
  };
}


// Disegna un arco della vista zoom (la metà inferiore di un cerchio) con il raggio indicato.
function drawGuideArc(g, radius) {
  beginShape();

  for (let j = 0; j <= 180; j++) {
    const angle = Math.PI + Math.PI * j / 180;
    vertex(
      g.cx + radius * Math.cos(angle),
      g.cy + radius * Math.sin(angle)
    );
  }

  endShape();
}


// Layout fisso della vista zoom, sempre quello della MEO: LEO dentro, MEO al centro, GEO fuori.
// I raggi sono proporzionali alle dimensioni della homepage, così le orbite restano coerenti.
function zoomArcs(g) {
  return [
    { name: "LEO", radius: g.mainRadius * ORBIT_SIZES.LEO / ORBIT_SIZES.MEO },
    { name: "MEO", radius: g.mainRadius },
    { name: "GEO", radius: g.mainRadius * ORBIT_SIZES.GEO / ORBIT_SIZES.MEO }
  ];
}


// Fascia in cui stanno i satelliti di un'orbita. Va da metà strada dall'arco precedente
// a metà strada da quello successivo, così non supera mai le altre orbite.
function zoomBand(orbit, g) {
  const arcs = zoomArcs(g);
  let i = arcs.findIndex(arc => arc.name === orbit);

  // Se l'orbita non è una delle tre (per esempio HEO), uso la fascia della MEO.
  if (i === -1) i = 1;

  const r = arcs[i].radius;

  // Per il primo e l'ultimo arco, il vicino mancante è simmetrico all'altro.
  const prev = i > 0 ? arcs[i - 1].radius : 2 * r - arcs[i + 1].radius;
  const next = i < arcs.length - 1 ? arcs[i + 1].radius : 2 * r - arcs[i - 1].radius;

  return {
    lo: (prev + r) / 2 + 4,
    // Non vado oltre il bordo superiore del canvas.
    hi: Math.min((r + next) / 2 - 4, g.cy - 8)
  };
}


// Sposta un punto lungo la sua circonferenza (intorno a cx, cy) finché non esce dall'area box.
// Se box è null non fa nulla.
function avoidBox(x, y, cx, cy, box) {
  if (!box) return { x: x, y: y };

  let p = { x: x, y: y };

  for (let k = 0; k < 80 && isInBox(p, box); k++) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const angle = Math.atan2(dy, dx) + 0.02;
    const r = Math.hypot(dx, dy);

    p = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  return p;
}


// Vero se il punto è dentro il rettangolo box.
function isInBox(p, box) {
  return p.x >= box.x1 && p.x <= box.x2 && p.y >= box.y1 && p.y <= box.y2;
}


// Raggio dell'arco dell'orbita indicata. Se non è una delle tre orbite, usa l'arco centrale.
function zoomArcRadius(orbit, g) {
  for (const arc of zoomArcs(g)) {
    if (arc.name === orbit) return arc.radius;
  }

  return g.mainRadius;
}


// Numero di satelliti che possono essere mostrati contemporaneamente nello zoom.
function zoomVisibleSlots() {
  return Math.max(40, Math.min(110, Math.round(width / 13)));
}


// Disegna l'arco orbitale e i satelliti della vista selezionata.
function drawZoom(quiet = false) {
  const g = zoomGeometry();
  const guideColor = quiet ? "#334544" : "#8ea3a0";
  // Orbite non selezionate: colore semi-trasparente, così non disturbano i satelliti.
  const faintColor = quiet ? "rgba(51, 69, 68, 0.3)" : "rgba(142, 163, 160, 0.22)";
  const fraction = orbitPosition / orbitMaxPosition();

  // Numero di satelliti dell'orbita e numero di posizioni mostrate sull'arco.
  // Ogni orbita ha le stesse posizioni e la stessa rotazione, quindi la velocità è uguale.
  const count = orbitList.length;
  const slots = Math.min(count, zoomVisibleSlots());

  // Disegno sempre il layout della MEO: LEO dentro, MEO al centro, GEO fuori.
  // Cambia solo l'arco evidenziato, cioè quello dell'orbita selezionata.
  push();
  noFill();

  if (selectedOrbit !== "HEO") {
    // Archi non selezionati: sfumati.
    stroke(faintColor);
    strokeWeight(0.8);

    for (const arc of zoomArcs(g)) {
      if (arc.name !== selectedOrbit) {
        drawGuideArc(g, arc.radius);
      }
    }

    // Arco dell'orbita selezionata: pieno e più visibile.
    stroke(guideColor);
    strokeWeight(1.3);
    drawGuideArc(g, zoomArcRadius(selectedOrbit, g));

  } else {
    // HEO: solo un arco principale tratteggiato.
    stroke(guideColor);
    strokeWeight(1.3);
    drawingContext.setLineDash([4, 6]);
    drawGuideArc(g, g.mainRadius);
    drawingContext.setLineDash([]);
  }

  pop();

  // L'etichetta dell'orbita non viene disegnata sopra la scheda di dettaglio.
  if (!quiet && selectedOrbit) {
    noStroke();
    fill("#d5dfdc");
    textFont(MONO);
    textSize(10);
    textAlign(CENTER, BOTTOM);
    text(selectedOrbit, g.cx, g.cy - zoomArcRadius(selectedOrbit, g) - 8);
  }

  // Svuoto i punti precedenti: l'elenco verrà ricreato durante questo disegno.
  zoomPoints = [];

  // Se non ci sono satelliti nell'anno selezionato, mostro il messaggio centrale.
  if (!orbitList.length) {
    if (!quiet) {
      // Messaggio su due righe, centrato sul centro dell'arco.
      // Posizionato a metà raggio: non tocca l'etichetta dell'orbita in alto né l'arco esterno.
      const msgY = g.cy - g.mainRadius * 0.45;

      noStroke();
      fill("#b4c4c0");
      textFont(MONO);
      textSize(11);
      textAlign(CENTER, CENTER);
      text("NESSUN SATELLITE", g.cx, msgY - 8);
      text("PER L'ANNO SELEZIONATO", g.cx, msgY + 8);
    }

    return;
  }

  // Fascia radiale in cui si distribuiscono i satelliti dell'orbita selezionata.
  const band = zoomBand(selectedOrbit, g);

  // Area occupata dalla scritta con il nome dell'orbita: i satelliti non ci devono entrare.
  let labelBox = null;

  if (!quiet && selectedOrbit) {
    textFont(MONO);
    textSize(10);

    const labelY = g.cy - zoomArcRadius(selectedOrbit, g) - 8;
    const halfWidth = textWidth(selectedOrbit) / 2 + 6;

    labelBox = {
      x1: g.cx - halfWidth,
      x2: g.cx + halfWidth,
      y1: labelY - 16,
      y2: labelY + 4
    };
  }

  // Disegno i satelliti presenti nell'intervallo corrente.
  for (let local = 0; local < slots; local++) {
    // Scelgo un satellite della lista in modo uniforme: se sono molti ne mostro un sottoinsieme distribuito.
    const sat = orbitList[Math.floor((local + 0.5) * count / slots)];

    // Posizione angolare lungo la metà inferiore dell'arco: stessa rotazione per tutte le orbite.
    const t = ((local + 0.5) / slots + fraction * ROTATION_SPEED) % 1;

    const angle = Math.PI + Math.PI * t;
    // Il satellite va in un punto sparso nella fascia, sia dentro sia fuori il suo arco.
    const radius = band.lo + (band.hi - band.lo) * randomFixed(sat.index, 4);
    // Se il punto cade sulla scritta dell'orbita lo sposto lungo il suo arco.
    const placed = avoidBox(
      g.cx + radius * Math.cos(angle),
      g.cy + radius * Math.sin(angle),
      g.cx,
      g.cy,
      labelBox
    );
    const x = placed.x;
    const y = placed.y;

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
  // Nella homepage uso i punti delle orbite generali, altrimenti quelli dello zoom.
  const points = viewMode === "home" ? homePoints : zoomPoints;
  let best = null;
  let distance = 12;

  for (const point of points) {
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

  // Prima riga: nome del satellite.
  tooltip.replaceChildren(document.createTextNode(sat.name));

  // Seconda riga: tipologia e anno.
  const info = document.createElement("span");
  info.textContent = `${sat.category.toUpperCase()} - ${sat.year || "ANNO N.D."}`;
  tooltip.appendChild(info);

  // Terza riga: invito a cliccare per aprire il dettaglio.
  const action = document.createElement("span");
  action.textContent = "CLICCA PER DETTAGLIO";
  tooltip.appendChild(action);

  // Evito che il tooltip esca dai bordi del canvas.
  tooltip.style.left = `${Math.min(width - 245, x + 16)}px`;
  tooltip.style.top = `${Math.max(10, Math.min(height - 65, y + 12))}px`;
  tooltip.hidden = false;
}


// Nella homepage gestisce l'hover sui satelliti e quello giallo sul nome delle orbite.
function showHomeHover(x, y) {
  showPointHover(x, y);

  const label = labelAt(x, y);

  if (label !== hoverLabel) {
    hoverLabel = label;
    redraw();
  }

  // Sul nome dell'orbita il cursore diventa una manina.
  if (label) {
    element("orbitCanvas").style.cursor = "pointer";
  }
}


// Nasconde il tooltip e rimuove l'evidenziazione del satellite.
function hideTooltip() {
  if (hoverLabel !== null) {
    hoverLabel = null;
    redraw();
  }

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

// Restituisce il nome dell'orbita se il puntatore è sopra il suo nome nella homepage.
function labelAt(x, y) {
  for (const box of homeLabels) {
    if (x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2) {
      return box.orbit;
    }
  }

  return null;
}


// Capisce quale orbita è stata cliccata nella vista generale.
function pickHomeOrbit(x, y) {
  const { cx, cy, radius } = homeGeometry();

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