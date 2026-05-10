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

function escapeHtml(value) {
  return String(value || "Unclear")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cellValue(row, column) {
  if ((column === "dataset_url" || column === "publication_url" || column === "evidence_url") && row[column] && row[column] !== "Unclear") {
    return `<a href="${escapeHtml(row[column])}" target="_blank" rel="noopener">link</a>`;
  }
  return escapeHtml(row[column] || "Unclear");
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
    study_name: "Study Name",
    accession: "Accession",
    omics_layer: "Omics Layer",
    disease: "Disease",
    population: "Population",
    sample_type: "Sample Type",
    tissue_site: "Tissue Site",
    data_access_status: "Access",
    verification_status: "Verification",
    manual_review: "Manual Review",
    dataset_url: "Source"
  };
  const columns = [
    "dataset_id",
    "dataset_name",
    "study_name",
    "accession",
    "omics_layer",
    "disease",
    "population",
    "sample_type",
    "data_access_status",
    "dataset_url"
  ];
  labels.dataset_id = "ID";

  root.innerHTML = `
    <div class="filter-panel">
      <label>Search <input id="registry-search" type="search" placeholder="pediatric, colon, GWAS, proteomics"></label>
      <label>Omics <select id="registry-omics"><option>All</option></select></label>
      <label>Access <select id="registry-access"><option>All</option></select></label>
      <label>Sample <select id="registry-sample"><option>All</option></select></label>
      <label>Verification <select id="registry-verification"><option>All</option></select></label>
    </div>
    <p id="registry-count" class="table-note"></p>
    <div id="registry-table"></div>
    <details class="dataset-detail-panel">
      <summary>Detailed fields for current filtered set</summary>
      <div id="registry-detail-table"></div>
    </details>
  `;

  const search = root.querySelector("#registry-search");
  const omics = root.querySelector("#registry-omics");
  const access = root.querySelector("#registry-access");
  const sample = root.querySelector("#registry-sample");
  const verification = root.querySelector("#registry-verification");
  const count = root.querySelector("#registry-count");
  const table = root.querySelector("#registry-table");
  const detailTable = root.querySelector("#registry-detail-table");

  uniqueValues(data, "omics_layer").forEach((value) => omics.append(new Option(value, value)));
  uniqueValues(data, "data_access_status").forEach((value) => access.append(new Option(value, value)));
  uniqueValues(data, "sample_type").forEach((value) => sample.append(new Option(value, value)));
  uniqueValues(data, "verification_status").forEach((value) => verification.append(new Option(value, value)));

  function update() {
    const term = search.value.trim().toLowerCase();
    const filtered = data.filter((row) => {
      const termMatch = !term || Object.values(row).some((value) => textIncludes(value, term));
      const omicsMatch = omics.value === "All" || textIncludes(row.omics_layer, omics.value);
      const accessMatch = access.value === "All" || textIncludes(row.data_access_status, access.value);
      const sampleMatch = sample.value === "All" || textIncludes(row.sample_type, sample.value);
      const verificationMatch = verification.value === "All" || row.verification_status === verification.value;
      return termMatch && omicsMatch && accessMatch && sampleMatch && verificationMatch;
    });
    count.textContent = `Showing ${filtered.length} of ${data.length} entries`;
    renderTable(table, filtered, columns, labels, filtered.length);
    renderTable(
      detailTable,
      filtered,
      [
        "dataset_id",
        "dataset_name",
        "study_name",
        "publication_title",
        "publication_year",
        "doi",
        "pmid",
        "platform",
        "study_design",
        "sample_size_subjects",
        "raw_data_available",
        "processed_data_available",
        "controlled_access",
        "curation_status",
        "verification_status",
        "verification_notes",
        "evidence_url"
      ],
      {
        dataset_id: "ID",
        dataset_name: "Dataset",
        study_name: "Study Name",
        publication_title: "Publication",
        publication_year: "Year",
        doi: "DOI",
        pmid: "PMID",
        platform: "Platform",
        study_design: "Design",
        sample_size_subjects: "N Subjects",
        raw_data_available: "Raw",
        processed_data_available: "Processed",
        controlled_access: "Controlled",
        curation_status: "Curation",
        verification_status: "Verification",
        verification_notes: "Verification Notes",
        evidence_url: "Evidence"
      },
      filtered.length
    );
  }

  [search, omics, access, sample, verification].forEach((control) => control.addEventListener("input", update));
  update();
}

