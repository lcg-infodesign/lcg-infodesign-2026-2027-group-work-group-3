//
// VARIABILI GENERALI
//

const HEADER_H = 44;
const SIDE_W = 300;
const CAT_NAMES = ['Commerciale', 'Governativo', 'Militare', 'Civile', 'Ibrido/altro'];
const CAT_COL = ['#5fe04a', '#3b5bff', '#ff2d8a', '#8a4bff', '#19e6e6'];
const ORB_NAMES = ['LEO', 'MEO', 'GEO', 'HEO'];
const CTRY_NAMES = ['USA', 'Europa', 'Cina', 'Russia', 'Altro'];
const PURP_NAMES = ['Comunicazioni', 'Oss. Terra', 'Tecnologia', 'Navigazione', 'Scienza/altro'];
const LENS_NAMES = { orbita: 'Orbita', chi: 'Chi', taglia: 'Taglia' };
const EUROPE = ['UK', 'France', 'Germany', 'Italy', 'Spain', 'Luxembourg', 'Netherlands', 'Switzerland',
  'Sweden', 'Norway', 'Finland', 'Denmark', 'Belgium', 'Poland', 'ESA', 'Austria', 'Greece'];
const COL = { bg: '#0a0f0e', line: '#2a3733', dim: '#3a4a45', mute: '#8a9a94', txt: '#e8efe9', acc: '#f2e600', grn: '#5fe04a' };
const CSV_PATH = 'assets/UCS-Satellite-Database.csv';


//
// Lettura del CSV e costruzione dei satelliti con i relativi aggregati
let SATS = [], OPS = [], AGG = {};

function str(r, c) {
  if (!table.columns.includes(c)) return '';
  const v = r.getString(c);
  return v == null ? '' : v;
}

function num(r, c) {
  const v = parseFloat(str(r, c));
  return isNaN(v) ? null : v;
}function mapCat(u) { const m = { Commercial: 0, Government: 1, Military: 2, Civil: 3 }[u.trim()]; return m === undefined ? 4 : m; }
function mapOrb(s) { s = s.trim().toUpperCase(); return s === 'LEO' ? 0 : s === 'MEO' ? 1 : s === 'GEO' ? 2 : 3; }
function mapPurp(s) {
  return s.startsWith('Communications') ? 0 : s.startsWith('Earth Obs') ? 1 : s.startsWith('Technology') ? 2 : s.startsWith('Navigation') ? 3 : 4;
}
function mapCtry(s) {
  if (s.includes('USA')) return 0;
  if (s.includes('China')) return 2;
  if (s.includes('Russia')) return 3;
  return EUROPE.some(e => s.includes(e)) ? 1 : 4;
}
function shortOp(s) {
  if (s.includes('SpaceX')) return 'SpaceX';
  if (s.includes('OneWeb')) return 'OneWeb';
  if (s.includes('Planet')) return 'Planet Labs';
  if (s.includes('Chinese')) return 'Difesa Cina';
  return s.length > 20 ? s.slice(0, 20) + '…' : s;
}
function tally(arr, n) { const c = new Array(n).fill(0); arr.forEach(i => c[i]++); return c; }

function buildData(table) {
  const rgb = CAT_COL.map(h => { const c = color(h); return [red(c), green(c), blue(c)]; });
  const opCount = {};
  for (const r of table.getRows()) { const o = str(r,'Operator/Owner'); opCount[o] = (opCount[o] || 0) + 1; }
  const top = Object.keys(opCount).filter(k => k).sort((a, b) => opCount[b] - opCount[a]).slice(0, 12);
  OPS = top.map(shortOp).concat(['Altri']);

  for (const r of table.getRows()) {
    const name = r.getString('Current Official Name of Satellite').trim();
    if (!name) continue;
    const y = parseInt(r.getString('Date of Launch').slice(0, 4));
    const opRaw = r.getString('Operator/Owner'), cat = mapCat(r.getString('Users')), oi = top.indexOf(opRaw);
    SATS.push({
      i: SATS.length, name, opRaw, op: oi < 0 ? top.length : oi, cat, rgb: rgb[cat],
      orb: mapOrb(r.getString('Class of Orbit')), purp: mapPurp(r.getString('Purpose')),
      ctry: mapCtry(r.getString('Country of Operator/Owner')), ctryRaw: r.getString('Country of Operator/Owner'),
      reg: r.getString('Country/Org of UN Registry'), year: isNaN(y) ? null : y, date: r.getString('Date of Launch').slice(0, 10),
      mass: num(r, 'Launch Mass (kg.)'), power: num(r, 'Power (watts)'), inc: num(r, 'Inclination (degrees)'),
      pe: num(r, 'Perigee (km)'), ap: num(r, 'Apogee (km)'), period: num(r, 'Period (minutes)'), life: num(r, 'Expected Lifetime (yrs.)'),
      vehicle: r.getString('Launch Vehicle'), site: r.getString('Launch Site'), contractor: r.getString('Contractor'),
      cctry: r.getString('Country of Contractor'), otype: r.getString('Type of Orbit'), detail: r.getString('Detailed Purpose'),
      x: 0, y: 0, tx: 0, ty: 0, a: 1, ta: 1, P: {}
    });
  }
  computeAggregates();
}

