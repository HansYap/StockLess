These are derived, browser-local CP3 v2 reference snapshots, not merchant records.

Rebuild from the authorised Cleaned_Dataset CSVs with:

    python3 backend/scripts/import-cp3-reference-data.py [local-data-directory]

The default input directory is docs/cp3-data (local only). The generator verifies
every present source SHA-256 manifest, validates row counts and emits deterministic
TypeScript. cp3-source-manifest.ts records the hash of every imported CSV.

- category_map.csv: 80 categories, 78 food. Supported M12 + keyword agreements
  can feed automatic estimates; manual corrections take priority. Automatic
  categories retain model/evidence provenance and never set categoryConfirmed.
- FoodKeeper v128: 994 product/storage windows; category fallback excludes pantry.
- PriceCatcher: 328 reference-price records, including explicitly unavailable prices.
  Reference items need an explicit choice or unique exact name match, and compatible sales units;
  retail prices only rank missing-cost requests, never become seller purchase costs.
- CO2e: 90 rows including auxiliary categories; the 78 food categories contain
  42 agreeing-group means, 13 bounded median estimates and 23 unavailable factors.
  SEL, AGRIBALYSE v3.2, Poore/Nemecek and Big Climate Database metadata and
  source boundaries are retained in reference-carbon-data.ts. Factors are recomputed
  from the source values rather than accepted from stored labels.
- FAO/INFOODS v2: four measured generic-food density entries, with source hashes.

The original CP3 M12 P0 model snapshot retains its experiment DEV names and
AI-labelled benchmark metadata. Neither that benchmark nor the reference mapping
review is the required independent, human-labelled merchant-name acceptance test.

Automatic workflow policy (Phase 6): reference snapshots and source hashes are
unchanged. FoodKeeper category mappings now also provide automatic, clearly
labelled storage advice; this advice never asserts actual storage or expiry and
never caps orders. Existing explicitly saved storage conditions still use the
original validated limits. PriceCatcher exact-name matches still require valid
unit conversion and never fill purchase cost. Automatic categories and drafts
are derived from current evidence, retain their source, and remain separate from
manual confirmations, final decisions and recorded outcomes. No external AI
service receives merchant data. Model parity tests establish implementation
parity, not independent classification accuracy.