function renderSimpleTables(data) {
  const labels = {
    dataset_name: "Dataset",
    study_name: "Study Name",
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
    treatment_metadata: "Treatment Data",
    verification_status: "Verification",
    controlled_access: "Controlled Access"
  };

  document.querySelectorAll("[data-registry-table]").forEach((node) => {
    const layer = node.dataset.layer;
    const any = node.dataset.any ? node.dataset.any.split("|") : [];
    const flag = node.dataset.flag;
    const columns = (node.dataset.columns || "dataset_name,accession,omics_layer,disease,sample_type,data_access_status")
      .split(",")
      .map((item) => item.trim());
    const rows = Number(node.dataset.rows || 12);
    const filtered = data.filter((row) => {
      if (layer && !textIncludes(row.omics_layer, layer)) return false;
      if (flag && row[flag] !== "TRUE") return false;
      if (any.length > 0) {
        const haystack = `${row.potential_use_cases} ${row.omics_layer} ${row.disease} ${row.sample_type} ${row.tissue_site} ${row.population}`.toLowerCase();
        return any.some((keyword) => haystack.includes(keyword.toLowerCase()));
      }
      return true;
    });
    renderTable(node, filtered, columns, labels, rows);
  });
}

function verificationRisk(row) {
  if (!row.dataset_url || row.dataset_url === "Unclear") return "Missing source URL";
  if (row.publication_title === "Unclear" || row.publication_year === "Unclear") return "Publication metadata incomplete";
  if (row.controlled_access === "Yes" || textIncludes(row.data_access_status, "Controlled access")) return "Controlled-access resource";
  if (textIncludes(row.repository_type, "portal") || textIncludes(row.accession, "multiple")) return "Broad portal or multi-accession resource";
  if (["disease", "sample_type", "platform", "data_access_status"].some((column) => row[column] === "Unclear")) return "Key metadata unclear";
  return "General verification needed";
}

function renderVerificationQueue(data) {
  const root = document.querySelector("#verification-queue");
  if (!root) return;

  const queued = data
    .filter((row) => row.verification_status !== "analysis_ready_candidate")
    .map((row) => ({ ...row, verification_risk: verificationRisk(row) }))
    .sort((a, b) => a.verification_risk.localeCompare(b.verification_risk) || a.dataset_id.localeCompare(b.dataset_id));

  const counts = queued.reduce((acc, row) => {
    acc[row.verification_risk] = (acc[row.verification_risk] || 0) + 1;
    return acc;
  }, {});

  root.innerHTML = `
    <div class="metrics-grid compact-metrics">
      <div class="metric-card"><div class="metric-value">${data.length}</div><div class="metric-label">Total Entries</div></div>
      <div class="metric-card"><div class="metric-value">${queued.length}</div><div class="metric-label">In Queue</div></div>
      <div class="metric-card"><div class="metric-value">${data.filter((row) => row.source_record_checked === "TRUE").length}</div><div class="metric-label">Source Checked</div></div>
      <div class="metric-card"><div class="metric-value">${data.filter((row) => row.publication_checked === "TRUE").length}</div><div class="metric-label">Publication Checked</div></div>
    </div>
    <div id="verification-risk-summary"></div>
    <div id="verification-queue-table"></div>
  `;

  renderTable(
    root.querySelector("#verification-risk-summary"),
    Object.entries(counts).map(([risk, count]) => ({ risk, count })),
    ["risk", "count"],
    { risk: "Queue Reason", count: "Entries" },
    20
  );

  renderTable(
    root.querySelector("#verification-queue-table"),
    queued,
    [
      "dataset_id",
      "dataset_name",
      "study_name",
      "accession",
      "repository",
      "verification_risk",
      "verification_status",
      "publication_title",
      "publication_year",
      "dataset_url",
      "verification_notes"
    ],
    {
      dataset_id: "ID",
      dataset_name: "Dataset",
      study_name: "Study Name",
      accession: "Accession",
      repository: "Repository",
      verification_risk: "Queue Reason",
      verification_status: "Status",
      publication_title: "Publication",
      publication_year: "Year",
      dataset_url: "Source",
      verification_notes: "Notes"
    },
    100
  );
}

