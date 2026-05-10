suppressPackageStartupMessages({
  library(readr)
  library(dplyr)
  library(stringr)
})

input_path <- "data/ibd_omics_datasets.csv"
output_path <- "data/verification/cohort_counting_qa_report.csv"

datasets <- read_csv(input_path, show_col_types = FALSE, na = c("", "NA"))
ids <- datasets$dataset_id

emit <- function(check_id, check_group, severity, status, affected_ids, expected, observed, recommended_action) {
  tibble(
    check_id = check_id,
    check_group = check_group,
    severity = severity,
    status = status,
    n_rows = length(affected_ids),
    affected_dataset_ids = paste(affected_ids, collapse = "; "),
    expected = expected,
    observed = observed,
    recommended_action = recommended_action
  )
}

required_fields <- c("study_family", "component_of_dataset_id", "count_as_independent_cohort", "overlap_notes")
missing_fields <- setdiff(required_fields, names(datasets))
has_required_fields <- length(missing_fields) == 0

if (!"dataset_id" %in% names(datasets)) {
  stop("Required field dataset_id is missing from the registry CSV.")
}

blank_family <- if (has_required_fields) {
  datasets %>% filter(is.na(study_family) | str_trim(study_family) == "")
} else datasets[0, ]
valid_countability <- c("TRUE", "FALSE", "Unclear")
invalid_countability <- if (has_required_fields) {
  datasets %>% filter(is.na(count_as_independent_cohort) | !count_as_independent_cohort %in% valid_countability)
} else datasets[0, ]
blank_countability <- if (has_required_fields) {
  datasets %>% filter(is.na(count_as_independent_cohort) | str_trim(count_as_independent_cohort) == "")
} else datasets[0, ]
false_missing_notes <- if (has_required_fields) {
  datasets %>% filter(count_as_independent_cohort == "FALSE", is.na(overlap_notes) | str_trim(overlap_notes) == "")
} else datasets[0, ]
unclear_missing_notes <- if (has_required_fields) {
  datasets %>% filter(count_as_independent_cohort == "Unclear", is.na(overlap_notes) | str_trim(overlap_notes) == "")
} else datasets[0, ]
invalid_components <- if (has_required_fields) {
  datasets %>% filter(!is.na(component_of_dataset_id), str_trim(component_of_dataset_id) != "", !component_of_dataset_id %in% ids)
} else datasets[0, ]
free_text_components <- if (has_required_fields) {
  datasets %>% filter(!is.na(component_of_dataset_id), str_trim(component_of_dataset_id) != "", str_detect(component_of_dataset_id, "\\s|/|Unclear|unclear"))
} else datasets[0, ]
self_components <- if (has_required_fields) {
  datasets %>% filter(!is.na(component_of_dataset_id), str_trim(component_of_dataset_id) != "", component_of_dataset_id == dataset_id)
} else datasets[0, ]
component_true <- if (has_required_fields) {
  datasets %>% filter(!is.na(component_of_dataset_id), str_trim(component_of_dataset_id) != "", count_as_independent_cohort == "TRUE")
} else datasets[0, ]
duplicate_ids <- datasets %>%
  count(dataset_id, name = "n") %>%
  filter(!is.na(dataset_id), n > 1) %>%
  arrange(dataset_id)
duplicate_families <- if (has_required_fields) {
  datasets %>%
    count(study_family, name = "n") %>%
    filter(!is.na(study_family), n > 1) %>%
    arrange(desc(n), study_family)
} else datasets[0, ]
false_rows <- if (has_required_fields) {
  datasets %>% filter(count_as_independent_cohort == "FALSE")
} else datasets[0, ]
unclear_rows <- if (has_required_fields) {
  datasets %>% filter(count_as_independent_cohort == "Unclear")
} else datasets[0, ]

