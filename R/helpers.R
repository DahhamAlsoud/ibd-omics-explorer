# Helper functions for IBD Omics Explorer
# Source: R/helpers.R
# Usage: source("R/helpers.R") in any .qmd file that needs these functions

library(readr)
library(dplyr)
library(stringr)

# Load the master dataset CSV and replace blank/NA with "Unclear"
load_datasets <- function(path = "data/ibd_omics_datasets.csv") {
  df <- read_csv(path, show_col_types = FALSE)
  df[is.na(df) | df == ""] <- "Unclear"
  df
}

# Count datasets per omics layer (handles semicolon-separated multi-layer entries)
count_by_layer <- function(df) {
  df |>
    mutate(layer = str_split(omics_layer, ";")) |>
    tidyr::unnest(layer) |>
    mutate(layer = str_trim(layer)) |>
    filter(layer != "Unclear", layer != "") |>
    count(layer, sort = TRUE)
}

# Count datasets per repository
count_by_repo <- function(df) {
  df |>
    mutate(repo = str_split(repository, ";")) |>
    tidyr::unnest(repo) |>
    mutate(repo = str_trim(repo)) |>
    filter(repo != "Unclear", repo != "") |>
    count(repo, sort = TRUE)
}

# Filter by omics layer keyword (case-insensitive substring match)
filter_by_layer <- function(df, keyword) {
  df |> filter(str_detect(str_to_lower(omics_layer), str_to_lower(keyword)))
}

# Filter datasets whose potential_use_cases field contains a keyword
filter_by_use_case <- function(df, keyword) {
  df |>
    filter(
      str_detect(str_to_lower(potential_use_cases), str_to_lower(keyword)) |
      str_detect(str_to_lower(omics_layer), str_to_lower(keyword))
    )
}

# Format a URL column as a clickable HTML link for DT tables
make_link <- function(url, label = NULL) {
  ifelse(
    is.na(url) | url == "Unclear" | url == "",
    "—",
    paste0('<a href="', url, '" target="_blank">', ifelse(is.null(label), url, label), '</a>')
  )
}

# Summary counts for homepage metrics
summary_counts <- function(df) {
  layers <- df$omics_layer |>
    str_split(";") |>
    unlist() |>
    str_trim() |>
    unique() |>
    setdiff(c("Unclear", ""))
  repos <- df$repository |>
    str_split(";") |>
    unlist() |>
    str_trim() |>
    unique() |>
    setdiff(c("Unclear", ""))
  list(
    n_datasets = nrow(df),
    n_layers   = length(layers),
    n_repos    = length(repos)
  )
}
