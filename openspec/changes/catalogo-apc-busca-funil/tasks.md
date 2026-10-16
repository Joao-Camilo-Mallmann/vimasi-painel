## 1. Sources & repo hygiene

- [x] 1.1 Add `docs/catalogos/precos/` to `.gitignore`. Copy `Gaxetas 2026.pdf` there for local reference only.
- [x] 1.2 Update `docs/catalogos/README.md`:
  - The full APC catalog is the primary source.
  - The Drive excerpts are superseded.
  - Keep the conversion-table errata.

## 2. Taxonomy

- [x] 2.1 Transcribe the index pages (PDF 9–13) into `src/config/taxonomia.js`:
  - `TIPOS` (Gaxeta, Raspador, Reparo pneumático, plus the legacy tipos)
  - `MODELOS`, with ficha per material: psi, °C, m/s, Aplicações, Linha
- [x] 2.2 Add `LEGACY_MAP` covering all 24 legacy CSVs. Each entry has Tipo, Modelo, Material, Aplicações (draft classification) and the column mapping for the odd files.
- [x] 2.3 Fold `src/config/categories.js` into taxonomia and add fixed badge styles per Tipo. Update `src/utils/tipoStyles.js` to match.

## 3. Ingestion script

- [x] 3.1 Create `scripts/ingest_catalogos.py` with the page/region manifest for PDF pages 15–68: title anchors, facets, nominal unit, code pattern.
- [x] 3.2 Implement region splitting by title anchors and word-coordinate table extraction:
  - header x-ranges per half
  - rows grouped by `top`
  - MATERIAL column support
  - AG 25 extra columns go to `extras`
- [x] 3.3 Implement REFERÊNCIA decoding: STD8, B11 (incl. `BS`), `D-IIII`, `PM` suffix, fallback to printed values. Use 1/64" snapping and exact ×25.4.
- [x] 3.4 Implement the printed-value parser: comma or dot decimals, and fractions like `1 13/16`.
- [x] 3.5 Extract the pneumatic repair pages (PDF 67–68) as Tipo "Reparo pneumático". Rows without dimensions are kept and are searchable by code/description only.
- [x] 3.6 Write `src/data/catalogo_apc.csv` with the spec columns and a deterministic sort.
- [x] 3.7 Write `docs/catalogos/divergencias.md` with these sections:
  - code vs printed
  - missing Nº AGEL
  - legacy overrides
  - não extraídas
  - per-model row counts
- [x] 3.8 Run the script twice and confirm byte-identical output. Compare per-model counts against the PDF on every multi-model page. Spot-check 3 rows per model against the rendered page.

## 4. Units module

- [x] 4.1 Create `src/utils/units.js` with `formatMm`, `formatInch`, `formatDim`, `parseMm`, `parseInch` and `secao`.
- [x] 4.2 Add a self-check script covering the spec scenarios:
  - 3.175 → "3,18"
  - 15.875 → `5/8"`
  - 22 → `≈ 55/64"`
  - 50.8 → `2"`
  - 44.45 → `1 3/4"`
  - parse `1 3/4`, `1.1/2`, `3/16` and `1,75`
  - reject `1 3/`

## 5. Data service

- [x] 5.1 Change `DatabaseService` to load `catalogo_apc.csv` plus all legacy CSVs through `LEGACY_MAP`, normalize them into `Product[]` (computing `secao`), and de-duplicate by `codigo` so APC wins.
- [x] 5.2 Make `buscar` filter by measurements (ØINT, ØEXT, Altura, Seção) ± tolerance, and by code against Codigo or Referencia.
- [x] 5.3 Add `contarFacetas(base, selecao)`: disjunctive counts per group. Generic Aplicação matches any selection.

## 6. UI

- [x] 6.1 Rework `SearchForm.jsx`:
  - remove the category picker
  - measurements incl. Seção
  - mm/pol toggle with the mm hint and invalid state
  - tolerance and code stay as they are
- [x] 6.2 Create `src/components/FacetFilter.jsx` following DESIGN.md:
  - four chip groups in funnel order with counts
  - hide options with zero results
  - multi-select
  - breadcrumb `50 → 30 → 5 → 5 → 2` with ✕ per step
- [x] 6.3 Wire the facet state in `App.jsx`. The stock filter is applied before counting. Reset facets on a new search.
- [x] 6.4 Update the results table and mobile cards:
  - `formatDim` cells
  - Seção column
  - Referência column (shown when present)
  - Tipo/Modelo badge
  - Material
  - ficha line
- [x] 6.5 Delete `src/components/ResultCard.jsx`.

## 7. Verification & docs

- [x] 7.1 Run `npm run lint` and `npm run build`. In the built app, check that the badge colors render.
- [x] 7.2 Manual run in dev:
  - ØINT 44,45 ± 0,5, then Gaxeta → Tipo B → Polymax → Haste. Counts shrink at each step, and the ficha shows 8000 psi.
  - pol `1 3/4` gives the same result.
  - Code `12500250` finds by Referência.
  - `8016PM` appears once.
- [x] 7.3 Update `AGENTS.md`:
  - structure (`docs/catalogos/`, `scripts/`, `taxonomia.js`, `units.js`)
  - rules: dimensions via `units.js`; facets come from `taxonomia.js`
  - how to re-run ingestion

## Notas de implementação

- 2.1: a ficha técnica e as aplicações APC ficaram no manifesto do script e são gravadas no CSV, não em `taxonomia.js`. Ver design.md §2.
- 3.x: a lista 2026 também acrescenta os itens que faltam no catálogo, com `Fonte=tabela2026`. Preço/IPI são descartados na extração.
- 4.2 e 7.2: as checagens viraram os scripts `scripts/check_units.mjs` e `scripts/check_busca.mjs`. A checagem visual no navegador fica pendente, porque o app exige login no Supabase.
