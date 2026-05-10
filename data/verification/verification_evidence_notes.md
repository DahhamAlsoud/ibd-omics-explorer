# Verification Evidence Notes

Date: 2026-05-10

This folder records the first verification batch for the IBD Omics Explorer. The purpose is to keep source evidence and metadata decisions reviewable rather than silently changing the main registry.

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
- DS023 remains `source_link_checked` because the archive source record and related publication linkage are not fully harmonized.
- DS002 keeps `sample_metadata_checked = FALSE` because age/population composition was not directly confirmed in the checked sources.
- DS035 keeps publication fields as `Unclear` because no DS035-specific DOI or PMID was found in the checked public records.
