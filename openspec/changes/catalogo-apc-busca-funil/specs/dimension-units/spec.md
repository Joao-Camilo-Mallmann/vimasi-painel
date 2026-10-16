## ADDED Requirements

### Requirement: Millimeter formatting
Dimension values SHALL be displayed in mm with a comma decimal separator and exactly 2 decimals. They SHALL be rounded half-up on the true value, so floating-point artifacts never turn 3.175 into "3,17".

#### Scenario: Exact half rounds up
- **WHEN** 3.175 mm is displayed
- **THEN** it reads "3,18 mm"

#### Scenario: Missing value
- **WHEN** a dimension is empty or not numeric
- **THEN** the cell shows "—"

### Requirement: Inch formatting
Every displayed mm dimension SHALL also show its inch equivalent. The equivalent is the nearest multiple of 1/64", reduced to lowest terms and written as a mixed number. It SHALL be prefixed with `≈` when it differs from the true value by more than 0.01 mm. Whole inches SHALL be shown without a fraction.

#### Scenario: Exact inch part
- **WHEN** 15.875 mm is displayed
- **THEN** it reads `15,88 mm · 5/8"`

#### Scenario: Metric part
- **WHEN** 22.00 mm is displayed
- **THEN** it reads `22,00 mm · ≈ 55/64"`

#### Scenario: Whole and mixed numbers
- **WHEN** 50.8 mm and 44.45 mm are displayed
- **THEN** the inch parts read `2"` and `1 3/4"`

### Requirement: Derived Seção
For any product with both Interno and Externo, the system SHALL compute Seção = (Externo − Interno) / 2. Seção SHALL be searchable like the other dimensions and shown as a column.

#### Scenario: Seção of a Tipo B
- **WHEN** a product has Interno 6.35 and Externo 12.7
- **THEN** its Seção is 3.175, displayed as `3,18 mm · 1/8"`

#### Scenario: Missing diameter
- **WHEN** a product lacks Interno or Externo
- **THEN** Seção is empty and the product doesn't match a Seção filter

### Requirement: Search input in mm or inch
The search form SHALL provide an mm/pol toggle for dimension inputs, defaulting to mm. In pol mode, inputs SHALL accept these forms:
- `1 3/4`
- `3/16`
- `1.75`
- `1,75`
- `1.1/2`, the price-list style

Inputs SHALL be converted to mm before searching, and pol mode SHALL show the mm value as a hint. Tolerance SHALL stay in mm.

#### Scenario: Searching by fractional inch
- **WHEN** the user switches to pol, types `1 3/4` in ØINT, and searches with ± 0,5 mm
- **THEN** the search uses Interno 44.45 mm

#### Scenario: Invalid inch input
- **WHEN** the user types `1 3/` in pol mode
- **THEN** the field is flagged invalid and not applied

#### Scenario: Toggling keeps the value
- **WHEN** the user typed `25,4` in mm and switches to pol
- **THEN** the field shows `1`
