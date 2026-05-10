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

blank_family <- datasets %>% filter(is.na(study_family) | str_trim(study_family) == "")
valid_countability <- c("TRUE", "FALSE", "Unclear")
invalid_countability <- datasets %>%
  filter(is.na(count_as_independent_cohort) | !count_as_independent_cohort %in% valid_countability)
blank_countability <- datasets %>% filter(is.na(count_as_independent_cohort) | str_trim(count_as_independent_cohort) == "")
false_missing_notes <- datasets %>%
  filter(count_as_independent_cohort == "FALSE", is.na(overlap_notes) | str_trim(overlap_notes) == "")
unclear_missing_notes <- datasets %>%
  filter(count_as_independent_cohort == "Unclear", is.na(overlap_notes) | str_trim(overlap_notes) == "")
invalid_components <- datasets %>%
  filter(!is.na(component_of_dataset_id), str_trim(component_of_dataset_id) != "", !component_of_dataset_id %in% ids)
free_text_components <- datasets %>%
  filter(!is.na(component_of_dataset_id), str_trim(component_of_dataset_id) != "", str_detect(component_of_dataset_id, "\\s|/|Unclear|unclear"))
component_true <- datasets %>%
  filter(!is.na(component_of_dataset_id), str_trim(component_of_dataset_id) != "", count_as_independent_cohort == "TRUE")
duplicate_families <- datasets %>%
  count(study_family, name = "n") %>%
  filter(!is.na(study_family), n > 1) %>%
  arrange(desc(n), study_family)
false_rows <- datasets %>% filter(count_as_independent_cohort == "FALSE")
unclear_rows <- datasets %>% filter(count_as_independent_cohort == "Unclear")

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
  emit("CF010", "summary", "info", "pass",
       duplicate_families$study_family, "Summarize repeated study families",
       paste0(nrow(duplicate_families), " repeated families"),
       "Review repeated families when resolving overlaps"),
  emit("CF011", "summary", "info", "pass",
       false_rows$dataset_id, "List non-independent rows",
       paste0(nrow(false_rows), " FALSE rows"),
       "None"),
  emit("CF012", "summary", "info", "pass",
       unclear_rows$dataset_id, "List unresolved rows",
       paste0(nrow(unclear_rows), " Unclear rows"),
       "Use unclear_countability_resolution_plan.csv"),
  emit("CF013", "summary", "info", "pass",
       character(), "Current registry totals",
       paste0(
         nrow(datasets), " rows; ",
         n_distinct(datasets$study_family), " families; ",
         sum(datasets$count_as_independent_cohort == "TRUE", na.rm = TRUE), " TRUE; ",
         sum(datasets$count_as_independent_cohort == "FALSE", na.rm = TRUE), " FALSE; ",
         sum(datasets$count_as_independent_cohort == "Unclear", na.rm = TRUE), " Unclear"
       ),
       "None")
)

write_csv(report, output_path)
