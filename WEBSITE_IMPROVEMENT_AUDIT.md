# IBD Omics Explorer Website Improvement Audit

Date: 2026-05-10

## Proposal Implemented

The site needed to move from a generated prototype to a reliable dataset-discovery tool. The implemented proposal was:

1. Fix visible rendering defects before adding new content.
2. Replace fragile OJS tables with plain static-site JavaScript that works on GitHub Pages.
3. Make the scientific status more honest by foregrounding verification limits.
4. Improve source-link quality for entries checked during the audit.
5. Keep the public repo free of old generator/vendor strings.
6. Verify every page locally after each material change.

## Ten Audit Cycles

| Cycle | Check | Finding | Implemented |
|---|---|---|---|
| 1 | Home page UI | Metric placeholders rendered literally | Replaced OJS-in-Markdown counts with audited static counts |
| 2 | Omics Layers page | Layer-count placeholders rendered literally | Replaced all layer counts with current CSV-derived counts |
| 3 | Scientific tone | Site implied more certainty than the seed data supports | Added current registry-state and verification-priority sections |
| 4 | Datasets page functionality | Search/filter controls were not visible | Added a plain-JavaScript dataset explorer |
| 5 | Omics/use-case tables | OJS tables did not render visible tables | Added generated registry tables for Omics Layers and Use Cases |
| 6 | Browser functional check | New tables rendered locally | Verified Datasets, Omics Layers, and Use Cases tables in browser |
| 7 | Dataset source links | MassIVE direct URL format was broken; dbGaP accession was unversioned | Updated MSV000086509 and phs002336 links/accession |
| 8 | Full page audit | Seven pages loaded without placeholders or visible errors | Kept changes and proceeded to cleanup |
| 9 | Build cleanup | Old OJS code still shipped in HTML | Removed OJS chunks from source pages |
| 10 | Final local browser audit | All seven pages loaded; Datasets search present; 9 layer tables and 13 use-case tables rendered | Ready for commit/push |

## Remaining Scientific Work

Most entries are still seed entries. The next real scientific improvement is a dataset-by-dataset verification pass against primary repository records and linked publications. Do not promote entries to `Verified` until disease groups, sample counts, platforms, access status, and publication metadata have been checked directly.
