## ADDED Requirements

### Requirement: Unified product model
The system SHALL load every product source into one in-memory list. The sources are `src/data/catalogo_apc.csv` plus all 24 legacy `src/data/data_*.csv` files. Each product SHALL have these facets:
- `tipo`
- `modelo`
- `material` (may be empty)
- `aplicacoes`: a subset of {haste, êmbolo}; an empty subset means generic

Legacy files SHALL get their facets from a mapping in `src/config/taxonomia.js`. For example, `data_conjunto_zo.csv` maps to Tipo Conjunto, Modelo ZO. When a legacy row has the same `Codigo` as an APC row, the APC row SHALL be used and the legacy row dropped.

#### Scenario: Legacy part is searchable
- **WHEN** the user searches Interno 25,4 ± 0,5 with no facet selected
- **THEN** matching rows from `data_anel_teflon.csv` appear together with APC rows

#### Scenario: Duplicate code across sources
- **WHEN** Codigo `8016PM` exists in both `data_gaxeta.csv` and the APC catalog (AG 13 Polymax)
- **THEN** exactly one result is shown
- **AND** it carries the APC facets

### Requirement: Measurement-first search
The search form SHALL offer the dimension inputs ØINT, ØEXT, Altura and Seção, plus the existing ± tolerance in mm and the code/reference field. Each filled input SHALL be matched within the tolerance. All filled inputs SHALL be combined with AND. The category checkbox picker SHALL be removed.

#### Scenario: Searching by two dimensions
- **WHEN** the user enters ØINT 44,45 and Altura 9,52 with ± 0,5 mm
- **THEN** results contain only parts with Interno between 43.95 and 44.95 mm and Altura between 9.02 and 10.02 mm

### Requirement: Facet funnel with live counts
After a search, the UI SHALL show four facet groups in this order: Tipo, Modelo, Material, Aplicação. Each option SHALL show the number of results it would yield given the measurement filter, the stock filter, and the selections in the *other* facet groups. Options with a count of 0 SHALL be hidden, and so SHALL Modelo options whose Tipo is excluded.

Selection rules:
- Multiple options within a group are combined with OR.
- Groups are combined with AND.
- Facets can be selected in any order.
- Generic parts (empty `aplicacoes`) SHALL match Haste and Êmbolo, but not Amortecimento.

#### Scenario: Narrowing the funnel
- **WHEN** a search returns 50 parts and the user selects Tipo "Gaxeta"
- **THEN** the results drop to the gaxetas, and the Modelo options show counts only for gaxeta models

#### Scenario: Selecting out of order
- **WHEN** the user selects Material "Polymax" before any Tipo
- **THEN** the results show only Polymax parts, and the Tipo counts update to reflect that

#### Scenario: Funnel breadcrumb
- **WHEN** the user has selected Gaxeta → Tipo B → Polymax → Haste
- **THEN** a breadcrumb shows the result count after each step (e.g. `50 → 30 → 5 → 5 → 2`)
- **AND** clicking a step's ✕ removes that selection

#### Scenario: Stock filter interacts with counts
- **WHEN** "Apenas em estoque" is active
- **THEN** the facet counts consider only in-stock parts

### Requirement: Facet badges
Each Tipo SHALL have a predefined badge style. Badge classes SHALL NOT be built by Tailwind string interpolation.

#### Scenario: Production build keeps badge colors
- **WHEN** the app is built with `npm run build`
- **THEN** every Tipo badge renders with its configured colors

### Requirement: Ficha técnica
For APC products, the UI SHALL display the ficha técnica of the product's Modelo + Material: pressure (psi), temperature range (°C) and speed (m/s), as given in the catalog index.

#### Scenario: Polymax Tipo B
- **WHEN** a result is a Tipo B Polymax part
- **THEN** its ficha reads `8000 psi · -45 a +135 °C · 0,5 m/s`

### Requirement: Search by reference
The code field SHALL match `Codigo` or `Referencia` as a case-insensitive substring. The results SHALL show a Referência column whenever any visible row has one.

#### Scenario: Searching by supplier reference
- **WHEN** the user types `12500250` in the code field
- **THEN** rows whose Referencia contains `12500250` are returned