function computeAggregates() {
  AGG.cat = tally(SATS.map(s => s.cat), 5);
  AGG.purp = tally(SATS.map(s => s.purp), 5);
  AGG.ctry = tally(SATS.map(s => s.ctry), 5);
  AGG.opN = tally(SATS.map(s => s.op), OPS.length);
  AGG.years = {}; AGG.vehicle = {};
  for (const s of SATS) {
    if (s.year !== null) AGG.years[s.year] = (AGG.years[s.year] || 0) + 1;
    if (s.vehicle) AGG.vehicle[s.vehicle] = (AGG.vehicle[s.vehicle] || 0) + 1;
  }
  AGG.yearMax = max(Object.values(AGG.years));
  AGG.vehMax = max(Object.values(AGG.vehicle));
  const lives = SATS.filter(s => s.life).map(s => s.life).sort((a, b) => a - b);
  AGG.lifeMed = lives[floor(lives.length / 2)];
  AGG.masses = SATS.filter(s => s.mass > 0).map(s => s.mass);
  AGG.powers = SATS.filter(s => s.power > 0).map(s => s.power);
}

function similarTo(s) {
  return SATS.filter(x => x !== s && x.orb === s.orb && x.cat === s.cat)
    .sort((a, b) => ((b.op === s.op) - (a.op === s.op)) || (abs(a.year - s.year) - abs(b.year - s.year))).slice(0, 8);
}


//
//QUESTO SARà UNA PAG A Sè
// Pagina di dettaglio del singolo satellite, con grafici di contesto
function card(x, y, w, h, title) {
  noFill(); stroke(COL.dim); strokeWeight(1); rect(x, y, w, h);
  uiText(title, x + 12, y + 20, 11, COL.grn);
  return { x: x + 12, y: y + 34, w: w - 24 };
}

function drawDetail() {
  const s = SATS[S.sel], col = CAT_COL[s.cat];
  UI.offY = S.scroll; push(); translate(0, -S.scroll);
  let y = HEADER_H + 20;
  uiButton(24, y, 170, 26, '← Torna a ' + LENS_NAMES[S.lens], false, () => { S.view = 'explore'; S.scroll = 0; });
  y += 66;
  uiText(cut(s.name.toUpperCase(), 40), 24, y, 28, col);
  uiText(cut(s.opRaw, 70) + ' · una di ' + fmt(AGG.opN[s.op]) + ' con questo operatore', 24, y + 22, 12, COL.mute);
  y += 46;
  const gap = 12, cols = width > 1150 ? 3 : width > 720 ? 2 : 1, cw = (width - 48 - gap * (cols - 1)) / cols, ch = 262;
  const draws = [['TRAIETTORIA', chartTraj], ['MISSIONE', chartMission], ['MESSA IN ORBITA', chartLaunch],
    ['DATI TECNICI', chartTech], ['ORIGINE E ACCORDI', chartOrigin], ['SATELLITI SIMILI', chartSimilar]];
  draws.forEach((d, i) => {
    const cx = 24 + (i % cols) * (cw + gap), cy = y + floor(i / cols) * (ch + gap);
    const c = card(cx, cy, cw, ch, d[0]); d[1](s, c.x, c.y, c.w, col);
  });
  S.maxScroll = max(0, y + ceil(draws.length / cols) * (ch + gap) + 20 - height);
  pop(); UI.offY = 0;
}

