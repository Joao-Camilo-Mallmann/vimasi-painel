## ADDED Requirements

### Requirement: Reusable catalog ingestion script
The system SHALL provide a developer script `scripts/ingest_catalogos.py` that reads `docs/catalogos/apc-completo/apc-gaxetas-raspadores-ref-02-2019.pdf` and writes `src/data/catalogo_apc.csv`. The CSV SHALL use `;` as delimiter, `.` as decimal separator, and a header row with the columns `Codigo;Referencia;Tipo;Modelo;Material;Aplicacao;Linha;Interno;Externo;Altura;UnidadeNominal;PressaoPsi;TempMin;TempMax;VelocidadeMs;Extras;Descricao;Tabela2026;Fonte;Pagina`. The ficha técnica (pressure, temperature, speed) SHALL come from the script's manifest, which is transcribed from the catalog index. Pneumatic-line seals SHALL have Tipo `Gaxeta` and Linha `Pneumática`. Running the script twice on the same input SHALL produce byte-identical output.

#### Scenario: Full regeneration
- **WHEN** a developer runs `python -I scripts/ingest_catalogos.py`
- **THEN** `src/data/catalogo_apc.csv` and `docs/catalogos/divergencias.md` are rewritten
- **AND** the script prints the row count per Modelo/Material and the total

#### Scenario: Unchanged input
- **WHEN** the script runs twice without input changes
- **THEN** both outputs are byte-identical between runs

### Requirement: Page manifest drives facets
The script SHALL use a manifest derived from the catalog index (PDF pages 9–13) that maps each catalog page region to its facets:
- Tipo: Gaxeta, Raspador or Reparo pneumático
- Modelo
- Material: PU or Polymax; for pages with a MATERIAL column, the per-row value (NBR, PU…)
- Aplicação: haste, êmbolo, both, or amortecimento (RP-08). The assembly drawing on each page wins over the index grouping.
- Linha: hidráulica or pneumática
- nominal unit: mm or pol

A page that contains several models SHALL be split into regions by the model titles' positions.

#### Scenario: Two models on one page
- **WHEN** the script processes PDF page 23, which holds AG - 1 and AG - 2
- **THEN** each row is tagged with the Modelo of the region it sits in
- **AND** no row is tagged with both

#### Scenario: Per-row material
- **WHEN** the script processes a Tipo GA row `9882 NBR 10,00 15,30 2,00`
- **THEN** the output row has Tipo Raspador, Modelo GA, Material NBR, Interno 10, Externo 15.3 and Altura 2

#### Scenario: Polymax section
- **WHEN** a row comes from a page titled POLYMAX or its Nº AGEL ends in `PM`
- **THEN** its Material is Polymax

### Requirement: Row-aligned extraction
Tables SHALL be extracted by word coordinates: rows are grouped by vertical position, the two table halves are split at the page midline, and columns are assigned by header x-ranges. Every row's values SHALL come from the same printed table row.