report <- bind_rows(
  emit("CF001", "schema", "error", if (length(missing_fields) == 0) "pass" else "fail",
       missing_fields, paste(required_fields, collapse = "; "),
       if (length(missing_fields) == 0) "All required fields present" else paste(missing_fields, collapse = "; "),
       if (length(missing_fields) == 0) "None" else "Add missing required fields to registry CSV"),
  emit("CF002", "schema", "error", if (nrow(blank_family) == 0) "pass" else "fail",
       blank_family$dataset_id, "No blank study_family values",
       paste0(nrow(blank_family), " blank study_family rows"),
       if (nrow(blank_family) == 0) "None" else "Assign conservative study_family labels or manual-review labels"),
  emit("CF003", "countability", "error", if (nrow(invalid_countability) == 0) "pass" else "fail",
       invalid_countability$dataset_id, "Allowed countability values: TRUE; FALSE; Unclear",
       paste0(nrow(invalid_countability), " invalid values"),
       if (nrow(invalid_countability) == 0) "None" else "Correct count_as_independent_cohort values"),
  emit("CF004", "countability", "error", if (nrow(blank_countability) == 0) "pass" else "fail",
       blank_countability$dataset_id, "No blank countability values",
       paste0(nrow(blank_countability), " blank values"),
       if (nrow(blank_countability) == 0) "None" else "Set TRUE, FALSE, or Unclear"),
  emit("CF005", "overlap_notes", "error", if (nrow(false_missing_notes) == 0) "pass" else "fail",
       false_missing_notes$dataset_id, "FALSE rows must have overlap_notes",
       paste0(nrow(false_missing_notes), " FALSE rows missing notes"),
       if (nrow(false_missing_notes) == 0) "None" else "Add overlap_notes explaining non-independent status"),
  emit("CF006", "overlap_notes", "error", if (nrow(unclear_missing_notes) == 0) "pass" else "fail",
       unclear_missing_notes$dataset_id, "Unclear rows must have overlap_notes",
       paste0(nrow(unclear_missing_notes), " Unclear rows missing notes"),
       if (nrow(unclear_missing_notes) == 0) "None" else "Add overlap_notes explaining unresolved status"),
  emit("CF007", "component_links", "error", if (nrow(invalid_components) == 0) "pass" else "fail",
       invalid_components$dataset_id, "Nonblank component_of_dataset_id values must reference existing dataset_id",
       paste0(nrow(invalid_components), " invalid component refs"),
       if (nrow(invalid_components) == 0) "None" else "Clear or correct component_of_dataset_id"),
  emit("CF008", "component_links", "error", if (nrow(free_text_components) == 0) "pass" else "fail",
       free_text_components$dataset_id, "component_of_dataset_id must be blank or a dataset ID",
       paste0(nrow(free_text_components), " free-text component refs"),
       if (nrow(free_text_components) == 0) "None" else "Move free-text explanation into overlap_notes"),
  emit("CF009", "component_links", "warning", if (nrow(component_true) == 0) "pass" else "review",
       component_true$dataset_id, "Rows with component_of_dataset_id should usually not be countable TRUE",
       paste0(nrow(component_true), " component rows countable TRUE"),
       if (nrow(component_true) == 0) "None" else "Review component countability"),
  emit("CF010", "component_links", "error", if (nrow(self_components) == 0) "pass" else "fail",
       self_components$dataset_id, "component_of_dataset_id must not point to the same row",
       paste0(nrow(self_components), " self-referential component refs"),
       if (nrow(self_components) == 0) "None" else "Clear or correct self-referential component links"),
  emit("CF011", "schema", "error", if (nrow(duplicate_ids) == 0) "pass" else "fail",
       duplicate_ids$dataset_id, "dataset_id values must be unique",
       paste0(nrow(duplicate_ids), " duplicate dataset_id values"),
       if (nrow(duplicate_ids) == 0) "None" else "Resolve duplicate dataset_id values"),
  emit("CF012", "summary", "info", "pass",
       duplicate_families$study_family, "Summarize repeated study families",
       paste0(nrow(duplicate_families), " repeated families"),
       "Review repeated families when resolving overlaps"),
  emit("CF013", "summary", "info", "pass",
       false_rows$dataset_id, "List non-independent rows",
       paste0(nrow(false_rows), " FALSE rows"),
       "None"),
  emit("CF014", "summary", "info", "pass",
       unclear_rows$dataset_id, "List unresolved rows",
       paste0(nrow(unclear_rows), " Unclear rows"),
       "Use unclear_countability_resolution_plan.csv"),
  emit("CF015", "summary", "info", "pass",
       character(), "Current registry totals",
       paste0(
         nrow(datasets), " rows; ",
         if (has_required_fields) n_distinct(datasets$study_family) else NA_integer_, " families; ",
         if (has_required_fields) sum(datasets$count_as_independent_cohort == "TRUE", na.rm = TRUE) else NA_integer_, " TRUE; ",
         if (has_required_fields) sum(datasets$count_as_independent_cohort == "FALSE", na.rm = TRUE) else NA_integer_, " FALSE; ",
         if (has_required_fields) sum(datasets$count_as_independent_cohort == "Unclear", na.rm = TRUE) else NA_integer_, " Unclear"
       ),
       "None")
)

write_csv(report, output_path)