function chartTraj(s, x, y, w, col) {
  if (s.pe === null || s.ap === null) { uiText('dati orbitali non disponibili', x, y + 20, 11, COL.mute); return; }
  const RA = s.ap + 6371, RP = s.pe + 6371, k = 72 / RA, a = (RA + RP) / 2 * k, e = (RA - RP) / (RA + RP);
  const b = a * sqrt(1 - e * e), c = a * e, ang = (s.inc > 90 ? 180 - s.inc : s.inc) || 0, ex = x + w * 0.42, ey = y + 84;
  dashedLine(x, ey, x + w, ey);
  push(); translate(ex, ey); rotate(-radians(ang)); noFill(); stroke(col); strokeWeight(1.6); ellipse(c, 0, 2 * a, 2 * b); pop();
  fill('#13201c'); stroke(COL.mute); strokeWeight(1); circle(ex, ey, 2 * 6371 * k);
  uiText('inclinazione ' + (s.inc === null ? 'n/d' : s.inc.toFixed(1) + '°') + ' · ' + ORB_NAMES[s.orb], x, y + 176, 11, COL.txt);
  uiText('perigeo ' + fmt(s.pe) + ' km · apogeo ' + fmt(s.ap) + ' km', x, y + 192, 11, COL.mute);
  uiText(s.period ? 'periodo ' + s.period.toFixed(0) + ' min · ' + (1440 / s.period).toFixed(1) + ' giri/giorno' : 'periodo n/d', x, y + 208, 11, COL.mute);
}

function chartMission(s, x, y, w, col) {
  let xo = x; noStroke();
  AGG.cat.forEach((q, i) => { const c = color(CAT_COL[i]); c.setAlpha(i === s.cat ? 255 : 80); fill(c); const bw = q / SATS.length * w; rect(xo, y, max(1, bw), 14); xo += bw; });
  uiText(CAT_NAMES[s.cat] + ': ' + round(AGG.cat[s.cat] / SATS.length * 100) + '% del totale', x, y + 34, 11, COL.txt);
  uiText('scopo: ' + PURP_NAMES[s.purp] + (s.detail ? ' · ' + cut(s.detail, 22) : ''), x, y + 52, 11, COL.mute);
  uiBars(PURP_NAMES.map((n, i) => [n, AGG.purp[i]]), x, y + 68, w, s.purp, col, 96);
}

function chartLaunch(s, x, y, w, col) {
  const bw = w / 54;
  noStroke();
  for (let i = 0; i < 54; i++) {
    const v = (AGG.years[1970 + i] || 0) / AGG.yearMax * 60;
    fill(1970 + i === s.year ? col : COL.dim); rect(x + i * bw, y + 62 - v, bw - 1, v);
  }
  uiText('1970', x, y + 76, 11, COL.mute); uiText('2023', x + w, y + 76, 11, COL.mute, RIGHT);
  uiText('lanciato il ' + s.date + ' · ' + fmt(AGG.years[s.year] || 0) + ' lanci quell’anno', x, y + 96, 11, COL.txt);
  uiText('razzo: ' + cut(s.vehicle || 'n/d', 22) + (AGG.vehicle[s.vehicle] ? ' (' + fmt(AGG.vehicle[s.vehicle]) + ' lanci)' : ''), x, y + 112, 11, COL.mute);
  uiText('luogo: ' + cut(s.site || 'n/d', 30), x, y + 128, 11, COL.mute);
  if (s.life) {
    noFill(); stroke(COL.mute); rect(x, y + 142, w, 8);
    noStroke(); fill(col); rect(x, y + 142, min(w, s.life / 15 * w), 8);
    stroke(COL.acc); line(x + AGG.lifeMed / 15 * w, y + 138, x + AGG.lifeMed / 15 * w, y + 154);
    uiText('vita attesa ' + s.life + ' anni · mediana ' + AGG.lifeMed, x, y + 170, 11, COL.mute);
  } else uiText('vita attesa: dato non disponibile', x, y + 150, 11, COL.mute);
}

