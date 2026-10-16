## Why

Today the panel filters by **category checkboxes**, and only 8 of 24 product files are reachable. That doesn't match how the counter staff look for a part. They start from the **measurement** they took (with a tolerance) and narrow it down: **Tipo → Modelo → Material → Aplicação**. For example: 50 hits at Ø44,45 → 30 gaxetas → 5 Tipo B → 5 Polymax → 2 for haste.

The full supplier catalog (`docs/catalogos/apc-completo/apc-gaxetas-raspadores-ref-02-2019.pdf`, 69 pages, ~1,300 items) already uses this exact taxonomy in its index. Most of it isn't in the panel yet, and the parts that are were copied into ad-hoc CSVs. Most parts are also inch-based, but the panel shows mm only.

## What Changes

- **Ingest the whole APC catalog** with a reusable script that writes one generated dataset. Every row carries the facets Tipo, Modelo, Material and Aplicação, plus ficha técnica, nominal unit and source page. The catalog covers:
  - **Gaxetas de haste**: B, AG 1/2/4(BS)/5/7/11/12/13/14/16/17/19/20/21/22
  - **Gaxetas de êmbolo**: AG 3/6/8/10/15/18/24 and STD
  - **Polymax**
  - **Raspadores**: D, 6D/66D, 900D, K, RP-25, DG, E, GA, GAE, GAG, AGK1, GA1, AGK2, plus the Polymax D, RP-25 and RP-28
  - **Linha pneumática**: AG 3/6/7/24/25, KDG, RP-08, RP-25, Z, plus the repair kits
- **Use the REFERÊNCIA code as the source of truth** for inch parts. Dimensions are decoded from it (inch × 25.4), and every mismatch with the printed values goes into `docs/catalogos/divergencias.md`.
- **Map the 24 legacy CSVs into the same facets** (e.g. Conjunto ZO → Tipo *Conjunto*, Modelo *ZO*). When a legacy row has the same Codigo as an APC row, the APC row wins. Overlaps are reported.
- **BREAKING (UX)**: replace the category checkbox picker with a **faceted funnel**:
  - Measurement inputs (ØINT, ØEXT, Altura, Seção) with ± tolerance and an mm/pol toggle.
  - Four facet groups in the order Tipo, Modelo, Material, Aplicação, each option showing its live count.
  - Facets can be used in any order. Options with 0 results are hidden. The funnel counts are shown as a breadcrumb.
- **New dimension: Seção** (radial width = (ØEXT − ØINT) / 2). It is searchable and displayed.
- **Dual-unit display** everywhere, e.g. `15,88 mm · 5/8"`:
  - **mm**: pt-BR comma, 2 decimals, correct rounding.
  - **Inch**: nearest 1/64", reduced, with `≈` prefix when it isn't exact.
- **Referência** gets its own column and is matched by the code search.
- **Ficha técnica** (pressure, temperature, speed) is shown per model/material.
- **Out of scope**:
  - the price list `Gaxetas 2026` (kept out of git)
  - margin
  - tax/commercial
  - physical positions (A1, B2…)
  - exclusive Êmbolo-vs-Tampa logic
  - catalog editing UI
  - a Supabase product table

## Capabilities

### New Capabilities
- `catalog-ingestion`: Extracting the APC catalog into a faceted dataset, decoding the REFERÊNCIA, cross-validating against the code, producing the divergence report and merging with legacy CSVs.
- `faceted-search`: The product facet model, the measurement-first funnel UI with live counts, legacy category mapping, ficha técnica display and reference search.
- `dimension-units`: Formatting dimensions in mm and inch, the derived Seção, and searching dimensions in mm or inch.

### Modified Capabilities
<!-- None at requirement level: centralized-stock still keys by Codigo and its "Apenas em estoque" filter keeps working (applied before facet counts). -->

## Impact

- **New files**:
  - `scripts/ingest_catalogos.py` (Python + pdfplumber, dev-only)
  - `src/data/catalogo_apc.csv` (generated)
  - `src/config/taxonomia.js`, which holds the models, ficha técnica and legacy mapping
  - `src/utils/units.js`
  - `src/components/FacetFilter.jsx`
  - `docs/catalogos/divergencias.md`
- **Modified files**:
  - `src/services/DatabaseService.js`: unified product list, facet counts, measurement filter incl. Seção
  - `src/components/SearchForm.jsx`: measurements + unit toggle; category picker removed
  - `src/App.jsx`: facet state, dual-unit cells, Referência/ficha
  - `src/config/categories.js`: becomes the legacy-file registry feeding `taxonomia.js`
  - `src/utils/tipoStyles.js`
- **Removed**: `src/components/ResultCard.jsx` (dead code).
- **Data**:
  - Drive excerpts in `docs/catalogos/vedacao-*` are superseded by the full catalog and kept only for reference.
  - The price list stays local and is git-ignored.
- **No change** to Supabase schema, auth, or stock.