#### Scenario: H column stays aligned
- **WHEN** the script extracts STD row `6404 12500437`
- **THEN** its Altura is 3.175 (1/8"), not the H of a neighboring row

### Requirement: Dimensions derived from the REFERÊNCIA code
For inch-coded references, the script SHALL compute dimensions from the code using exact conversion (1" = 25.4 mm) and SHALL store at least 4 decimal places. Thousandths SHALL be snapped to the nearest 1/64" before conversion.

| Pattern | Code layout | Interno | Altura | Externo |
|---|---|---|---|---|
| STD | 8 digits `SSS IIIII` | IIIII | SSS | Interno + 2·SSS |
| Tipo B / AG 4 (BS) | 11 digits `SSS IIIII HHH` | IIIII | HHH | Interno + 2·SSS |
| Tipo D | `D-IIII` (e.g. `D-3875` = 3 7/8") | IIII (thousandths of an inch) | printed value | printed value |

Suffixes `PM` and `BS` SHALL be ignored for decoding. References starting with `6-`, `---`, or not matching any pattern SHALL use the printed values (comma or dot decimal, or inch fractions on pol pages) and SHALL be marked `Fonte=pdf`. Rows decoded from the code SHALL be marked `Fonte=codigo`.

#### Scenario: Decoding a Tipo B reference
- **WHEN** the script processes `12500250250`
- **THEN** the row has Interno 6.35, Externo 12.7 and Altura 6.35

#### Scenario: Decoding a STD reference with truncated thousandths
- **WHEN** the script processes `18700250`
- **THEN** the row has Interno 6.35, Altura 4.7625 and Externo 15.875

#### Scenario: Metric reference
- **WHEN** a row has REFERÊNCIA `6-11800394224` and prints `10,00 16,00 5,70`
- **THEN** the row has Interno 10, Externo 16 and Altura 5.7, with `Fonte=pdf`

### Requirement: Divergence report
The script SHALL write `docs/catalogos/divergencias.md` listing:
- (a) every row where a printed value differs from the code-derived value by more than 0.05 mm
- (b) rows missing a Nº AGEL
- (c) legacy CSV rows overridden by APC rows with the same Codigo
- (d) rows the extractor could not parse, with their page number

Each entry SHALL identify the page, Nº AGEL, REFERÊNCIA, field, printed value and computed value. Source files SHALL NOT be modified.

#### Scenario: Printed value disagrees with code
- **WHEN** `18700812187` prints Externo 1 13/16" but the code gives 1 3/16"
- **THEN** the CSV holds 30.1625
- **AND** the report lists the row with both values

#### Scenario: Unparseable row
- **WHEN** a row on a page cannot be mapped to the expected columns
- **THEN** the row is skipped from the CSV and listed under "não extraídas" with its page and raw text

### Requirement: Code and reference columns
`Codigo` SHALL be the Nº AGEL, and `Referencia` the REFERÊNCIA. A REFERÊNCIA of `---` SHALL be stored as empty. When the Nº AGEL is blank, `Codigo` SHALL fall back to the REFERÊNCIA.

#### Scenario: Missing Nº AGEL
- **WHEN** a Tipo B row has REFERÊNCIA `18700250312` and no Nº AGEL
- **THEN** the row has Codigo `18700250312` and Referencia `18700250312`

### Requirement: Cross-check with the 2026 price list
When `docs/catalogos/precos/agel-lista-precos-2026-01.pdf` is present, the script SHALL extract only the code and description of each item, never the price or IPI. It SHALL then:
- Match items to catalog rows by Nº AGEL or REFERÊNCIA, ignoring hyphens (`12500250-250` = `12500250250`).
- Set `Tabela2026=S` on matched rows, and fill `Descricao` when it is empty.
- Report description dimensions that differ from the catalog by more than 0.05 mm.
- Add items that exist only in the price list as products with `Fonte=tabela2026`. Their facets come from the description, and their dimensions from the reference code or, failing that, the description.

#### Scenario: Tipo B code with hyphen
- **WHEN** the price list has `12500250-250` "GAXETA 1/4 X 1/2 X 1/4"
- **THEN** catalog row `5702` (Referência `12500250250`) gets `Tabela2026=S`

#### Scenario: Item only in the price list
- **WHEN** the price list has `50000` "GAXETA AG 4 100,00 X 115,00 X 10,00 - GSK" and the catalog has no such code
- **THEN** a product with Tipo Gaxeta, Modelo AG 4 (BS), Material GSK and dimensions 100 × 115 × 10 is written, with `Fonte=tabela2026`

#### Scenario: No prices in the output
- **WHEN** the production bundle is built
- **THEN** no unit price or IPI value from the price list appears in `src/data/` or `dist/`

### Requirement: Price list stays out of the repository
The price list SHALL NOT be committed. The paths `docs/catalogos/precos/` and `docs/Gaxetas 2026.pdf` SHALL be git-ignored.

#### Scenario: Price list placed locally
- **WHEN** a developer copies the price list into `docs/catalogos/precos/`
- **THEN** `git status` does not list it