function strip(vals, v, x, y, w, maxLog, col, label, unit) {
  uiText(label, x, y, 11, COL.txt);
  if (v > 0) {
    noStroke(); fill(COL.dim);
    vals.forEach((m, i) => circle(x + 6 + constrain(log(m) / log(10) / maxLog, 0, 1) * (w - 12), y + 14 + (i % 7) * 3, 3));
    const px = x + 6 + constrain(log(v) / log(10) / maxLog, 0, 1) * (w - 12);
    fill(col); circle(px, y + 24, 11);
    uiText(fmt(v) + ' ' + unit, px, y + 46, 11, COL.txt, CENTER);
  } else {
    dashedLine(x, y + 20, x + w, y + 20); uiText('dato non disponibile', x, y + 40, 11, COL.mute);
  }
}

function chartTech(s, x, y, w, col) {
  strip(AGG.masses, s.mass, x, y + 8, w, 4.2, col, 'massa al lancio (1 kg … 10 t)', 'kg');
  strip(AGG.powers, s.power, x, y + 100, w, 5, col, 'potenza (1 W … 100 kW)', 'W');
  uiText('puntini grigi = tutti gli altri satelliti', x, y + 200, 11, COL.mute);
}

function chartOrigin(s, x, y, w, col) {
  const rows = [['registro', s.reg], ['operatore', s.ctryRaw], ['contraente', s.contractor], ['paese contr.', s.cctry]];
  rows.forEach((r, i) => { uiText(r[0], x, y + 10 + i * 16, 11, COL.mute); uiText(cut(r[1] || 'n/d', 28), x + 92, y + 10 + i * 16, 11, COL.txt); });
  uiText('paesi per n. di satelliti', x, y + 92, 11, COL.mute);
  uiBars(CTRY_NAMES.map((n, i) => [n, AGG.ctry[i]]), x, y + 102, w, s.ctry, col, 70);
}

function chartSimilar(s, x, y, w, col) {
  const sim = similarTo(s);
  if (!sim.length) { uiText('nessun satellite simile', x, y + 14, 11, COL.mute); return; }
  sim.slice(0, 6).forEach((o, i) => {
    uiButton(x, y + i * 28, w, 24, cut(o.name, 34), false, () => { S.sel = o.i; S.scroll = 0; }, CAT_COL[o.cat]);
  });
  uiButton(x, y + 6 * 28 + 4, w, 24, 'Vedi nel gruppo →', true, () => { S.view = 'explore'; S.scroll = 0; });
}









//
// Main canvas
// Palco (home e intermedio), barra laterale e testata
function stageT() {
  const w = width - SIDE_W, h = height - HEADER_H, s = min(w / 640, h / 440);
  return { s, ox: (w - 640 * s) / 2, oy: HEADER_H + (h - 440 * s) / 2 };
}
const sx = (T, x) => T.ox + x * T.s, sy = (T, y) => T.oy + y * T.s;

