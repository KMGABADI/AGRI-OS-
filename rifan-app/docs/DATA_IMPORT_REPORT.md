# Supplied register import report

The upload workflow was run against the separate **private RIFAN workspace**, not the original Firebase data or shared demo.

## Final CSV outcome

| Outcome                                      |        Rows |
| -------------------------------------------- | ----------: |
| Original source rows preserved               | **186,353** |
| Valid unique farmers imported                | **172,743** |
| Duplicate identities/member records retained |   **1,229** |
| Invalid source rows retained for correction  |  **12,381** |

The three outcomes sum to all 186,353 source rows. Importing/revalidating this source is resumable; already committed source rows are not inserted again. The final register has 31 source state labels canonicalized to the validated geography where possible. Membership/identity verification is pending review rather than inferred from source claims.

### Remaining invalid reasons

Each row is counted under its first failing rule; further rules run after a correction.

| Reason                                                |   Rows |
| ----------------------------------------------------- | -----: |
| Phone format invalid                                  | 11,338 |
| First name contains unsupported/invalid content       |    626 |
| Birth date cannot be safely parsed as a complete date |    191 |
| LGA does not belong to selected state                 |    111 |
| Last name contains unsupported/invalid content        |     90 |
| First name too short                                  |     14 |
| First name too short and phone invalid                |      5 |
| Last name too short                                   |      3 |
| Primary phone missing                                 |      3 |

### Transformations

- Windows-1252 CSV decoding; not a lossy UTF-8 replacement.
- Names/descriptive fields capitalized; original values retained in the source archive.
- `phone` mapped to `primaryPhone`; known labels mapped to the shared field schema.
- Recognized phone punctuation/omitted mobile-leading-zero normalization; rounded scientific-notation or date-corrupted phones are rejected.
- Additional crops (cotton and groundnut) retained; this source is not exclusively rice.
- `Rainfed` canonicalized to `Rain-fed`; `divorce` to `Divorced`.
- Reviewed geography aliases applied without moving a farmer into a guessed state/LGA.
- Year-only registration remains `registrationYear=2020`, not an invented registration day. Monthly registration charts exclude undated/year-only rows.
- Two-digit birth years stay in `sourceDob` for century confirmation; a date is not invented.
- Source `kycComplete=TRUE` stays in `sourceKycComplete`; actual RIFAN verification remains false until reviewed.
- No missing farm coordinates or farm sizes were fabricated.

## Supplied Excel workbook

`aminu RIFAN VALIDATED BVN WITH all parameters from NIBSS-final.xlsx` is **18,608,099 bytes**, but not a complete XLSX archive. It has local entries for two drawings and one worksheet, with no ZIP central/end directory. Worksheet cells use shared-string indexes, but the shared-string table is missing. Available fragments cannot reliably reconstruct headers or names.

**Imported from this workbook: 0 rows.** The original file was preserved unchanged. The system rejects it with a clear damaged-workbook error. Re-save the original workbook as a complete XLSX or export its sheets to CSV, then upload again. This is a source-file blocker, not evidence that Excel import is unsupported: a complete multi-sheet XLSX was generated, uploaded and parsed in the integration tests, including a leading-zero text BVN.

## Privacy and persistence

Private storage is `.data/rifan.sqlite` and `.data/source/`, with restrictive filesystem permissions and Git ignores. Every raw CSV row is retained in `source_records`, including duplicates and invalid records. Public diagnostics include row numbers/counts/reasons, not BVN, NIN, phone values or personal names.

Authorized reviewers can use Data hub's review queue. Corrected rows are revalidated and linked to the original unchanged source. A duplicate links to the matching member for deliberate review.

No temporary import/verification accounts remain after the import tools exit. The workspace owner must initialize a private account; there is no built-in production administrator password.