function renderIntegratedResources(resources) {
  const root = document.querySelector("#integrated-resources");
  if (!root) return;

  const labels = {
    resource_id: "ID",
    resource_name: "Resource",
    resource_type: "Type",
    scope: "Scope",
    omics_layers: "Omics Layers",
    included_diseases: "Diseases",
    approx_size: "Approx. Size",
    source_datasets: "Source Datasets",
    access_model: "Access",
    access_url: "Resource",
    publication_title: "Publication",
    publication_year: "Year",
    doi: "DOI",
    pmid: "PMID",
    limitations: "Limitations",
    verification_status: "Status",
    evidence_url: "Evidence"
  };

  root.innerHTML = `
    <div class="filter-panel">
      <label>Search <input id="resource-search" type="search" placeholder="scIBD, Gut Cell Atlas, GWAS, CELLxGENE"></label>
      <label>Type <select id="resource-type"><option>All</option></select></label>
      <label>Omics <select id="resource-omics"><option>All</option></select></label>
      <label>Status <select id="resource-status"><option>All</option></select></label>
    </div>
    <p id="resource-count" class="table-note"></p>
    <div id="integrated-resource-table"></div>
    <details class="dataset-detail-panel">
      <summary>Detailed fields for current filtered set</summary>
      <div id="resource-detail-table"></div>
    </details>
  `;

  const search = root.querySelector("#resource-search");
  const type = root.querySelector("#resource-type");
  const omics = root.querySelector("#resource-omics");
  const status = root.querySelector("#resource-status");
  const count = root.querySelector("#resource-count");
  const table = root.querySelector("#integrated-resource-table");
  const detailTable = root.querySelector("#resource-detail-table");

  uniqueValues(resources, "resource_type").forEach((value) => type.append(new Option(value, value)));
  uniqueValues(resources, "omics_layers").forEach((value) => omics.append(new Option(value, value)));
  uniqueValues(resources, "verification_status").forEach((value) => status.append(new Option(value, value)));

  function update() {
    const term = search.value.trim().toLowerCase();
    const filtered = resources.filter((row) => {
      const termMatch = !term || Object.values(row).some((value) => textIncludes(value, term));
      const typeMatch = type.value === "All" || row.resource_type === type.value;
      const omicsMatch = omics.value === "All" || textIncludes(row.omics_layers, omics.value);
      const statusMatch = status.value === "All" || row.verification_status === status.value;
      return termMatch && typeMatch && omicsMatch && statusMatch;
    });
    count.textContent = `Showing ${filtered.length} of ${resources.length} resources`;
    renderTable(
      table,
      filtered,
      ["resource_id", "resource_name", "resource_type", "omics_layers", "included_diseases", "approx_size", "access_url"],
      labels,
      filtered.length
    );
    renderTable(
      detailTable,
      filtered,
      ["resource_id", "resource_name", "scope", "source_datasets", "access_model", "publication_title", "publication_year", "doi", "pmid", "limitations", "verification_status", "evidence_url"],
      labels,
      filtered.length
    );
  }

  [search, type, omics, status].forEach((control) => control.addEventListener("input", update));
  update();
}

async function initRegistryTables() {
  const response = await fetch("data/ibd_omics_datasets.csv");
  const data = parseCsv(await response.text());
  renderDatasetExplorer(data);
  renderSimpleTables(data);
  renderVerificationQueue(data);

  const resourcesRoot = document.querySelector("#integrated-resources");
  if (resourcesRoot) {
    const resourcesResponse = await fetch("data/integrated_resources.csv");
    const resources = parseCsv(await resourcesResponse.text());
    renderIntegratedResources(resources);
  }
}

document.addEventListener("DOMContentLoaded", initRegistryTables);