function drawStageBg(k, T) {
  noFill(); strokeWeight(1);
  if (k === 'home') {
    [[108, 'LEO'], [128, 'MEO'], [168, 'GEO'], [198, 'HEO']].forEach(([r, n]) => {
      stroke(COL.dim); circle(sx(T, 320), sy(T, 225), 2 * r * T.s);
      uiText(n, sx(T, 320), sy(T, 225 - r - 3), 11, COL.mute, CENTER);
    });
    noStroke(); fill(COL.txt); circle(sx(T, 320), sy(T, 225), 14 * T.s);
  } else if (k === 'orbita') {
    [[2000, '2.000 km'], [35786, 'GEO 35.786 km']].forEach(([a, n]) => {
      const r = arcR(a); stroke(COL.dim); arc(sx(T, 320), sy(T, 410), 2 * r * T.s, 2 * r * T.s, PI, TWO_PI);
      uiText(n, sx(T, 320), sy(T, 410 - r - 4), 11, COL.mute, CENTER);
    });
    stroke(COL.dim); line(sx(T, 20), sy(T, 410), sx(T, 620), sy(T, 410));
    uiText('0° equat.', sx(T, 40), sy(T, 428), 11, COL.mute, CENTER);
    uiText('90° polare', sx(T, 320), sy(T, 428), 11, COL.mute, CENTER);
    uiText('180° retrogr.', sx(T, 600), sy(T, 428), 11, COL.mute, CENTER);
    uiText('angolo = inclinazione · raggio = altitudine (scala log)', sx(T, 320), sy(T, 20), 11, COL.mute, CENTER);
  } else if (k === 'chi') {
    const cnt = new Array(OPS.length).fill(0);
    for (const s of SATS) if (passes(s)) cnt[s.op]++;
    CHI.forEach((c, i) => uiText(c.name + ' · ' + fmt(cnt[i]), sx(T, c.x), sy(T, c.y - c.r - 8), 11, COL.txt, CENTER));
    uiText('ogni gruppo = un operatore', sx(T, 320), sy(T, 436), 11, COL.mute, CENTER);
  } else {
    stroke(COL.dim); line(sx(T, 50), sy(T, 405), sx(T, 615), sy(T, 405)); line(sx(T, 50), sy(T, 40), sx(T, 50), sy(T, 405));
    uiText('1970', sx(T, 50), sy(T, 422), 11, COL.mute); uiText('2023', sx(T, 610), sy(T, 422), 11, COL.mute, RIGHT);
    uiText('10 t', sx(T, 46), sy(T, 58), 11, COL.mute, RIGHT); uiText('1 kg', sx(T, 46), sy(T, 405), 11, COL.mute, RIGHT);
    uiText('massa al lancio (log) contro anno · in basso: massa non nota', sx(T, 60), sy(T, 436), 11, COL.mute);
  }
}

let HOVER = null;
function drawDots(T) {
  const d = max(1.6, 1.9 * T.s);
  noStroke(); HOVER = null; let best = 8;
  for (const s of SATS) {
    s.x += (s.tx - s.x) * 0.14; s.y += (s.ty - s.y) * 0.14; s.a += (s.ta - s.a) * 0.14;
    if (s.a < 0.03) continue;
    const px = sx(T, s.x), py = sy(T, s.y);
    fill(s.rgb[0], s.rgb[1], s.rgb[2], 255 * s.a);
    circle(px, py, d);
    if (s.a > 0.5 && mouseX < width - SIDE_W) { const dd = dist(mouseX, mouseY, px, py); if (dd < best) { best = dd; HOVER = s; } }
  }
  if (S.sel !== null) {
    const s = SATS[S.sel]; noFill(); stroke(COL.acc); strokeWeight(2); circle(sx(T, s.x), sy(T, s.y), 14);
  }
  if (HOVER) {
    const t = HOVER.name + ' · ' + (HOVER.year || '—') + ' · ' + cut(HOVER.opRaw, 28);
    textSize(11); const w = textWidth(t) + 14, x = min(mouseX + 12, width - SIDE_W - w - 4), y = mouseY + 14;
    fill(COL.bg); stroke(COL.grn); strokeWeight(1); rect(x, y, w, 22);
    uiText(t, x + 7, y + 15, 11, COL.txt);
  }
}

