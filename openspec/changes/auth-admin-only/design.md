## Context

The current `App.jsx` handles both searching and stock checking (approval) by saving state in `localStorage` under the key `"vimasi_estoque"`. Since the system will now be used by Admins only to manage and lookup stock, we need to secure this workflow by moving to a Supabase backend for both authentication and persistent data storage.

## Goals / Non-Goals

**Goals:**
- Secure the application behind a mandatory login screen (E-mail/Password).
- Ensure only Admins (pre-created users in Supabase) can access the app.
- Migrate the `localStorage` logic to a centralized Supabase table (`estoque` or similar).

**Non-Goals:**
- Self-service account creation (Sign-up) is explicitly out of scope.
- Complex role-based access control (RBAC) with multiple tiers (e.g., View-Only vs Admin) is not needed for now; any valid login is treated as an Admin with full read/write access.

## Decisions

1. **Authentication Flow**
   - **Decision:** Use `@supabase/supabase-js` to handle `signInWithPassword`.
   - **Rationale:** Simplest integration with the existing React setup and offloads security to Supabase.
   - **Alternative:** Custom JWT backend (too complex, unnecessary overhead).

2. **Routing / App State**
   - **Decision:** Introduce conditional rendering in `App.jsx` based on session state (`if (!session) return <Login />`).
   - **Rationale:** Keeps the app lightweight without requiring a heavy routing library immediately.
   - **Alternative:** Full `react-router-dom` setup (viable, but conditional state is faster to implement for this specific requirement).

3. **Database Schema**
   - **Decision:** Create a `estoque` table in Supabase with `codigo` (string, primary key) and `created_at`.
   - **Rationale:** Efficiently replaces the `localStorage` dictionary mapping (`{[codigo]: true}`).

4. **Security (RLS)**
   - **Decision:** Enable Row Level Security (RLS) on the `estoque` table so that only authenticated users (`auth.uid() != null`) can select, insert, or delete rows.

## Risks / Trade-offs

- **Risk: Manual Account Management** → Because there is no sign-up, the owner must manually create users in the Supabase dashboard. Mitigation: Ensure the owner is comfortable using the Supabase admin panel.
