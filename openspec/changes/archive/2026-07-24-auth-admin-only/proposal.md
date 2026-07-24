## Why

The current system is completely open, allowing anyone with the URL to search products and modify the "in-stock" / "approved" status using `localStorage`. To make the system secure and centralized, it needs a strict authentication mechanism where only authorized Admins can log in and manage or view the data. 

## What Changes

- Add a Login Page as the entry point for the application.
- The Login Page will only have Email and Password fields. No "Sign up" functionality will be provided (accounts are created manually by an admin via Supabase).
- Protect all other routes (like the Product Search and Results) so they are inaccessible without a valid session.
- Migrate the "estoque" (approved/stock) mechanism from `localStorage` to a centralized Supabase database table.
- Implement Row Level Security (RLS) on the new table to ensure only authenticated users can read or write data.

## Capabilities

### New Capabilities
- `admin-auth`: Strict authentication flow without public sign-up, ensuring only pre-registered admins can access the system.
- `centralized-stock`: Migration of the `localStorage`-based stock/approval system to a secure, persistent Supabase database table.

### Modified Capabilities


## Impact

- `src/App.jsx`: Needs to be modified to handle the login screen, session state, and Supabase database interactions instead of `localStorage`.
- Supabase project will require a new table and corresponding RLS policies.
- Potential introduction of a routing system (e.g. `react-router-dom`) if not already present, or simple conditional rendering.
