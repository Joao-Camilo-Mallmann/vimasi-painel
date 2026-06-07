# Vimasi Vedações - Design System & Style Architecture

This document is the absolute source of truth for the Vimasi Vedações visual identity, style architecture, and layout rules. It focuses exclusively on the abstract design tokens, stylistic principles, layout guidelines, color theory, and typographic rules extracted directly from the actual codebase and Vue pages.

As an AI agent or human developer, you **must** strictly adhere to these design parameters when creating interfaces. Do not introduce new colors, fonts, shadows, or spacing logic.

---

## 1. Core Visual Philosophy

### 1.1 The Industrial Premium Aesthetic
The aesthetic balances two distinct worlds: the rugged, heavy-duty nature of industrial sealing (represented by deep, dark canvases and high-contrast alert colors) and a modern, premium technological feel (represented by glassmorphism, fluid animations, ambient glowing blobs, and strict geometries).

### 1.2 Depth and Hierarchy Over Flatness
The UI rejects flat design. Hierarchy is established exclusively through depth (the Z-axis). This is achieved through overlapping layers, varying degrees of blur (backdrop filters), translucent borders, projected shadows, and massive blurred background geometry.

### 1.3 Fluidity and Motion
Every interactive change in state must feel physical and fluid. Elements do not instantaneously snap between colors; they transition. Elements do not simply exist; they respond physically (scaling) to user interaction.

---

## 2. Color Architecture & Theory

The color palette is restricted and relies heavily on alpha transparency (opacity) and Tailwind V4 gradient syntax rather than flat distinct hex codes for variations.

### 2.1 The Dark Canvas (Surfaces & Backgrounds)
*   **Base Floor:** `--color-primary-dark` (`#050505`). The absolute lowest layer. This is not pure black (`#000000`), but a near-black that absorbs light.
*   **Elevated Solid:** `--color-primary-card` (`#121212`). Used when a solid, non-transparent elevated surface is required.
*   **Translucent Surface (Low):** `bg-white/5` (`rgba(255, 255, 255, 0.05)`). The default state for resting elevated elements (like unselected form fields or subtle dividers).
*   **Translucent Surface (Medium):** `bg-white/10` (`rgba(255, 255, 255, 0.1)`). The default hover state for translucent surfaces.

### 2.2 Semantic & Accent Colors
*   **The Gold Accent (Premium Marker):** `--color-accent-gold` (`#e4c7aa`). Used to denote quality, secondary actions, and subtle highlights. 
    *   *Variant:* `#d4af37`. A slightly darker, more saturated gold, used strictly for borders, scrollbars, and underlines to provide higher contrast.
*   **The Red Accent (Action & Focus):** `--color-accent-red` (`#e53935`). The primary interactive color. It draws the eye instantly. Used for active selection states, critical interactions, and branding elements.
*   **The Green Accent (Communication):** `#25D366` (Hover: `#20bd5a`). The WhatsApp green. This must **never** be used for internal navigation or standard site actions.

### 2.3 Typography Color Hierarchy
*   **Primary Focus (Titles & Actions):** `text-white` or `text-white/90`. Maximum contrast.
*   **Secondary Focus (Body & Reading):** `text-white/80` or `text-white/70`. Reduces eye strain.
*   **Tertiary Focus (Metadata & Disabled):** `text-white/60` or `text-white/40`.
*   **Gradient Text (Premium Titles):** Apply `bg-linear-to-r from-white via-white to-white/50 bg-clip-text text-transparent` to main headings to create a subtle fade effect.

---

## 3. Typographic System

The typography is aggressive and dual-natured, relying on stark contrast between structural headings and readable body text.

### 3.1 Structural Typography (`font-anton`)
*   **Purpose:** To command attention. Used for Hero titles, section headers, and massive watermarks.
*   **Rules of Engagement:**
    *   MUST always be rendered in `uppercase`.
    *   MUST almost always be rendered in `italic`.
    *   MUST be tracked out. Use `tracking-wide` (0.025em) or `tracking-widest` (0.1em) to allow the heavy letters to breathe.
    *   Combine with `drop-shadow-2xl` or `drop-shadow-md` when placed over complex backgrounds.

### 3.2 Reading Typography (`font-arimo`)
*   **Purpose:** The workhorse font. Used for paragraphs, button texts, inputs, and functional UI elements.
*   **Rules of Engagement:**
    *   Line height must be generous for readability: `leading-relaxed` (1.625) or `leading-loose` (2).
    *   Standard sentence case. Do not overuse uppercase here.

---

## 4. Geometry, Layout & Spatial Logic

