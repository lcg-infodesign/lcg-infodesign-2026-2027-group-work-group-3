let satellites = [];
let selectedYear = 2023;
let playing = false;
let animationStart = 0;
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
const slider = document.getElementById("yearSlider");
const playButton = document.getElementById("playButton");
const element = id => document.getElementById(id);

function setup() {
  let canvas = createCanvas(surface.clientWidth, surface.clientHeight);
  canvas.parent("orbitSurface");
  canvas.id("orbitCanvas");
  noLoop();

  slider.addEventListener("input", onYearChange);
  playButton.addEventListener("click", togglePlay);

  // Ridisegno quando il font del grafico è pronto
  document.fonts.load('9px "IBM Plex Mono Locale"').then(() => redraw());

  // Carico il dataset da satelliti.csv (serve Live Server)
  fetch("satelliti.csv")
    .then(response => {
      if (!response.ok) throw new Error("file non trovato");
      return response.text();
    })
    .then(text => loadData(readUCS(text)))
    .catch(error => alert("Impossibile caricare satelliti.csv: " + error.message));
}

function draw() {
  if (playing) updateAnimation();

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

function onYearChange() {
  stopPlay();
  changeYear(Number(slider.value));
}

function changeYear(year) {
  selectedYear = year;
  slider.value = year;
  slider.style.setProperty("--progress", 100 * (year - Number(slider.min)) /
    (Number(slider.max) - Number(slider.min) || 1) + "%");
  element("yearOutput").textContent = year;
  redraw();
}

function togglePlay() {
  if (playing) {
    stopPlay();
    return;
  }
  playing = true;
  animationStart = millis();
  element("playIcon").textContent = "Ⅱ";
  element("playLabel").textContent = "PAUSA";
  loop();
}

function updateAnimation() {
  let progress = Math.min((millis() - animationStart) / 8500, 1);
  let year = Math.floor(Number(slider.min) + (Number(slider.max) - Number(slider.min)) * progress);
  changeYear(year);
  if (progress >= 1) stopPlay();
}

function stopPlay() {
  playing = false;
  noLoop();
  element("playIcon").textContent = "▶";
  element("playLabel").textContent = "PLAY";
}

function windowResized() {
  resizeCanvas(surface.clientWidth, surface.clientHeight);
  redraw();
}

function loadData(records) {
  satellites = records;
  let years = records.map(sat => sat.year).filter(Number.isFinite);
  let minYear = Math.min(...years);
  let maxYear = Math.max(...years);

  slider.min = minYear;
  slider.max = maxYear;
  let ticks = [0, 0.2, 0.42, 0.65, 0.88, 1].map(t => Math.round(minYear + (maxYear - minYear) * t));
  document.querySelectorAll(".year-ticks span").forEach((tick, i) => {
    tick.textContent = ticks[i];
    tick.style.setProperty("--tick", (ticks[i] - minYear) * 100 / (maxYear - minYear || 1) + "%");
  });

  stopPlay();
  changeYear(maxYear);
}