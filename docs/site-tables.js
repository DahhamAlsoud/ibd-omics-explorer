function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted && char === '"' && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(field);
      field = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value !== "")) rows.push(row);

  const headers = rows.shift();
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function textIncludes(value, needle) {
  return String(value || "").toLowerCase().includes(String(needle || "").toLowerCase());
}

function splitValues(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item && item !== "Unclear");
}

function uniqueValues(data, column) {
  return Array.from(new Set(data.flatMap((row) => splitValues(row[column])))).sort((a, b) => a.localeCompare(b));
}

function cellValue(row, column) {
  if (column === "dataset_url" && row.dataset_url && row.dataset_url !== "Unclear") {
    return `<a href="${row.dataset_url}" target="_blank" rel="noopener">source</a>`;
  }
  return String(row[column] || "Unclear");
}

function renderTable(container, data, columns, labels, rows = 20) {
  const limited = data.slice(0, rows);
  const table = document.createElement("table");
  table.className = "registry-table";
  table.innerHTML = `
    <thead>
      <tr>${columns.map((column) => `<th>${labels[column] || column}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${limited
        .map(
          (row) => `
            <tr>${columns.map((column) => `<td>${cellValue(row, column)}</td>`).join("")}</tr>
          `
        )
        .join("")}
    </tbody>
  `;
  container.innerHTML = "";
  container.appendChild(table);

  if (data.length > limited.length) {
    const note = document.createElement("p");
    note.className = "table-note";
    note.textContent = `Showing ${limited.length} of ${data.length} matching entries. Use the full Datasets page for complete metadata.`;
    container.appendChild(note);
  }
}

function renderDatasetExplorer(data) {
  const root = document.querySelector("#dataset-explorer");
  if (!root) return;

  const labels = {
    dataset_name: "Dataset",
    accession: "Accession",
    omics_layer: "Omics Layer",
    disease: "Disease",
    population: "Population",
    sample_type: "Sample Type",
    tissue_site: "Tissue Site",
    data_access_status: "Access",
    curation_status: "Curation",
    dataset_url: "Source"
  };
  const columns = Object.keys(labels);

  root.innerHTML = `
    <div class="filter-panel">
      <label>Search <input id="registry-search" type="search" placeholder="pediatric, colon, GWAS, proteomics"></label>
      <label>Omics <select id="registry-omics"><option>All</option></select></label>
      <label>Access <select id="registry-access"><option>All</option></select></label>
      <label>Sample <select id="registry-sample"><option>All</option></select></label>
    </div>
    <p id="registry-count" class="table-note"></p>
    <div id="registry-table"></div>
  `;

  const search = root.querySelector("#registry-search");
  const omics = root.querySelector("#registry-omics");
  const access = root.querySelector("#registry-access");
  const sample = root.querySelector("#registry-sample");
  const count = root.querySelector("#registry-count");
  const table = root.querySelector("#registry-table");

  uniqueValues(data, "omics_layer").forEach((value) => omics.append(new Option(value, value)));
  uniqueValues(data, "data_access_status").forEach((value) => access.append(new Option(value, value)));
  uniqueValues(data, "sample_type").forEach((value) => sample.append(new Option(value, value)));

  function update() {
    const term = search.value.trim().toLowerCase();
    const filtered = data.filter((row) => {
      const termMatch = !term || Object.values(row).some((value) => textIncludes(value, term));
      const omicsMatch = omics.value === "All" || textIncludes(row.omics_layer, omics.value);
      const accessMatch = access.value === "All" || textIncludes(row.data_access_status, access.value);
      const sampleMatch = sample.value === "All" || textIncludes(row.sample_type, sample.value);
      return termMatch && omicsMatch && accessMatch && sampleMatch;
    });
    count.textContent = `Showing ${filtered.length} of ${data.length} entries`;
    renderTable(table, filtered, columns, labels, 37);
  }

  [search, omics, access, sample].forEach((control) => control.addEventListener("input", update));
  update();
}

function renderSimpleTables(data) {
  const labels = {
    dataset_name: "Dataset",
    accession: "Accession",
    omics_layer: "Omics Layer",
    disease: "Disease",
    population: "Population",
    sample_type: "Sample Type",
    tissue_site: "Tissue Site",
    platform: "Platform",
    data_access_status: "Access",
    curation_status: "Curation",
    longitudinal: "Longitudinal",
    treatment_metadata: "Treatment Data"
  };

  document.querySelectorAll("[data-registry-table]").forEach((node) => {
    const layer = node.dataset.layer;
    const any = node.dataset.any ? node.dataset.any.split("|") : [];
    const columns = (node.dataset.columns || "dataset_name,accession,omics_layer,disease,sample_type,data_access_status")
      .split(",")
      .map((item) => item.trim());
    const rows = Number(node.dataset.rows || 12);
    const filtered = data.filter((row) => {
      if (layer && !textIncludes(row.omics_layer, layer)) return false;
      if (any.length > 0) {
        const haystack = `${row.potential_use_cases} ${row.omics_layer} ${row.disease} ${row.sample_type} ${row.tissue_site} ${row.population}`.toLowerCase();
        return any.some((keyword) => haystack.includes(keyword.toLowerCase()));
      }
      return true;
    });
    renderTable(node, filtered, columns, labels, rows);
  });
}

async function initRegistryTables() {
  const response = await fetch("data/ibd_omics_datasets.csv");
  const data = parseCsv(await response.text());
  renderDatasetExplorer(data);
  renderSimpleTables(data);
}

document.addEventListener("DOMContentLoaded", initRegistryTables);