### 4.1 The Grid and Rhythm
*   **Max Width Constraint:** The main content column must never exceed `max-w-7xl` (1280px). 
*   **Internal Alignment:** Use CSS Grid for repeating elements (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`).
*   **Section Pacing:** Standard section padding must be large: `py-24` or `py-32`. Hero sections must be `min-h-svh` (viewport height).

### 4.2 Border Radius (Rounding)
*   **Large Structural Containers (Sections, Big Cards):** `rounded-3xl` (24px) or `rounded-2xl` (16px).
*   **Interactive Elements (Inputs, Small Cards):** `rounded-xl` (12px) or `rounded-lg` (8px).
*   **High-Action Buttons:** `rounded-full` (9999px).

---

## 5. Material, Depth, and Shadow

### 5.1 Glassmorphism Mechanics
The signature style of Vimasi is the frosted glass effect, sitting above the dark canvas.
*   **The `.glass` Utility:** Opacity: 3% white, Blur: 10px. Usage: Standard resting cards.
*   **The `.glass-strong` Utility:** Opacity: 80% near-black, Blur: 16px. Usage: Sticky navigation bars or persistent floating headers.

### 5.2 Ambient Glowing Geometry (Blobs)
To break up the pure black background, massive blurred geometric shapes are placed in the absolute background of sections.
*   **Rule:** Create absolute positioned `div` elements with `h-full w-1/3 rounded-full blur-[100px]`.
*   **Colors:** Use `bg-accent-gold/5` or `bg-accent-red/5` depending on the section's semantic feel.
*   **Positioning:** Place them at the edges (`top-0 right-0 translate-x-1/2` or `bottom-0 left-0 -translate-x-1/2`).

### 5.3 Overlays and Gradients (Tailwind V4 Syntax)
Because of the dark theme, images MUST be overlaid with dark linear gradients to ensure text readability.
*   **Syntax:** You MUST use Tailwind v4 syntax: `bg-linear-to-*` instead of `bg-gradient-to-*`.
*   **Hero Overlays:** `bg-linear-to-b from-black/80 via-black/50 to-primary-dark`.
*   **Card Overlays (Bottom Text):** `bg-linear-to-t from-black/90 via-black/40 to-transparent`.

### 5.4 The Grain Overlay
*   **The `.grain` Utility:** A fractal noise SVG applied globally. It operates at low opacity (2% to 30% depending on the layer) and must have `pointer-events: none`.

---

## 6. Interaction & Motion Rules

Transitions and animations govern the feel of the UI. It must feel weighty but responsive.

### 6.1 Hover Reveals (Cards)
When hovering over product cards, the internal text should reveal itself fluidly, and the background image should scale slowly.
*   **Image Scale:** Put the image inside an `overflow-hidden` container. Apply `transition-transform duration-700 group-hover:scale-110`.
*   **Text Reveal:** For hidden text inside a card, set the default state to `max-h-0 opacity-0 overflow-hidden transition-all duration-700 ease-out`. On `group-hover:`, transition to `max-h-32 opacity-100`.

### 6.2 Button Shimmers and Physics
*   **Hover Scale:** Interactive blocks and buttons must lift towards the user: `hover:scale-105` or `hover:-translate-y-2`.
*   **Click/Tap:** Buttons must compress: `active:scale-95`.
*   **Shimmer Effect:** Primary buttons can contain an internal `div` that triggers a shimmer animation across the button on hover: `group-hover:animate-shimmer absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/20 to-transparent`.

### 6.3 Keyframe Animations
*   **Entrance (`.animate-fade-in-up`):** Used strictly for elements entering the viewport. Translates Y from +30px to 0px, fading opacity from 0 to 1 over 0.8 seconds.
*   **Ambient Motion (`.animate-float`):** Applies a continuous infinite Y-axis bobbing.
*   **Bouncing Indication (`animate-bounce`):** Used for scroll down arrows (`bottom-10 text-white/50`).

---

## 7. Z-Index and Spatial Layering

Proper layering is critical to prevent visual collapse. Adhere strictly to this stack:

*   **`z-0`:** Background images, dark gradients, and ambient glowing blobs (`blur-[100px]`).
*   **`z-10`:** Standard page content (text, inline cards, grids) sitting above backgrounds.
*   **`z-20`:** Elevated cards that overlap multiple sections.
*   **`z-40`:** Fixed Header / Sticky Navbars (`.glass-strong`).
*   **`z-50`:** Floating global action buttons (e.g., the WhatsApp floater).
*   **`z-[9999]`:** The global `.grain` noise overlay (when applied via CSS pseudo-elements).

---

## 8. Accessibility & Forms (Visual Rules)

*   **Focus States:** Never remove outlines without providing an alternative. `focus:outline-none focus:ring-2 focus:ring-accent-red focus:border-transparent`.
*   **Contrast Rules:** Text placed directly over photography MUST have an intervening `bg-linear-to-t` dark gradient or a `.glass` layer behind it to ensure reading contrast.
*   **Native Form Elements (Selects & Dropdowns):**
    *   **Color Scheme:** The application MUST explicitly define `color-scheme: dark;` on the `body` element in the global CSS. This forces the browser to render native UI components (like `<select>` dropdown menus and scrollbars) using the operating system's dark theme, preventing thick, bright borders on dark surfaces.
    *   **Option Styling:** Native `<option>` elements inside dropdowns must be explicitly styled to match the dark theme (e.g., `className="bg-zinc-900 text-white"`). Never rely on inherited text colors without defining the background, as native dropdowns can render light backgrounds on some OS configurations.