function drawSidebar(counts) {
  const x = width - SIDE_W, px = x + 16, pw = SIDE_W - 32;
  stroke(COL.line); strokeWeight(1); line(x, HEADER_H, x, height);
  let y = HEADER_H + 62;
  uiText(fmt(counts.n), px, y, 46, COL.txt);
  uiText('su ' + fmt(SATS.length) + ' satelliti nel database', px, y + 18, 11, COL.mute);
  y += 46;
  if (S.view === 'home') {
    uiText('FILTRA PER CATEGORIA', px, y, 11, COL.grn); y += 10;
    const m = max(counts.cat) || 1;
    CAT_NAMES.forEach((n, i) => {
      const off = S.cat !== null && S.cat !== i;
      noStroke(); const bc = color(CAT_COL[i]); bc.setAlpha(off ? 70 : 255); fill(bc);
      rect(px, y + 6, max(2, counts.cat[i] / m * (pw - 120)), 8);
      uiText(n + ' ' + fmt(counts.cat[i]), px, y + 4, 11, off ? COL.dim : COL.txt);
      uiHit(px, y - 6, pw, 26, () => toggle('cat', i)); y += 28;
    });
    y += 8; uiText('SELEZIONA ORBITA', px, y, 11, COL.grn); y += 8;
    y = uiChips(ORB_NAMES, S.orb, px, y, pw, i => toggle('orb', i));
    uiText('SELEZIONA PAESE', px, y + 4, 11, COL.grn); y += 12;
    y = uiChips(CTRY_NAMES, S.ctry, px, y, pw, i => toggle('ctry', i));
  } else {
    uiText('CAMBIA PUNTO DI VISTA', px, y, 11, COL.grn); y += 8;
    y = uiChips(Object.values(LENS_NAMES), Object.keys(LENS_NAMES).indexOf(S.lens), px, y, pw, i => { S.lens = Object.keys(LENS_NAMES)[i]; });
  }
  uiText('ANNO ≤ ' + floor(S.yr), px, y + 4, 11, COL.grn); y += 22;
  S.yr = uiSlider(px, y, pw - 70, S.yr, 1970, 2023, 'yr');
  uiButton(px + pw - 60, y - 12, 60, 24, S.play ? 'PAUSA' : '▶ PLAY', S.play, () => { if (S.yr >= 2023) S.yr = 1970; S.play = !S.play; });
  y += 30;
  if (S.view === 'home') { uiButton(px, y, pw, 32, 'Esplora ' + fmt(counts.n) + ' satelliti →', true, () => { S.view = 'explore'; }); y += 44; }
  if (S.sel !== null) drawSelected(px, y, pw);
  else if (S.view === 'explore') uiText('Passa sopra un puntino, clicca per selezionarlo.', px, y + 4, 11, COL.mute);
}

function drawSelected(px, y, pw) {
  const s = SATS[S.sel];
  stroke(COL.dim); noFill(); rect(px, y, pw, 112);
  uiText('SELEZIONATO', px + 10, y + 18, 11, COL.grn);
  uiText(cut(s.name, 30), px + 10, y + 38, 12, COL.txt);
  uiText(cut(s.opRaw, 34), px + 10, y + 54, 11, COL.mute);
  uiText(ORB_NAMES[s.orb] + ' · ' + (s.year || '—') + ' · ' + PURP_NAMES[s.purp], px + 10, y + 68, 11, COL.mute);
  uiButton(px + 10, y + 78, pw - 20, 26, 'Apri scheda →', true, () => { S.view = 'detail'; S.scroll = 0; });
}

function drawHeader() {
  noStroke(); fill(COL.bg); rect(0, 0, width, HEADER_H);
  stroke(COL.line); line(0, HEADER_H, width, HEADER_H);
  uiText('★', 16, 27, 12, COL.acc); uiText('SATELLITI', 32, 27, 12, COL.txt);
  const items = [['Home', () => { S.view = 'home'; }]];
  if (S.orb !== null) items.push([ORB_NAMES[S.orb], null]);
  if (S.cat !== null) items.push([CAT_NAMES[S.cat], null]);
  if (S.ctry !== null) items.push([CTRY_NAMES[S.ctry], null]);
  if (S.view !== 'home') items.push(['Esplora · ' + LENS_NAMES[S.lens], () => { S.view = 'explore'; }]);
  if (S.view === 'detail') items.push([cut(SATS[S.sel].name, 28), null]);
  let x = 140; textSize(12);
  items.forEach((it, i) => {
    const w = textWidth(it[0]), last = i === items.length - 1;
    uiText(it[0], x, 27, 12, last ? COL.txt : COL.mute);
    if (it[1]) uiHit(x, 14, w, 18, it[1]);
    x += w + 8; if (!last) { uiText('›', x, 27, 12, COL.dim); x += 16; }
  });
}






//
//
// Posizioni di ogni satellite per ciascuna vista, in coordinate di palco 640x440
let CHI = [];

function arcR(alt) { return 50 + 240 * constrain(log(alt / 300) / log(135), 0, 1); }
function massY(m) { return constrain(log(m) / log(10) / 4.2, 0, 1); }

