# Verification Evidence Notes

Date: 2026-05-10

This folder records verification batches for the IBD Omics Explorer. The purpose is to keep source evidence and metadata decisions reviewable rather than silently changing the main registry.

## Batch 001

Rows reviewed:

- DS001: IBDMDB / iHMP IBD Multi-omics
- DS002: IBDTransDB
- DS020: Martin et al. 2019 Cell / GIMATS anti-TNF resistance
- DS023: PXD033158 / MSV000089237
- DS035: dbGaP phs002336.v1.p1

Outputs:

- `verification_batch_001.csv`: verified values now present in the registry for the reviewed rows
- `verification_changes_log.csv`: field-level summary of old values, verified values, evidence, and decisions

## Conservative Decisions

- No row was promoted to `analysis_ready_candidate`.
- DS023 remains `source_checked` because the archive source record and related publication linkage are not fully harmonized.
- DS002 keeps `sample_metadata_checked = FALSE` because age/population composition was not directly confirmed in the checked sources.
- DS035 keeps publication fields as `Unclear` because no DS035-specific DOI or PMID was found in the checked public records.

## Batch 002

Rows reviewed:

- DS003-DS019: GEO transcriptomics, single-cell, and spatial transcriptomics entries
- DS021-DS022: HCA and CELLxGENE atlas entries
- DS024-DS032: proteomics, metabolomics, and methylation/epigenomics entries
- DS033-DS034 and DS036-DS037: genetics and integrative genetics resources

Outputs:

- `verification_batch_002.csv`: row-level verification snapshot for newly reviewed entries
- `verification_changes_log.csv`: appended summary log for the batch

Additional conservative decisions:

- DS012 remains `source_checked` because a directly linked publication was not confirmed from the source record.
- DS022 is `manual_review_needed` because the current CELLxGENE row is a portal-level grouping and should be split into specific collection-backed rows before being treated as a verified dataset.
- DS032 was retained but reframed as an IBD-relevant epithelial/mechanistic methylation resource rather than a direct human IBD patient cohort.
- DS033, DS034, DS036, and DS037 are `metadata_checked` resource-level genetics rows; sample-level fields remain `Unclear` or `Not a primary dataset` where public sources do not support a cohort interpretation.

## Discovery Batch 001

Rows added:

- DS038-DS049: missing transcriptomics, single-cell, methylation, and treatment-trial expression resources, including PROTECT and RISK transcriptomics.
- DS050-DS059: missing proteomics, metabolomics, metagenomics, and multi-omics resources.
- DS060-DS069: additional GEO bulk transcriptomics resources identified from systematic IBD transcriptomics searches.

Outputs:

- `discovery_batch_001.csv`: source-checked candidate additions from systematic public-source discovery.

Conservative decisions for discovery rows:

- New discovery rows start as `source_checked`, not `publication_checked`, unless already covered by a prior verification batch.
- Publication titles, PMIDs, DOIs, sample counts, and cohort labels are filled when strong public-source evidence was found, but they remain flagged for deeper row-level verification.
- PROTECT now appears as multiple modality-specific rows: transcriptomics (`GSE109142`, `GSE150961`), methylation (`GSE185061`), plasma metabolomics (`ST002470`), and stool metabolomics (`ST002471`).
- RISK now appears as pediatric rectal transcriptomics (`GSE117993`) and ileal Crohn transcriptomics (`GSE93624`), in addition to the already present pediatric Crohn ileal transcriptome/microbiome row (`GSE57945`).
