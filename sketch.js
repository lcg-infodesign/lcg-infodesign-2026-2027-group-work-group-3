let satellites = [];
const selectedYear = 2023; // Timeline fissa, senza animazione
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
  drawOrbits();
  drawSatellites();
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
  redraw();
}

function loadData(records) {
  satellites = records;
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
    else if (orbitText.includes("HEO") || orbitText.includes("ELLIPTIC")) orbit = "HEO";

    result.push({ name, category, orbit, year: Number.isFinite(year) ? year : null });
  }
  if (!result.length) throw new Error("Non sono stati trovati satelliti validi.");
  return result;
}

// Scrive i numeri con il punto delle migliaia (es. 7.000)
function formatNumber(number) {
  return String(Math.trunc(number)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