function buildLayouts() {
  randomSeed(7);
  const band = [[40, 105], [118, 128], [150, 168], [180, 198]];
  for (const s of SATS) {
    const a = random(TWO_PI), r = random(band[s.orb][0], band[s.orb][1]);
    const th = radians(constrain(s.inc === null ? 90 : s.inc, 0, 180)) + random(-0.008, 0.008);
    const q = arcR(((s.pe || 500) + (s.ap || 500)) / 2) + random(-2, 2);
    s.P.home = [320 + r * cos(a), 225 + r * sin(a)];
    s.P.orbita = [320 - q * cos(th), 410 - q * sin(th)];
    s.P.taglia = [50 + ((s.year === null ? 2000 : s.year) - 1970) / 53 * 560 + random(-1, 1), s.mass > 0 ? 405 - massY(s.mass) * 350 : 428];
  }
  layoutChi();
  for (const s of SATS) { s.x = s.P.home[0]; s.y = s.P.home[1]; }
}

// Raggruppa i satelliti per operatore: cerchi impacchettati, punti a girasole
function layoutChi() {
  const n = AGG.opN, order = n.map((v, i) => i).sort((p, q) => n[q] - n[p]), C = new Array(n.length);
  const placed = [];
  for (const i of order) {
    const r = sqrt(n[i] + 0.5);
    let pos = [0, 0];
    if (placed.length) {
      search: for (let d = 0; d < 800; d += 2) {
        for (let a = 0; a < TWO_PI; a += 0.2) {
          const p = [d * cos(a), d * sin(a)];
          if (placed.every(q => dist(p[0], p[1], q.x, q.y) >= r + q.r + 5)) { pos = p; break search; }
        }
      }
    }
    placed.push(C[i] = { x: pos[0], y: pos[1], r });
  }
  const x0 = min(C.map(c => c.x - c.r)), x1 = max(C.map(c => c.x + c.r));
  const y0 = min(C.map(c => c.y - c.r)), y1 = max(C.map(c => c.y + c.r));
  const sc = min(580 / (x1 - x0), 350 / (y1 - y0)), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  CHI = C.map((c, i) => ({ x: 320 + (c.x - mx) * sc, y: 232 + (c.y - my) * sc, r: c.r * sc, name: OPS[i] }));
  const k = new Array(n.length).fill(0);
  for (const s of SATS) {
    const c = CHI[s.op], j = k[s.op]++, rr = sc * sqrt(j + 0.5), a = j * 2.39996;
    s.P.chi = [c.x + rr * cos(a), c.y + rr * sin(a)];
  }
}




//
//
// Punto di ingresso p5: preload, setup, draw ed eventi
let table;

function preload() { table = loadTable(CSV_PATH, 'csv', 'header'); }

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('monospace');

  console.log("COLONNE PRESENTI NEL CSV:", table.columns);

  buildData(table);
  buildLayouts();
}

function draw() {
  background(COL.bg);
  uiBegin();
  if (S.play) { S.yr = min(2023, S.yr + 0.12); if (S.yr >= 2023) S.play = false; }
  if (S.view === 'detail') { drawDetail(); drawHeader(); return; }
  const T = stageT(), counts = computeCounts();
  setTargets();
  drawStageBg(lensKey(), T);
  drawDots(T);
  drawSidebar(counts);
  drawHeader();
}

function mousePressed() {
  if (uiClick()) return;
  if (S.view !== 'detail' && mouseX < width - SIDE_W && mouseY > HEADER_H) S.sel = HOVER ? HOVER.i : null;
}

function mouseReleased() { UI.drag = null; }
function mouseWheel(e) { if (S.view === 'detail') { S.scroll = constrain(S.scroll + e.delta, 0, S.maxScroll); return false; } }
function windowResized() { resizeCanvas(windowWidth, windowHeight); }





//
//
// Stato globale dell'interfaccia e logica dei filtri
const S = { view: 'home', lens: 'orbita', cat: null, orb: null, ctry: null, yr: 2023, sel: null, play: false, scroll: 0, maxScroll: 0 };

function passes(s, skip) {
  if (skip !== 'cat' && S.cat !== null && s.cat !== S.cat) return false;
  if (S.orb !== null && s.orb !== S.orb) return false;
  if (S.ctry !== null && s.ctry !== S.ctry) return false;
  return s.year === null || s.year <= S.yr;
}

