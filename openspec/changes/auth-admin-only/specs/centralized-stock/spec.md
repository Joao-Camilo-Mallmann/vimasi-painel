## ADDED Requirements

### Requirement: Centralized Stock Storage
The system SHALL store the "estoque" (approved/stock) status of products in a Supabase database table instead of browser local storage.

#### Scenario: Loading stock data
- **WHEN** an authenticated user opens the application
- **THEN** the system fetches the list of approved product codes from Supabase and highlights them in the search results

#### Scenario: Toggling stock status to approved
- **WHEN** an authenticated user checks the box next to a product code
- **THEN** the system inserts the product code into the Supabase database

#### Scenario: Toggling stock status to removed
- **WHEN** an authenticated user unchecks the box next to an already approved product code
- **THEN** the system deletes the corresponding record from the Supabase database

### Requirement: Database Security
The system SHALL enforce Row Level Security (RLS) on the stock data.

#### Scenario: Unauthenticated API access
- **WHEN** an unauthenticated request attempts to read or write to the stock table
- **THEN** the Supabase database denies the request
