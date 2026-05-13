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
  if ((column.endsWith("_url") || column === "access_url" || column === "representative_source_url") && row[column] && row[column] !== "Unclear") {
    const urls = String(row[column])
      .split(";")
      .map((item) => item.trim())
      .filter((item) => /^https?:\/\//i.test(item));
    if (urls.length > 0) {
      return urls.map((url, index) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">link${urls.length > 1 ? ` ${index + 1}` : ""}</a>`).join("<br>");
    }
  }
  if (column === "doi" && row[column] && row[column] !== "Unclear") {
    return String(row[column])
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((doi) => {
        const url = doi.startsWith("http") ? doi : `https://doi.org/${doi}`;
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(doi.replace(/^https?:\/\/doi\.org\//i, ""))}</a>`;
      })
      .join("<br>");
  }
  if (column === "pmid" && row[column] && row[column] !== "Unclear") {
    return String(row[column])
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((pmid) => `<a href="https://pubmed.ncbi.nlm.nih.gov/${escapeHtml(pmid)}/" target="_blank" rel="noopener">${escapeHtml(pmid)}</a>`)
      .join("<br>");
  }
  if (column === "publication_title" && row.publication_url && row.publication_url !== "Unclear" && row[column] && row[column] !== "Unclear") {
    const firstUrl = String(row.publication_url)
      .split(";")
      .map((item) => item.trim())
      .find((item) => /^https?:\/\//i.test(item));
    if (firstUrl) {
      return `<a href="${escapeHtml(firstUrl)}" target="_blank" rel="noopener">${escapeHtml(row[column])}</a>`;
    }
  }
  if (column === "count_as_independent_cohort") {
    const value = row[column];
    if (value === "TRUE") return "Count";
    if (value === "FALSE") return "Do not count";
  }
  if (row[column] === "TRUE" || row[column] === "FALSE") {
    return booleanText(row[column]);
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
    note.textContent = `Showing ${limited.length} of ${data.length} matching entries. Use the full Datasets page for complete registry annotations.`;
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
    sample_type: "Specimen Type",
    tissue_site: "Anatomical Site",
    data_access_status: "Data Access",
    verification_status: "Verification Status",
    manual_review: "Manual Review",
    study_family: "Study Family",
    component_of_dataset_id: "Parent Dataset",
    count_as_independent_cohort: "Cohort Count Status",
    overlap_notes: "Overlap Notes",
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
      <label>Search <input id="registry-search" type="search" placeholder="PROTECT, RISK, IBDMDB, scIBD, PURSUIT, pediatric, colon"></label>
      <label>Omics <select id="registry-omics"><option>All</option></select></label>
      <label>Data Access <select id="registry-access"><option>All</option></select></label>
      <label>Specimen <select id="registry-sample"><option>All</option></select></label>
      <label>Verification Status <select id="registry-verification"><option>All</option></select></label>
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
        "study_family",
        "component_of_dataset_id",
        "count_as_independent_cohort",
        "overlap_notes",
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
        study_family: "Study Family",
        component_of_dataset_id: "Parent Dataset",
        count_as_independent_cohort: "Cohort Count Status",
        overlap_notes: "Overlap Notes",
        sample_size_subjects: "N Subjects",
        raw_data_available: "Raw",
        processed_data_available: "Processed",
        controlled_access: "Controlled",
        curation_status: "Curation Status",
        verification_status: "Verification Status",
        verification_notes: "Verification Notes",
        evidence_url: "Evidence"
      },
      filtered.length
    );
  }

  [search, omics, access, sample, verification].forEach((control) => control.addEventListener("input", update));
  update();
}

function booleanText(value) {
  if (value === "TRUE") return "Yes";
  if (value === "FALSE") return "No";
  return value || "Unclear";
}

function renderStudyFamilies(families, matrix) {
  const root = document.querySelector("#study-family-explorer");
  const matrixRoot = document.querySelector("#study-modality-matrix");
  if (!root && !matrixRoot) return;

  const familyLabels = {
    study_family: "Study Family",
    dataset_count: "Rows",
    counted_cohort_rows: "Counted Cohorts",
    not_counted_rows: "Not Counted",
    unclear_countability_rows: "Unclear",
    primary_dataset_ids: "Primary Dataset IDs",
    all_dataset_ids: "All Dataset IDs",
    origin_types: "Origin",
    omics_layers: "Omics Layers",
    diseases: "Diseases",
    specimen_types: "Specimen Types",
    anatomical_sites: "Anatomical Sites",
    clinical_trial_or_treatment: "Trial/Treatment",
    reuse_readiness_best: "Best Reuse Readiness",
    manual_review_needed: "Manual Review",
    representative_source_url: "Source",
    notes: "Notes"
  };

  if (root) {
    root.innerHTML = `
      <div class="filter-panel coverage-filters">
        <label>Search <input id="family-search" type="search" placeholder="PROTECT, RISK, IBDMDB, trial, ileum"></label>
        <label>Origin <select id="family-origin"><option>All</option></select></label>
        <label>Readiness <select id="family-readiness"><option>All</option></select></label>
        <label>Manual Review <select id="family-review"><option>All</option></select></label>
      </div>
      <div class="metrics-grid compact-metrics" id="family-metrics"></div>
      <p id="family-count" class="table-note"></p>
      <div id="family-table"></div>
      <details class="dataset-detail-panel">
        <summary>Detailed family fields</summary>
        <div id="family-detail-table"></div>
      </details>
    `;

    const search = root.querySelector("#family-search");
    const origin = root.querySelector("#family-origin");
    const readiness = root.querySelector("#family-readiness");
    const review = root.querySelector("#family-review");
    const metrics = root.querySelector("#family-metrics");
    const count = root.querySelector("#family-count");
    const table = root.querySelector("#family-table");
    const detailTable = root.querySelector("#family-detail-table");

    uniqueValues(families, "origin_types").forEach((value) => origin.append(new Option(value, value)));
    uniqueValues(families, "reuse_readiness_best").forEach((value) => readiness.append(new Option(value, value)));
    uniqueValues(families, "manual_review_needed").forEach((value) => review.append(new Option(booleanText(value), value)));

    function update() {
      const term = search.value.trim().toLowerCase();
      const filtered = families.filter((row) => {
        const termMatch = !term || Object.values(row).some((value) => textIncludes(value, term));
        const originMatch = origin.value === "All" || textIncludes(row.origin_types, origin.value);
        const readinessMatch = readiness.value === "All" || row.reuse_readiness_best === readiness.value;
        const reviewMatch = review.value === "All" || row.manual_review_needed === review.value;
        return termMatch && originMatch && readinessMatch && reviewMatch;
      });

      metrics.innerHTML = `
        <div class="metric-card"><div class="metric-value">${families.length}</div><div class="metric-label">Study Families</div></div>
        <div class="metric-card"><div class="metric-value">${families.reduce((sum, row) => sum + Number(row.dataset_count || 0), 0)}</div><div class="metric-label">Dataset Rows</div></div>
        <div class="metric-card"><div class="metric-value">${families.filter((row) => row.clinical_trial_or_treatment === "TRUE").length}</div><div class="metric-label">Trial/Treatment Families</div></div>
        <div class="metric-card"><div class="metric-value">${families.filter((row) => row.manual_review_needed === "TRUE").length}</div><div class="metric-label">Manual Review</div></div>
      `;
      count.textContent = `Showing ${filtered.length} of ${families.length} study families`;
      renderTable(table, filtered, ["study_family", "dataset_count", "counted_cohort_rows", "origin_types", "omics_layers", "reuse_readiness_best", "manual_review_needed", "primary_dataset_ids"], familyLabels, filtered.length);
      renderTable(detailTable, filtered, ["study_family", "all_dataset_ids", "diseases", "specimen_types", "anatomical_sites", "not_counted_rows", "unclear_countability_rows", "representative_source_url", "notes"], familyLabels, filtered.length);
    }

    [search, origin, readiness, review].forEach((control) => control.addEventListener("input", update));
    update();
  }

  if (matrixRoot) {
    const labels = {
      study_family: "Study Family",
      dataset_count: "Rows",
      counted_cohort_rows: "Counted",
      origin_types: "Origin",
      reuse_readiness_best: "Readiness",
      dataset_ids: "Dataset IDs"
    };
    const modalityColumns = [
      "Bulk transcriptomics",
      "Single-cell transcriptomics",
      "Spatial transcriptomics",
      "Microbiome",
      "Metagenomics",
      "Metatranscriptomics",
      "Proteomics",
      "Metaproteomics",
      "Metabolomics",
      "DNA methylation / epigenomics",
      "Genetics / GWAS",
      "Multi-omics"
    ];
    modalityColumns.forEach((column) => { labels[column] = column; });
    matrixRoot.innerHTML = `
      <div class="filter-panel coverage-filters">
        <label>Search <input id="matrix-search" type="search" placeholder="PROTECT, RISK, metabolomics, single-cell"></label>
        <label>Modality <select id="matrix-modality"><option>All</option></select></label>
        <label>Readiness <select id="matrix-readiness"><option>All</option></select></label>
      </div>
      <p id="matrix-count" class="table-note"></p>
      <div id="matrix-table"></div>
    `;

    const search = matrixRoot.querySelector("#matrix-search");
    const modality = matrixRoot.querySelector("#matrix-modality");
    const readiness = matrixRoot.querySelector("#matrix-readiness");
    const count = matrixRoot.querySelector("#matrix-count");
    const table = matrixRoot.querySelector("#matrix-table");
    modalityColumns.forEach((value) => modality.append(new Option(value, value)));
    uniqueValues(matrix, "reuse_readiness_best").forEach((value) => readiness.append(new Option(value, value)));

    function update() {
      const term = search.value.trim().toLowerCase();
      const filtered = matrix.filter((row) => {
        const termMatch = !term || Object.values(row).some((value) => textIncludes(value, term));
        const modalityMatch = modality.value === "All" || row[modality.value] === "TRUE";
        const readinessMatch = readiness.value === "All" || row.reuse_readiness_best === readiness.value;
        return termMatch && modalityMatch && readinessMatch;
      });
      count.textContent = `Showing ${filtered.length} of ${matrix.length} study families`;
      renderTable(table, filtered, ["study_family", "dataset_count", "counted_cohort_rows", ...modalityColumns, "dataset_ids"], labels, filtered.length);
    }

    [search, modality, readiness].forEach((control) => control.addEventListener("input", update));
    update();
  }
}

function renderClinicalTrialOmics(data) {
  const root = document.querySelector("#clinical-trial-omics");
  if (!root) return;

  const labels = {
    dataset_id: "ID",
    dataset_name: "Dataset",
    trial_or_study_name: "Trial / Study",
    study_family: "Study Family",
    intervention_or_treatment_class: "Treatment Class",
    omics_layer: "Omics Layer",
    disease: "Disease",
    specimen_type: "Specimen Type",
    anatomical_site: "Anatomical Site",
    study_design: "Design",
    longitudinal: "Longitudinal",
    treatment_metadata: "Treatment Metadata",
    usable_for_treatment_response: "Response Analysis",
    sample_size_subjects: "N Subjects",
    data_access_status: "Data Access",
    reuse_readiness: "Reuse Readiness",
    count_as_independent_cohort: "Cohort Count Status",
    manual_review_needed: "Manual Review",
    dataset_url: "Source",
    publication_url: "Publication",
    notes: "Notes"
  };

  root.innerHTML = `
    <div class="filter-panel coverage-filters">
      <label>Search <input id="trial-search" type="search" placeholder="UNITI, anti-TNF, vedolizumab, response"></label>
      <label>Treatment <select id="trial-treatment"><option>All</option></select></label>
      <label>Omics <select id="trial-omics"><option>All</option></select></label>
      <label>Readiness <select id="trial-readiness"><option>All</option></select></label>
    </div>
    <div class="metrics-grid compact-metrics" id="trial-metrics"></div>
    <p id="trial-count" class="table-note"></p>
    <div id="trial-table"></div>
  `;

  const search = root.querySelector("#trial-search");
  const treatment = root.querySelector("#trial-treatment");
  const omics = root.querySelector("#trial-omics");
  const readiness = root.querySelector("#trial-readiness");
  const metrics = root.querySelector("#trial-metrics");
  const count = root.querySelector("#trial-count");
  const table = root.querySelector("#trial-table");
  uniqueValues(data, "intervention_or_treatment_class").forEach((value) => treatment.append(new Option(value, value)));
  uniqueValues(data, "omics_layer").forEach((value) => omics.append(new Option(value, value)));
  uniqueValues(data, "reuse_readiness").forEach((value) => readiness.append(new Option(value, value)));

  function update() {
    const term = search.value.trim().toLowerCase();
    const filtered = data.filter((row) => {
      const termMatch = !term || Object.values(row).some((value) => textIncludes(value, term));
      const treatmentMatch = treatment.value === "All" || textIncludes(row.intervention_or_treatment_class, treatment.value);
      const omicsMatch = omics.value === "All" || textIncludes(row.omics_layer, omics.value);
      const readinessMatch = readiness.value === "All" || row.reuse_readiness === readiness.value;
      return termMatch && treatmentMatch && omicsMatch && readinessMatch;
    });
    metrics.innerHTML = `
      <div class="metric-card"><div class="metric-value">${data.length}</div><div class="metric-label">Trial/Treatment Rows</div></div>
      <div class="metric-card"><div class="metric-value">${new Set(data.map((row) => row.study_family)).size}</div><div class="metric-label">Study Families</div></div>
      <div class="metric-card"><div class="metric-value">${data.filter((row) => row.usable_for_treatment_response === "TRUE").length}</div><div class="metric-label">Response Candidates</div></div>
      <div class="metric-card"><div class="metric-value">${data.filter((row) => row.manual_review_needed === "TRUE").length}</div><div class="metric-label">Manual Review</div></div>
    `;
    count.textContent = `Showing ${filtered.length} of ${data.length} trial/treatment rows`;
    renderTable(table, filtered, ["dataset_id", "trial_or_study_name", "dataset_name", "intervention_or_treatment_class", "omics_layer", "disease", "specimen_type", "longitudinal", "usable_for_treatment_response", "reuse_readiness", "dataset_url"], labels, filtered.length);
  }

  [search, treatment, omics, readiness].forEach((control) => control.addEventListener("input", update));
  update();
}

function renderAnalysisCohorts(meta, exports) {
  const metaRoot = document.querySelector("#meta-analysis-eligibility");
  const exportRoot = document.querySelector("#exportable-analysis-cohorts");

  if (metaRoot) {
    const labels = {
      dataset_id: "ID",
      dataset_name: "Dataset",
      study_family: "Study Family",
      omics_layer: "Omics Layer",
      disease: "Disease",
      specimen_type: "Specimen Type",
      anatomical_site: "Anatomical Site",
      reuse_readiness: "Reuse Readiness",
      data_access_status: "Data Access",
      count_as_independent_cohort: "Cohort Count Status",
      cd_vs_control_candidate: "CD vs Control",
      uc_vs_control_candidate: "UC vs Control",
      cd_vs_uc_candidate: "CD vs UC",
      mucosal_biopsy_candidate: "Mucosal",
      ileum_candidate: "Ileum",
      colon_candidate: "Colon",
      bulk_transcriptomics_candidate: "Bulk RNA",
      single_cell_candidate: "Single Cell",
      treatment_response_candidate: "Treatment",
      pediatric_candidate: "Pediatric",
      blocking_caveats: "Caveats",
      dataset_url: "Source"
    };
    metaRoot.innerHTML = `
      <div class="filter-panel coverage-filters">
        <label>Search <input id="meta-search" type="search" placeholder="Crohn, colon, bulk, pediatric, PROTECT"></label>
        <label>Scenario <select id="meta-scenario"><option>All</option></select></label>
        <label>Readiness <select id="meta-readiness"><option>All</option></select></label>
        <label>Count Status <select id="meta-count-status"><option>All</option></select></label>
      </div>
      <div class="metrics-grid compact-metrics" id="meta-metrics"></div>
      <p id="meta-count" class="table-note"></p>
      <div id="meta-table"></div>
    `;
    const scenarioColumns = ["cd_vs_control_candidate", "uc_vs_control_candidate", "cd_vs_uc_candidate", "mucosal_biopsy_candidate", "ileum_candidate", "colon_candidate", "bulk_transcriptomics_candidate", "single_cell_candidate", "treatment_response_candidate", "pediatric_candidate"];
    const search = metaRoot.querySelector("#meta-search");
    const scenario = metaRoot.querySelector("#meta-scenario");
    const readiness = metaRoot.querySelector("#meta-readiness");
    const countStatus = metaRoot.querySelector("#meta-count-status");
    const metrics = metaRoot.querySelector("#meta-metrics");
    const count = metaRoot.querySelector("#meta-count");
    const table = metaRoot.querySelector("#meta-table");
    scenarioColumns.forEach((column) => scenario.append(new Option(labels[column], column)));
    uniqueValues(meta, "reuse_readiness").forEach((value) => readiness.append(new Option(value, value)));
    uniqueValues(meta, "count_as_independent_cohort").forEach((value) => countStatus.append(new Option(value, value)));

    function update() {
      const term = search.value.trim().toLowerCase();
      const filtered = meta.filter((row) => {
        const termMatch = !term || Object.values(row).some((value) => textIncludes(value, term));
        const scenarioMatch = scenario.value === "All" || row[scenario.value] === "TRUE";
        const readinessMatch = readiness.value === "All" || row.reuse_readiness === readiness.value;
        const countMatch = countStatus.value === "All" || row.count_as_independent_cohort === countStatus.value;
        return termMatch && scenarioMatch && readinessMatch && countMatch;
      });
      metrics.innerHTML = `
        <div class="metric-card"><div class="metric-value">${meta.length}</div><div class="metric-label">Screened Rows</div></div>
        <div class="metric-card"><div class="metric-value">${meta.filter((row) => scenarioColumns.some((column) => row[column] === "TRUE")).length}</div><div class="metric-label">Any Scenario</div></div>
        <div class="metric-card"><div class="metric-value">${meta.filter((row) => row.reuse_readiness === "Analysis-ready candidate").length}</div><div class="metric-label">Analysis-Ready Candidates</div></div>
        <div class="metric-card"><div class="metric-value">${meta.filter((row) => row.count_as_independent_cohort === "Unclear").length}</div><div class="metric-label">Countability Unclear</div></div>
      `;
      count.textContent = `Showing ${filtered.length} of ${meta.length} screened rows`;
      renderTable(table, filtered, ["dataset_id", "dataset_name", "study_family", "omics_layer", "disease", "specimen_type", "reuse_readiness", ...scenarioColumns, "blocking_caveats", "dataset_url"], labels, filtered.length);
    }
    [search, scenario, readiness, countStatus].forEach((control) => control.addEventListener("input", update));
    update();
  }

  if (exportRoot) {
    const labels = {
      dataset_id: "ID",
      dataset_name: "Dataset",
      study_family: "Study Family",
      analysis_scenarios: "Analysis Scenarios",
      omics_layer: "Omics Layer",
      disease: "Disease",
      specimen_type: "Specimen Type",
      anatomical_site: "Anatomical Site",
      sample_size_subjects: "N Subjects",
      sample_size_samples: "N Samples",
      data_access_status: "Data Access",
      reuse_readiness: "Reuse Readiness",
      accession: "Accession",
      repository: "Repository",
      dataset_url: "Source",
      publication_url: "Publication",
      caveats: "Caveats"
    };
    exportRoot.innerHTML = `
      <div class="filter-panel coverage-filters">
        <label>Search <input id="export-search" type="search" placeholder="CD vs control, ileum, treatment, single cell"></label>
        <label>Scenario <select id="export-scenario"><option>All</option></select></label>
        <label>Omics <select id="export-omics"><option>All</option></select></label>
        <label>Readiness <select id="export-readiness"><option>All</option></select></label>
      </div>
      <p id="export-count" class="table-note"></p>
      <div id="export-table"></div>
    `;
    const search = exportRoot.querySelector("#export-search");
    const scenario = exportRoot.querySelector("#export-scenario");
    const omics = exportRoot.querySelector("#export-omics");
    const readiness = exportRoot.querySelector("#export-readiness");
    const count = exportRoot.querySelector("#export-count");
    const table = exportRoot.querySelector("#export-table");
    uniqueValues(exports, "analysis_scenarios").forEach((value) => scenario.append(new Option(value, value)));
    uniqueValues(exports, "omics_layer").forEach((value) => omics.append(new Option(value, value)));
    uniqueValues(exports, "reuse_readiness").forEach((value) => readiness.append(new Option(value, value)));

    function update() {
      const term = search.value.trim().toLowerCase();
      const filtered = exports.filter((row) => {
        const termMatch = !term || Object.values(row).some((value) => textIncludes(value, term));
        const scenarioMatch = scenario.value === "All" || textIncludes(row.analysis_scenarios, scenario.value);
        const omicsMatch = omics.value === "All" || textIncludes(row.omics_layer, omics.value);
        const readinessMatch = readiness.value === "All" || row.reuse_readiness === readiness.value;
        return termMatch && scenarioMatch && omicsMatch && readinessMatch;
      });
      count.textContent = `Showing ${filtered.length} of ${exports.length} exportable rows`;
      renderTable(table, filtered, ["dataset_id", "dataset_name", "study_family", "analysis_scenarios", "omics_layer", "disease", "specimen_type", "sample_size_subjects", "data_access_status", "reuse_readiness", "dataset_url"], labels, filtered.length);
    }
    [search, scenario, omics, readiness].forEach((control) => control.addEventListener("input", update));
    update();
  }
}

function renderTerminologyVocabulary(vocab) {
  const root = document.querySelector("#terminology-vocabulary");
  if (!root) return;
  const labels = {
    field: "Field",
    canonical_term: "Canonical Term",
    definition: "Definition",
    examples_or_mapping_notes: "Mapping Notes"
  };
  root.innerHTML = `
    <div class="filter-panel coverage-filters">
      <label>Search <input id="vocab-search" type="search" placeholder="rectal biopsy, stool, Crohn disease"></label>
      <label>Field <select id="vocab-field"><option>All</option></select></label>
    </div>
    <p id="vocab-count" class="table-note"></p>
    <div id="vocab-table"></div>
  `;
  const search = root.querySelector("#vocab-search");
  const field = root.querySelector("#vocab-field");
  const count = root.querySelector("#vocab-count");
  const table = root.querySelector("#vocab-table");
  uniqueValues(vocab, "field").forEach((value) => field.append(new Option(value, value)));
  function update() {
    const term = search.value.trim().toLowerCase();
    const filtered = vocab.filter((row) => {
      const termMatch = !term || Object.values(row).some((value) => textIncludes(value, term));
      const fieldMatch = field.value === "All" || row.field === field.value;
      return termMatch && fieldMatch;
    });
    count.textContent = `Showing ${filtered.length} of ${vocab.length} controlled terms`;
    renderTable(table, filtered, ["field", "canonical_term", "definition", "examples_or_mapping_notes"], labels, filtered.length);
  }
  [search, field].forEach((control) => control.addEventListener("input", update));
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
    sample_type: "Specimen Type",
    tissue_site: "Anatomical Site",
    platform: "Platform",
    data_access_status: "Data Access",
    curation_status: "Curation Status",
    longitudinal: "Longitudinal",
    treatment_metadata: "Treatment Metadata",
    verification_status: "Verification Status",
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
  if (["disease", "sample_type", "platform", "data_access_status"].some((column) => row[column] === "Unclear")) return "Key registry annotations unclear";
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

function renderResourceCoverage(coverage) {
  const root = document.querySelector("#resource-coverage");
  if (!root) return;

  const labels = {
    resource_name: "Resource",
    component_accession: "Component Accession",
    component_title: "Component Dataset",
    component_role: "Role",
    present_in_primary_dataset_table: "In Dataset Explorer",
    dataset_id: "Dataset ID",
    should_add_as_primary_dataset: "Primary Add Candidate",
    reason: "Reason",
    manual_review_needed: "Manual Review",
    evidence_url: "Evidence"
  };

  root.innerHTML = `
    <div class="filter-panel coverage-filters">
      <label>Search <input id="coverage-search" type="search" placeholder="GSE116222, pediatric, atlas, Crohn"></label>
      <label>Resource <select id="coverage-resource"><option>All</option></select></label>
      <label>Present <select id="coverage-present"><option>All</option></select></label>
      <label>Add Candidate <select id="coverage-add"><option>All</option></select></label>
      <label>Manual Review <select id="coverage-review"><option>All</option></select></label>
    </div>
    <div class="metrics-grid compact-metrics" id="coverage-metrics"></div>
    <p id="coverage-count" class="table-note"></p>
    <div id="coverage-table"></div>
  `;

  const search = root.querySelector("#coverage-search");
  const resource = root.querySelector("#coverage-resource");
  const present = root.querySelector("#coverage-present");
  const add = root.querySelector("#coverage-add");
  const review = root.querySelector("#coverage-review");
  const metrics = root.querySelector("#coverage-metrics");
  const count = root.querySelector("#coverage-count");
  const table = root.querySelector("#coverage-table");

  uniqueValues(coverage, "resource_name").forEach((value) => resource.append(new Option(value, value)));
  uniqueValues(coverage, "present_in_primary_dataset_table").forEach((value) => present.append(new Option(value, value)));
  uniqueValues(coverage, "should_add_as_primary_dataset").forEach((value) => add.append(new Option(value, value)));
  uniqueValues(coverage, "manual_review_needed").forEach((value) => review.append(new Option(value, value)));

  function update() {
    const term = search.value.trim().toLowerCase();
    const filtered = coverage.filter((row) => {
      const termMatch = !term || Object.values(row).some((value) => textIncludes(value, term));
      const resourceMatch = resource.value === "All" || row.resource_name === resource.value;
      const presentMatch = present.value === "All" || row.present_in_primary_dataset_table === present.value;
      const addMatch = add.value === "All" || row.should_add_as_primary_dataset === add.value;
      const reviewMatch = review.value === "All" || row.manual_review_needed === review.value;
      return termMatch && resourceMatch && presentMatch && addMatch && reviewMatch;
    });

    const uniqueComponents = new Set(coverage.map((row) => row.component_accession)).size;
    const missing = new Set(
      coverage
        .filter((row) => row.present_in_primary_dataset_table !== "TRUE")
        .map((row) => row.component_accession)
    ).size;
    const addCandidates = new Set(
      coverage
        .filter((row) => row.should_add_as_primary_dataset === "Yes")
        .map((row) => row.component_accession)
    ).size;
    const manualReview = new Set(
      coverage
        .filter((row) => row.manual_review_needed === "TRUE")
        .map((row) => row.component_accession)
    ).size;

    metrics.innerHTML = `
      <div class="metric-card"><div class="metric-value">${uniqueComponents}</div><div class="metric-label">Unique Components</div></div>
      <div class="metric-card"><div class="metric-value">${missing}</div><div class="metric-label">Missing Links</div></div>
      <div class="metric-card"><div class="metric-value">${addCandidates}</div><div class="metric-label">Primary Add Candidates</div></div>
      <div class="metric-card"><div class="metric-value">${manualReview}</div><div class="metric-label">Manual Review</div></div>
    `;

    count.textContent = `Showing ${filtered.length} of ${coverage.length} resource-component links`;
    renderTable(
      table,
      filtered,
      [
        "resource_name",
        "component_accession",
        "component_title",
        "component_role",
        "present_in_primary_dataset_table",
        "dataset_id",
        "should_add_as_primary_dataset",
        "manual_review_needed",
        "evidence_url"
      ],
      labels,
      filtered.length
    );
  }

  [search, resource, present, add, review].forEach((control) => control.addEventListener("input", update));
  update();
}

function renderOrchestratorQueue(queue) {
  const root = document.querySelector("#orchestrator-queue");
  if (!root) return;

  const labels = {
    task_id: "ID",
    task_area: "Area",
    priority: "Priority",
    status: "Status",
    owner: "Owner",
    task: "Task",
    rationale: "Rationale",
    success_criteria: "Success Criteria",
    source_file: "Source",
    target_output: "Target Output"
  };

  root.innerHTML = `
    <div class="filter-panel coverage-filters">
      <label>Search <input id="orchestrator-search" type="search" placeholder="IBDTransDB, verification, single-cell"></label>
      <label>Priority <select id="orchestrator-priority"><option>All</option></select></label>
      <label>Status <select id="orchestrator-status"><option>All</option></select></label>
      <label>Area <select id="orchestrator-area"><option>All</option></select></label>
    </div>
    <div class="metrics-grid compact-metrics" id="orchestrator-metrics"></div>
    <p id="orchestrator-count" class="table-note"></p>
    <div id="orchestrator-table"></div>
  `;

  const search = root.querySelector("#orchestrator-search");
  const priority = root.querySelector("#orchestrator-priority");
  const status = root.querySelector("#orchestrator-status");
  const area = root.querySelector("#orchestrator-area");
  const metrics = root.querySelector("#orchestrator-metrics");
  const count = root.querySelector("#orchestrator-count");
  const table = root.querySelector("#orchestrator-table");

  uniqueValues(queue, "priority").forEach((value) => priority.append(new Option(value, value)));
  uniqueValues(queue, "status").forEach((value) => status.append(new Option(value, value)));
  uniqueValues(queue, "task_area").forEach((value) => area.append(new Option(value, value)));

  function update() {
    const term = search.value.trim().toLowerCase();
    const filtered = queue.filter((row) => {
      const termMatch = !term || Object.values(row).some((value) => textIncludes(value, term));
      const priorityMatch = priority.value === "All" || row.priority === priority.value;
      const statusMatch = status.value === "All" || row.status === status.value;
      const areaMatch = area.value === "All" || row.task_area === area.value;
      return termMatch && priorityMatch && statusMatch && areaMatch;
    });

    metrics.innerHTML = `
      <div class="metric-card"><div class="metric-value">${queue.length}</div><div class="metric-label">Open Tasks</div></div>
      <div class="metric-card"><div class="metric-value">${queue.filter((row) => row.priority === "High").length}</div><div class="metric-label">High Priority</div></div>
      <div class="metric-card"><div class="metric-value">${queue.filter((row) => row.status === "in_progress").length}</div><div class="metric-label">In Progress</div></div>
      <div class="metric-card"><div class="metric-value">${queue.filter((row) => row.status === "assigned").length}</div><div class="metric-label">Assigned</div></div>
    `;

    count.textContent = `Showing ${filtered.length} of ${queue.length} orchestrator tasks`;
    renderTable(
      table,
      filtered,
      ["task_id", "task_area", "priority", "status", "owner", "task", "success_criteria", "target_output"],
      labels,
      filtered.length
    );
  }

  [search, priority, status, area].forEach((control) => control.addEventListener("input", update));
  update();
}

async function initRegistryTables() {
  const response = await fetch("data/ibd_omics_datasets.csv");
  const data = parseCsv(await response.text());
  renderDatasetExplorer(data);
  renderSimpleTables(data);
  renderVerificationQueue(data);

  if (document.querySelector("#study-family-explorer") || document.querySelector("#study-modality-matrix")) {
    const familyResponse = await fetch("data/study_family_summary.csv");
    const matrixResponse = await fetch("data/study_family_modality_matrix.csv");
    renderStudyFamilies(parseCsv(await familyResponse.text()), parseCsv(await matrixResponse.text()));
  }

  if (document.querySelector("#clinical-trial-omics")) {
    const trialResponse = await fetch("data/clinical_trial_omics_slice.csv");
    renderClinicalTrialOmics(parseCsv(await trialResponse.text()));
  }

  if (document.querySelector("#meta-analysis-eligibility") || document.querySelector("#exportable-analysis-cohorts")) {
    const metaResponse = await fetch("data/meta_analysis_eligibility.csv");
    const exportResponse = await fetch("data/exportable_analysis_cohorts.csv");
    renderAnalysisCohorts(parseCsv(await metaResponse.text()), parseCsv(await exportResponse.text()));
  }

  if (document.querySelector("#terminology-vocabulary")) {
    const vocabResponse = await fetch("data/terminology_controlled_vocabulary.csv");
    renderTerminologyVocabulary(parseCsv(await vocabResponse.text()));
  }

  const resourcesRoot = document.querySelector("#integrated-resources");
  if (resourcesRoot) {
    const resourcesResponse = await fetch("data/integrated_resources.csv");
    const resources = parseCsv(await resourcesResponse.text());
    renderIntegratedResources(resources);
  }

  const coverageRoot = document.querySelector("#resource-coverage");
  if (coverageRoot) {
    const coverageResponse = await fetch("data/resource_coverage.csv");
    const coverage = parseCsv(await coverageResponse.text());
    renderResourceCoverage(coverage);
  }

  const orchestratorRoot = document.querySelector("#orchestrator-queue");
  if (orchestratorRoot) {
    const queueResponse = await fetch("data/orchestrator_queue.csv");
    const queue = parseCsv(await queueResponse.text());
    renderOrchestratorQueue(queue);
  }
}

document.addEventListener("DOMContentLoaded", initRegistryTables);