function computeCounts() {
  const c = { n: 0, cat: [0, 0, 0, 0, 0] };
  for (const s of SATS) {
    if (passes(s, 'cat')) {
      c.cat[s.cat]++;
      if (S.cat === null || s.cat === S.cat) c.n++;
    }
  }
  return c;
}

function toggle(key, v) { S[key] = S[key] === v ? null : v; }
function lensKey() { return S.view === 'home' ? 'home' : S.lens; }
function fmt(n) { return nfc(Math.round(n)).replace(/,/g, '.'); }

function setTargets() {
  const k = lensKey();
  for (const s of SATS) {
    const p = s.P[k];
    s.tx = p[0]; s.ty = p[1];
    s.ta = passes(s) ? ((k === 'taglia' && !s.mass) ? 0.25 : 1) : 0;
  }
}




// Mini libreria di widget disegnati con p5 (bottoni, slider, testo, grafici a barre)
const UI = { hits: [], prev: [], drag: null, offY: 0 };

function uiBegin() { UI.prev = UI.hits; UI.hits = []; }
function inRect(mx, my, x, y, w, h) { return mx >= x && mx <= x + w && my >= y && my <= y + h; }
function uiHit(x, y, w, h, cb) { UI.hits.push({ x, y: y - UI.offY, w, h, cb }); }
function uiClick() {
  for (let i = UI.prev.length - 1; i >= 0; i--) {
    const h = UI.prev[i];
    if (inRect(mouseX, mouseY, h.x, h.y, h.w, h.h)) { h.cb(); return true; }
  }
  return false;
}

function uiText(str, x, y, size, col, al) {
  noStroke(); fill(col || COL.txt); textSize(size || 12); textAlign(al || LEFT, BASELINE); text(str, x, y);
}
function cut(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function uiButton(x, y, w, h, label, on, cb, col) {
  const over = inRect(mouseX, mouseY + UI.offY, x, y, w, h);
  strokeWeight(1); stroke(on ? COL.acc : over ? COL.txt : '#4a5a55');
  if (on) fill(COL.acc); else noFill();
  rect(x, y, w, h);
  noStroke(); fill(on ? COL.bg : (col || COL.txt)); textSize(12); textAlign(CENTER, CENTER);
  text(label, x + w / 2, y + h / 2 + 1);
  uiHit(x, y, w, h, cb);
}

// Fila di bottoni a capo automatico; restituisce la y successiva
function uiChips(labels, active, x, y, maxW, cb) {
  let cx = x, cy = y;
  textSize(12);
  labels.forEach((l, i) => {
    const w = textWidth(l) + 18;
    if (cx + w > x + maxW) { cx = x; cy += 30; }
    uiButton(cx, cy, w, 24, l, active === i, () => cb(i));
    cx += w + 6;
  });
  return cy + 34;
}

function uiSlider(x, y, w, val, mn, mx, id) {
  if (UI.drag === id && mouseIsPressed) val = constrain(map(mouseX, x, x + w, mn, mx), mn, mx);
  const kx = map(val, mn, mx, x, x + w);
  stroke(COL.dim); strokeWeight(2); line(x, y, x + w, y);
  stroke(COL.acc); line(x, y, kx, y);
  noStroke(); fill(COL.acc); circle(kx, y, 12);
  uiHit(x - 8, y - 12, w + 16, 24, () => { UI.drag = id; });
  return val;
}

// Grafico a barre orizzontali: rows = [[etichetta, valore], ...]
function uiBars(rows, x, y, w, hi, col, labW) {
  const m = max(rows.map(r => r[1])) || 1;
  rows.forEach((r, i) => {
    uiText(r[0], x, y + i * 18 + 10, 11, i === hi ? COL.txt : COL.mute);
    noStroke(); fill(i === hi ? col : COL.dim);
    rect(x + labW, y + i * 18 + 2, max(2, r[1] / m * (w - labW)), 9);
  });
}

function dashedLine(x1, y1, x2, y2) {
  stroke(COL.dim); strokeWeight(1);
  const n = floor(dist(x1, y1, x2, y2) / 6);
  for (let i = 0; i < n; i += 2) line(lerp(x1, x2, i / n), lerp(y1, y2, i / n), lerp(x1, x2, (i + 1) / n), lerp(y1, y2, (i + 1) / n));
}
