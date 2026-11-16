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