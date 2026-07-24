## 1. Setup

- [x] 1.1 Install `@supabase/supabase-js` dependency.
- [x] 1.2 Create `src/utils/supabase.js` (or `.ts`) to initialize the Supabase client.
- [x] 1.3 Configure environment variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) in `.env`.

## 2. Authentication UI

- [x] 2.1 Create `src/components/Login.jsx` with Email and Password inputs.
- [x] 2.2 Implement the Supabase `signInWithPassword` logic in `Login.jsx` and handle errors visually.

## 3. App Protection

- [x] 3.1 Update `src/App.jsx` to use Supabase `onAuthStateChange` to listen for session updates.
- [x] 3.2 Add conditional rendering in `src/App.jsx` to render the `<Login />` component if no session is active.

## 4. Centralized Stock Migration

- [x] 4.1 Update the initial `estoque` load in `App.jsx` to fetch rows from the Supabase `estoque` table instead of `localStorage`.
- [x] 4.2 Refactor `handleToggleEstoque` in `App.jsx` to `insert` or `delete` records in the Supabase `estoque` table based on the checked state.
- [x] 4.3 Add a Sign Out button to the header of the main application.
