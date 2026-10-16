## Context

- **Data loading.** Product data is static CSV in `src/data/`. It's loaded through `import.meta.glob` in `src/services/DatabaseService.js`, but only for the 8 categories registered in `src/config/categories.js`.
- **Search.** The user ticks categories first, then filters by Codigo or by dimensions, each with an absolute mm tolerance. Values are displayed with `toFixed(2)` + "mm", and nothing converts units.
- **Supabase.** It only stores stock.
- **The full APC catalog** (69 PDF pages, ref. 02/2019) is now in `docs/catalogos/apc-completo/`:
  - Its index (PDF pages 9–13) organizes products as Gaxetas (haste / êmbolo), Polymax, Raspadores, Raspadores Polymax and Linha Pneumática. Each model has its speed, temperature, pressure and mm/pol pages.
  - Data pages 15–68 hold about 1,300 rows.
  - The layouts are two-column tables, often with several models stacked on one page. Raspador pages have a MATERIAL column, and AG 25 has extra columns.
- **The legacy CSVs partly overlap the catalog.** `data_raspador_metalico.csv` ≈ Tipo GA/GAE…, and `data_gaxeta.csv` ≈ AG 13 Polymax.
- **The excerpts from the earlier Drive folder** (`docs/catalogos/vedacao-*`) are a subset of this catalog.

## Goals / Non-Goals

**Goals:**
- Make every APC item findable from a measurement, then narrow it with Tipo → Modelo → Material → Aplicação, showing live counts.
- Keep the legacy products in the same funnel.
- Use dimensions you can trust: decoded from the code, with divergences reported.
- Show and accept both mm and inch.

**Non-Goals:**
- Prices, margin, IPI and other commercial data.
- Physical positions.
- Exclusive Êmbolo-vs-Tampa logic.
- An editing UI or Supabase catalog table.
- Fixing legacy data. We only report on it.

## Decisions

### 1. One generated dataset + legacy files, unified at load time
The script writes a single `src/data/catalogo_apc.csv` with facet columns. The loader reads it plus the legacy `data_*.csv` files and normalizes everything into one `Product[]`:
```
{ codigo, referencia, tipo, modelo, material, aplicacoes[], linha,
  interno, externo, altura, secao, extras{}, fonte, pagina, origem }
```
Then it de-duplicates by `codigo`, and APC wins.
- *Alternative:* one CSV per model (~45 files). Rejected: facets would have to live in config per file, and the glob/registry grows for no benefit.
- *Alternative:* Supabase. Rejected for now, same reasons as before: the schema will be shaped by the margin and positions work.

### 2. Taxonomy config is the single source of facet metadata
`src/config/taxonomia.js` holds:
- **`TIPOS`**: label, badge style and order.
- **`MODELOS`**: key, Tipo, label and ficha per material, transcribed from the index pages.
- **`LEGACY_MAP`**: for each legacy csvFile, its Tipo, Modelo, Material and Aplicações, plus the column→field mapping for odd files (Diametro/Espessura, Largura/Espessura/Comprimento, V).

Today's `categories.js` is folded into it. The pneumatic models get distinct keys (e.g. `AG 3 PN`) because their ficha differs from the hydraulic AG 3. In the UI they're labeled "AG 3 · Pneumática".

### 3. Script: manifest + word-coordinate extraction (Python, pdfplumber)
The manifest lists PDF page → regions. Each region carries its title anchor text (e.g. "AG - 2"), Tipo, Modelo, Material, Aplicações, Linha, nominal unit and code pattern. The extraction goes like this:
1. Find the title anchors on the page to cut it into vertical regions.
2. Within each region, locate the `Nº AGEL` header row(s) to get the column x-ranges for both halves.
3. Group the words below it into rows by `top` (±2 pt).
4. Assign each word to a column by its x-center.

Rows that don't fill the required columns go to the "não extraídas" part of the report. Each page asserts a minimum row count, so a layout change fails loudly. `pdftotext -layout` is not used, because it misaligns the H column.

### 4. Code is the truth; snap to 1/64"
Thousandths are converted with `round(x/1000·64)/64·25.4`. The patterns are STD (8 digits), Tipo B / AG 4 BS (11 digits) and Tipo D (`D-IIII`, Interno only). `PM` and `BS` suffixes are stripped before decoding. Anything else falls back to the printed values, and pol pages print fractions like `1 13/16`.

### 5. Facet counting is client-side and disjunctive
The base set is the measurement + code + stock filter. Each facet group's counts are computed against the base set, filtered by the *other* groups' selections. That way you can switch between options in a group without first clearing it. With about 2,000 products and 4 groups, this is a few thousand predicate checks per change, so it needs no indexing. `useMemo` is keyed on the inputs.
- *Alternative:* a strict wizard. Rejected by the user in favor of free order.

### 6. `src/utils/units.js` (pure, testable)
- **`formatMm`**: rounds with `Math.round((v+Number.EPSILON)*100)/100`, then pt-BR formatting.
- **`formatInch`**: nearest 1/64, gcd-reduced, mixed number, `≈` when the error is over 0.01 mm.
- **`formatDim`**
- **`parseMm`**: accepts a comma.
- **`parseInch`**: accepts `a b/c`, `a.b/c`, `b/c`, and decimals written with `.` or `,`.

Form state always stores mm, and toggling the unit just re-renders the text.

### 7. UI layout
The search panel stays at the top: measurements, the unit toggle, tolerance and code. Below it is a new `FacetFilter` with four chip groups in funnel order. Each chip shows its label + count, and selected chips use accent-red per DESIGN.md. A breadcrumb shows the count after each step, as in the user's sketch. The results table gains these columns:
- Referência
- Tipo/Modelo badge
- Material
- Seção
- the ficha (as a tooltip or second line)

Mobile: the facet groups collapse into horizontal scroll rows.

## Risks / Trade-offs

- **[Multi-model pages are mis-split, so rows get the wrong Modelo]**:
  - Region anchors come from the manifest, not guessed.
  - The report prints per-model row counts so they can be compared against the PDF.
  - Spot-check every multi-model page.
- **[Code-derived values differ from the printed ones]**: this is intended, since the user chose the code as the truth. Every case is in the report.
- **[Legacy data mapped to wrong facets]**: `LEGACY_MAP` is a single, reviewable table. Mappings we're unsure of are listed as Open Questions.
- **[Removing category checkboxes changes a habit]**: The Tipo/Modelo facets cover the same need, and the facets are visible right after the first search.
- **[Price list committed by accident]**: `docs/catalogos/precos/` is in `.gitignore`.

## Migration Plan

This is front-end only, with no DB migration. Deploying is the usual build, and rolling back is reverting the commit.

## Open Questions

- Aplicação for legacy categories. The draft: Haste = RP, RPA, OD, OE, VRING; Êmbolo = ZO, ZW, 753, BP, UHMW, CAPPED, DUAL; everything else is generic. The user will review it in `LEGACY_MAP`.
- Material for legacy categories where it isn't obvious from the name. Default is empty ("—").
