## CAMP-ACE AI — Foundation Build (Pure HTML/CSS/JS)

Replace the current TanStack Start scaffold with a static site served by Vite, using only semantic HTML, modern CSS, and vanilla JS. This becomes the locked design system for all future pages.

### 1. Stack teardown & static setup

- Remove: `src/routes/`, `src/router.tsx`, `src/routeTree.gen.ts`, `src/start.ts`, `src/server.ts`, `src/styles.css`, `src/lib/*`, `src/hooks/*`, `components.json`, TanStack + React + Tailwind deps in `package.json`.
- Replace `vite.config.ts` with a minimal static Vite config (root at project root, entry `index.html`).
- New folder structure:
  ```text
  index.html
  public/favicon.ico
  src/
    styles/
      tokens.css       # colors, spacing, radii, shadows, typography vars
      base.css         # resets, body, typography
      components.css   # buttons, cards, chips, inputs, chat bubbles
      layout.css       # navbar, footer, section shells, grid
      landing.css      # hero, stats, features, workflow, drives, AI, announcements
      animations.css   # keyframes + utility classes (fade, slide, scale, float)
    scripts/
      main.js          # entry, imports modules
      navbar.js        # scroll-blur behavior, mobile menu
      counters.js      # IntersectionObserver count-up
      reveal.js        # scroll-reveal for cards/sections
      chat.js          # ACE AI typed-message demo
    assets/
      logo.svg
  ```
- Fonts loaded via `<link rel="preconnect">` + Google Fonts `<link>` in `index.html` head (Poppins 500/600/700, Inter 400/500/600).

### 2. Design system (`tokens.css`)

CSS variables — the single source of truth reused on every future page:

```text
--bg:#09090B; --surface:#18181B; --surface-2:#1F1F23;
--primary:#6366F1; --accent:#8B5CF6;
--success:#22C55E; --warning:#F59E0B; --danger:#EF4444;
--text:#FAFAFA; --text-muted:#A1A1AA;
--border:rgba(255,255,255,0.08);
--radius-sm:8px; --radius-md:14px; --radius-lg:20px; --radius-xl:28px;
--shadow-elev:0 10px 40px -12px rgba(0,0,0,0.6);
--shadow-glow:0 0 0 1px rgba(99,102,241,0.25), 0 20px 60px -20px rgba(99,102,241,0.35);
--font-display:'Poppins',sans-serif; --font-body:'Inter',sans-serif;
--ease:cubic-bezier(0.22,1,0.36,1);
```

Reusable components (`components.css`): `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.card`, `.glass-card`, `.chip`, `.stat`, `.section`, `.eyebrow`, `.divider`.

### 3. Navigation (`layout.css` + `navbar.js`)

- Fixed top navbar, translucent border-bottom.
- Left: logo mark + wordmark "CAMP-ACE AI" with tiny tagline "Ace Every Placement Opportunity".
- Center: Home · Features · Placement Drives · About · Contact.
- Right: `Student Login` (ghost) + `Placement Officer Login` (primary).
- `navbar.js` toggles `.is-scrolled` class past 20px scroll → adds `backdrop-filter: blur(20px)` + `background: rgba(9,9,11,0.72)`.
- Mobile: hamburger → slide-down panel.

### 4. Landing page sections (`index.html` + `landing.css`)

1. **Hero** — two-column: left headline "Ace Every Placement Opportunity with AI.", subtitle, two CTAs, small trust chip ("Built for one campus. Managed by your Placement Cell."). Right: floating glass "dashboard preview" card stack showing Upcoming Placement Drive, Interview Schedule, ACE AI Chat, Application Status, Announcements — layered with subtle parallax float animation.
2. **Statistics** — 4 stat cards (2500+ Students, 150+ Drives, 600+ Offers, 85% Placement Rate) with `counters.js` count-up on scroll into view.
3. **Features** — 8 premium cards in responsive grid: Student Dashboard, Placement Drive Management, AI Resume Review, Interview Preparation, Application Tracking, Interview Scheduling, Placement Analytics, Announcements. Icon (inline SVG), title, one-line description, hover lift + border glow.
4. **Workflow** — vertical/stepped flow (desktop: horizontal timeline; mobile: vertical) with 7 nodes: Company → Placement Cell receives details → Officer creates drive → Eligibility added → Eligible students notified → Students apply → Interview schedule → Results. Connecting animated line drawn on scroll.
5. **Upcoming Placement Drives** — 3 demo cards (Zoho, Infosys, TCS). Each: company mark, role, deadline chip, eligibility chips (CGPA, Branch), disabled "Apply" button with tooltip "Available after login".
6. **ACE AI section** — mock chat surface: user bubble "How should I prepare for Zoho?", AI response typing in on scroll with 5 bulleted prep steps. Left column: heading "Meet ACE AI" + copy.
7. **Announcements** — 4 cards: Resume Workshop, Mock Interview, Coding Contest, Placement Training with date chips + category tag.

### 5. Footer

4-column grid: Brand + tagline + socials · Product (Features, Drives, ACE AI) · For Students / For Officers · Contact (email, campus address). Bottom bar: © 2026 CAMP-ACE AI · Privacy · Terms.

### 6. Animations (`animations.css` + `reveal.js`)

- Keyframes: `fade-up`, `fade-in`, `scale-in`, `slide-in-right`, `float`, `count-up`, `shimmer`.
- `.reveal` utility observed by `IntersectionObserver` → adds `.is-visible` triggering animation.
- Hero dashboard cards use infinite `float` with staggered delays.
- Buttons: transform on hover, subtle inner glow on primary.
- Global `html { scroll-behavior: smooth; }`.

### 7. Deliverable guardrails

- 100% responsive (breakpoints 1280 / 1024 / 768 / 480).
- No external UI libraries. Icons = inline SVGs.
- Semantic tags (`header`, `nav`, `main`, `section`, `article`, `footer`).
- Ready to be consumed by future Spring Boot REST endpoints (buttons and cards use `data-*` hooks like `data-drive-id`).
- Design system is locked: every future page must reuse `tokens.css`, `components.css`, and the navbar/footer partials.

### Technical notes

- Vite serves `index.html` at project root; `npm run dev` / `bun dev` works unchanged.
- No SSR, no routing library. Future multi-page work will add sibling `.html` files (e.g. `features.html`, `drives.html`) sharing the same CSS/JS bundles.
- No secrets, no backend calls in this milestone.
