# Pitchey Design System

> Status: in-progress, 2026-04-24. Authored alongside the portal-theming work
> (commits `b76b9e1`, `1395fdc`, `c1362c4`, `0ee9423`). Screenshots captured
> from production at deploy `f0564b59`.
>
> **Goal:** if you're adding new UI, grep this doc first. Don't invent a new
> color, new button style, new tab pattern — the theming hook has it. If the
> hook is missing a slot you need, add the slot and enumerate it per portal;
> don't compose at the call site (Tailwind JIT won't generate the class).

## Contents

1. [Philosophy](#philosophy)
2. [Portal identity — how users know where they are](#portal-identity)
3. [Brand color tokens](#brand-color-tokens)
4. [`usePortalTheme()` — the complete slot reference](#useportaltheme--the-complete-slot-reference)
5. [Layout primitives](#layout-primitives)
6. [Component patterns](#component-patterns)
7. [Semantic vs accent color rules](#semantic-vs-accent-color-rules)
8. [Adding new portal-themed UI](#adding-new-portal-themed-ui)
9. [Known pitfalls](#known-pitfalls)

---

## Philosophy

Three ideas the system is built around.

**1. Portal identity is persistent.** A signed-in user is always in one of four portals (Creator / Investor / Production / Watcher, plus Admin as a fifth for ops). The portal they're in should be obvious at every moment of navigation, not just on the landing page. This is implemented by three always-visible signals:

- A role **badge** next to the Pitchey logo ("Creator" / "Investor" / etc.), tinted with the portal color
- A 3px colored **strip** at the top of the main content area, always visible
- Chrome accents (credit pill, profile icon, primary buttons, tab underlines) colored with the portal accent

**2. Brand tokens, not Tailwind shade guesses.** The canonical portal colors live in `frontend/tailwind.config.js` as `brand.portal-creator`, `brand.portal-investor`, etc. All theming derives from those five hex values. Shade variants (light/muted/hover) come from Tailwind's opacity modifier (`/10`, `/90`), not from the shade palette (`-100`, `-600`). This keeps one source of truth — change a brand hex, everything updates.

Prior to 2026-04-24, there was a parallel-universe shade mapping in `MinimalHeader.getPortalColor()` that returned Tailwind color names (`purple` / `green` / `blue` / `cyan` / `indigo`). Investor was mapped to `green`, which was wrong — the brand hex `#5B4FC7` is indigo-violet. Nobody noticed because the function was only used for the credit pill. When the theming rollout expanded its surface area, the drift became visible. Fixed in commit `1395fdc`; do not reintroduce a parallel color-name function.

**3. Color conveys meaning *or* accent — never both.** A green 100+700 badge in this codebase means "approved" or "healthy" or "live". A red badge means "error" or "stale" or "high severity". A blue icon alongside a "Total Views" metric means "this metric type is views". These are **semantic** colors and they do not follow portal theming. Portal accents are reserved for brand/identity elements: primary buttons, active tabs, focus rings, credit pills, page-heading icon tints, hero gradients. If you're tempted to theme a status badge, stop — the user needs "approved" to look the same whether they're in Creator or Watcher.

---

## Portal identity

![Portal identity signals](screenshots/identity-watcher-billing.png)

Three layered signals, each redundant with the others:

| Signal | Location | Source |
|---|---|---|
| Role badge | Right of Pitchey logo in `MinimalHeader` | `theme.badge` |
| Identity strip | 3px bar under header, top of main content | `theme.stripTop` |
| Accent elements | Credit pill, profile icon, buttons, tabs, focus | Various `theme.*` slots |

If one is overlooked, the others catch it. A user who missed the badge in the top-left will see the credit pill; someone ignoring both will still see the colored strip; and if all of those are somehow missed, the primary-action button on the page reinforces it.

The **Pitchey logo stays brand-purple (`text-purple-600`) across every portal.** The logo identifies the product; the badge and accents identify the portal. Keeping them separate means "I'm on Pitchey" and "I'm in Watcher" read as two facts, not one.

---

## Brand color tokens

Defined in `frontend/tailwind.config.js` under `theme.extend.colors.brand`:

| Token | Hex | Portal | Semantic note |
|---|---|---|---|
| `brand-portal-creator` | `#7B3FBF` | Creator | Violet — author/creative-tool feeling |
| `brand-portal-investor` | `#5B4FC7` | Investor | Indigo-violet — calm, financial |
| `brand-portal-production` | `#4A5FD0` | Production | Blue-indigo — corporate, pipeline |
| `brand-portal-watcher` | `#06B6D4` | Watcher | Cyan — light, browsing |
| `brand-portal-admin` | `#DC2626` | Admin | Red — elevated permission, caution |

Also in `brand.*`:

| Token | Use |
|---|---|
| `brand-anchor` / `brand-action` | Primary CTA on marketing pages |
| `brand-trending` | "Trending" sort / badge |
| `brand-new` | "New" sort / badge |
| `brand-featured` | "Featured" or "Hot" sort |
| `brand-nda` | NDA-related chrome |

Marketing and feature-sort tokens are **not** portal-themed — they're product-wide.

---

## `usePortalTheme()` — the complete slot reference

Import: `import { usePortalTheme, getPortalTheme } from '@shared/hooks/usePortalTheme'`

Use `usePortalTheme()` inside components (reads current auth state). Use `getPortalTheme(userType)` when you already have the userType string (non-hook contexts, like props).

Every slot is a pre-enumerated Tailwind class string — JIT-safe.

### Button + action

| Slot | Value (watcher example) | Use for |
|---|---|---|
| `btnPrimary` | `bg-brand-portal-watcher hover:bg-brand-portal-watcher/90 text-white` | Main page CTAs |
| `btnPrimaryDisabled` | ... `disabled:opacity-50 disabled:cursor-not-allowed` | CTA with `disabled={loading}` |

### Navigation

| Slot | Value | Use for |
|---|---|---|
| `tabActiveBorder` | `border-brand-portal-watcher` | Active tab underline |
| `tabActiveText` | `text-brand-portal-watcher` | Active tab label |

### Input / focus

| Slot | Value | Use for |
|---|---|---|
| `focusRing` | `focus:ring-brand-portal-watcher` | Standalone focusable |
| `peerFocusRing` | `peer-focus:ring-brand-portal-watcher/30` | Toggle-switch peer pattern |
| `inputFocus` | `focus:outline-none focus:ring-2 focus:ring-brand-portal-watcher focus:border-transparent` | Text / select inputs (includes the outline-none + ring-2 + border-transparent bundle) |
| `toggleChecked` | `peer-checked:bg-brand-portal-watcher` | Toggle switch on-state |

### Accent surfaces

| Slot | Value | Use for |
|---|---|---|
| `bgLight` | `bg-brand-portal-watcher/5` | Faintest tint, almost-white |
| `bgLightHover` | `hover:bg-brand-portal-watcher/5` | Hover-only faint tint |
| `bgMuted` | `bg-brand-portal-watcher/10` | Pill backgrounds, icon containers |
| `textAccent` | `text-brand-portal-watcher` | Accent-colored text (links, icons) |
| `textAccentHover` | `hover:opacity-80` | Accent link hover |
| `textOnSolid` | `text-white/80` | Secondary text over solid brand bg |
| `borderAccentHover` | `hover:border-brand-portal-watcher` | Dropzone / card hover reveal |

### Persistent identity

| Slot | Value | Use for |
|---|---|---|
| `stripTop` | `bg-brand-portal-watcher` | The 3px strip in `PortalLayout` |
| `badge` | `bg-brand-portal-watcher/10 text-brand-portal-watcher` | Role badge next to logo |
| `creditPill` | `bg-brand-portal-watcher/10 text-brand-portal-watcher hover:bg-brand-portal-watcher/20` | Header credit pill (full composite) |

### Hero / gradient

| Slot | Value | Use for |
|---|---|---|
| `heroGradient` | `bg-gradient-to-r from-brand-portal-watcher to-brand-portal-watcher/70` | Feature card backgrounds, dashboard hero |

### Loading

| Slot | Value | Use for |
|---|---|---|
| `spinnerBorder` | `border-brand-portal-watcher` | Loading spinner bottom border |

### Metadata

| Slot | Value | Use for |
|---|---|---|
| `key` | `'watcher'` | Discriminator |
| `label` | `'Watcher'` | Display name in badge |
| `tokenName` | `'brand-portal-watcher'` | Raw token name, debugging |

---

## Layout primitives

### `MinimalHeader` (`frontend/src/shared/components/layout/MinimalHeader.tsx`)

Fixed 64px header, sticky at top. Laid out as:

```
┌─────────────────────────────────────────────────────────────────┐
│ [≡] Pitchey [Watcher]  Home Marketplace ...   [500 Credits] 🔔 ⌄│
│      ^^^^^  ^^^^^^^^^^                         ^^^^^^^^^^^      │
│      brand  theme.badge                        theme.creditPill │
└─────────────────────────────────────────────────────────────────┘
```

![MinimalHeader anatomy](screenshots/anatomy-header.png)

Responsive rules:
- Mobile (`<sm`): hamburger menu + Pitchey logo + role badge + compact credit pill (just "⊚ 500") + bell + profile. Home/Marketplace quick-nav hidden (sidebar covers it).
- Desktop (`sm+`): full nav strip, credit pill shows "500 Credits".

### `PortalLayout` (`frontend/src/shared/components/layout/PortalLayout.tsx`)

Wraps every authenticated portal route. Renders:

```
┌─ MinimalHeader ────────────────────────────────────────┐
├────────────────────────────────────────────────────────┤
│ Sidebar   │ ━━━━━━ theme.stripTop (3px) ━━━━━━━━━━━━━━│ ← always visible
│ (per-    │                                             │
│  portal  │  Page content from Outlet                   │
│  nav)    │    <PageErrorBoundary key={pathname}>       │
│          │      <Suspense fallback={<spinner />}>      │
│          │        <Outlet />                           │
│          │      </Suspense>                            │
│          │    </PageErrorBoundary>                     │
│          │                                             │
└──────────┴─────────────────────────────────────────────┘
```

Sidebar is per-portal and already themed (`EnhancedCreatorNav.tsx`, etc.). They use the brand tokens directly, not the hook — the hook is for shared components.

### Per-portal sidebars

- `EnhancedCreatorNav.tsx`
- `EnhancedInvestorNav.tsx`
- `EnhancedProductionNav.tsx`
- `EnhancedWatcherNav.tsx`
- `EnhancedAdminNav.tsx`

Each has its own nav section structure (Dashboard / Pitches / NDAs / etc.) and uses the brand-portal token for active/hover states.

---

## Component patterns

### Primary action button

```tsx
<button className={`px-4 py-2 rounded-lg transition ${theme.btnPrimary}`}>
  Save Changes
</button>
```

With disabled state:
```tsx
<button
  disabled={saving}
  className={`px-4 py-2 rounded-lg transition ${theme.btnPrimaryDisabled}`}
>
  {saving ? 'Saving...' : 'Save Changes'}
</button>
```

### Outlined button (secondary)

```tsx
<button className={`px-4 py-2 rounded-lg transition border ${theme.textAccent} ${theme.tabActiveBorder} ${theme.bgLightHover}`}>
  Account Settings
</button>
```

### Tab navigation (horizontally scrollable on mobile)

```tsx
<nav className="flex space-x-4 sm:space-x-8 px-4 sm:px-6 overflow-x-auto scrollbar-hide">
  {tabs.map((tab) => (
    <button
      key={tab.id}
      onClick={() => setActive(tab.id)}
      className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap shrink-0 ${
        active === tab.id
          ? `${theme.tabActiveBorder} ${theme.tabActiveText}`
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      <tab.icon className="w-4 h-4" />
      {tab.label}
    </button>
  ))}
</nav>
```

`overflow-x-auto scrollbar-hide` + `whitespace-nowrap shrink-0` on each tab is **mandatory** for any tab bar with more than 3-4 items — otherwise 6 tabs clip off-screen at 390px mobile width.

### Input (text / select)

```tsx
<input
  type="text"
  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
/>
```

### Toggle switch (tailwind peer pattern)

```tsx
<label className="relative inline-flex items-center cursor-pointer">
  <input type="checkbox" className="sr-only peer" checked={on} onChange={handler} />
  <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 ${theme.peerFocusRing} rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${theme.toggleChecked}`}></div>
</label>
```

### Checkbox (inline)

```tsx
<input
  type="checkbox"
  checked={on}
  onChange={handler}
  className={`rounded border-gray-300 ${theme.textAccent} ${theme.focusRing}`}
/>
```

### Page-heading icon tile

```tsx
<div className="flex items-center gap-3">
  <div className={`p-2 rounded-lg ${theme.bgMuted}`}>
    <Shield className={`w-6 h-6 ${theme.textAccent}`} />
  </div>
  <div>
    <h1 className="text-2xl font-bold text-gray-900">NDA Management</h1>
    <p className="text-sm text-gray-600">Comprehensive NDA workflow and analytics</p>
  </div>
</div>
```

### Credit balance hero card (gradient)

```tsx
<div className={`${theme.heroGradient} rounded-lg p-6 text-white`}>
  <h3 className="text-lg font-semibold">Current Plan</h3>
  <p className="text-2xl font-bold mb-2">Free Plan</p>
  <p className={`${theme.textOnSolid} text-sm`}>No active subscription</p>
</div>
```

### File upload dropzone (per-portal hover accent)

```tsx
<div className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition ${theme.borderAccentHover}`}>
  <input type="file" ... />
</div>
```

### Loading spinner

```tsx
<div className="flex items-center justify-center py-16">
  <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${theme.spinnerBorder}`}></div>
</div>
```

**Don't** wrap loading states in `min-h-screen` or page gradients — that collides with `PortalLayout`'s main area. Just center inside the available space.

### Error state

```tsx
{error && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <p className="text-red-700">{error}</p>
    <button onClick={retry} className="mt-2 text-red-600 hover:text-red-800 underline text-sm">
      Try again
    </button>
  </div>
)}
```

Error colors are **semantic red**, not portal-themed.

---

## Semantic vs accent color rules

The rule: **color conveys meaning or accent, never both.**

### Keep these as-is (semantic)

| Meaning | Color | Example usage |
|---|---|---|
| Approved / live / healthy | green-100 / green-700 | NDA signed, pitch published, service healthy |
| Error / rejected / stale | red-100 / red-700 | Pitch rejected, API 5xx, stale NDA request |
| Pending / in-review | yellow-100 / yellow-700, or blue-100 / blue-700 | "Under Review" badge |
| Severity: high | red-600 text | Fraud flag, overdue invoice |
| Severity: medium | orange-600 text | Stale 3-7 days |
| Metric type: views | blue-500 icon | `<Eye className="text-blue-500" />` |
| Metric type: likes | red-500 icon | `<Heart className="text-red-500" />` |
| Metric type: messages | green-500 icon | `<MessageSquare className="text-green-500" />` |
| Metric type: revenue | purple-500 icon | `<DollarSign className="text-purple-500" />` |

These should look the same regardless of which portal the user is in. A production user seeing a Creator's dashboard (via shared slate view, etc.) needs "approved" to still look green.

### Theme these (portal accents)

| Use | Slot |
|---|---|
| Primary page CTA | `theme.btnPrimary` |
| Active tab underline + text | `theme.tabActiveBorder` + `theme.tabActiveText` |
| Input focus ring | `theme.inputFocus` |
| Toggle switch on-state | `theme.toggleChecked` |
| Page-heading icon tint | `theme.bgMuted` + `theme.textAccent` |
| Feature card background | `theme.heroGradient` |
| Credit pill | `theme.creditPill` |
| Role badge | `theme.badge` |
| Dropzone hover | `theme.borderAccentHover` |
| Loading spinner | `theme.spinnerBorder` |

### The Pitchey logo is never themed

Stays `text-purple-600` always. Product brand ≠ portal identity.

---

## Adding new portal-themed UI

**Step 1.** Check if the element you're adding fits an existing slot. If yes, use it.

**Step 2.** If not, add a new slot to `usePortalTheme.ts`:

```ts
// In the PortalTheme interface:
myNewSlot: string;  // brief comment describing what it renders

// In EACH of the 5 THEMES entries (creator / investor / production / watcher / admin),
// add the slot with the portal's token substituted in:
creator: {
  ...,
  myNewSlot: 'hover:ring-brand-portal-creator/50',
},
// ... etc for the other 4 portals
```

**Step 3.** Use `theme.myNewSlot` at the call site inside a template literal:

```tsx
<div className={`base-classes ${theme.myNewSlot}`} />
```

**Never** try to compose dynamically:

```tsx
// ❌ WRONG — Tailwind JIT can't see the class
<div className={`hover:ring-${theme.tokenName}/50`} />

// ❌ WRONG — same problem
<div className={`hover:${theme.tabActiveBorder}`} />

// ✅ RIGHT — enumerated slot
<div className={theme.myNewSlot} />
```

Why: Tailwind's JIT compiler scans source files for literal class strings and generates CSS for each one it finds. Template-literal composition means the literal JIT sees is `hover:ring-${...}/50`, not `hover:ring-brand-portal-creator/50` — no CSS is generated. The enumerated-per-portal approach puts every final string as a literal in the theme file, which JIT can see.

**Step 4.** Before deploying, sanity-check the CSS bundle has your class:

```bash
npm run build --prefix frontend
grep -o "my-new-class-prefix-brand-portal-[a-z]*" frontend/dist/assets/index-*.css | sort -u
# Should print 5 entries, one per portal
```

---

## Known pitfalls

### 1. Bash `cwd` doesn't persist between commands

Deploy from `frontend/` — chained `cd frontend && wrangler pages deploy dist/` loses the cd after the first shell exits. Use an absolute path or enter the directory once and run multi-command:

```bash
cd /home/.../pitcheymovie/pitchey_v0.2/frontend && npm run build && npx wrangler pages deploy dist/ --project-name=pitchey --branch=main
```

Per `feedback_pages_deploy_dir.md` memory.

### 2. Double chrome from pages rendering their own `<header>`

Pages inside `PortalLayout` must not render their own `<header>`. If you need a page heading, use the pattern:

```tsx
<div className="space-y-6">
  <div>
    <h1 className="text-2xl font-bold text-gray-900">Page Title</h1>
    <p className="text-sm text-gray-500 mt-1">Page subtitle</p>
  </div>
  {/* page content */}
</div>
```

See commit `8781ab4` for the cleanup of 9 pages that had this bug.

### 3. Routes outside `PortalLayout`

A few routes render bare (`CreatePitch` wizard for Production at `/production/pitch/new`, `PublicPitchView` for anonymous browsers, login pages). Those pages have their own chrome (`PortalTopNav` or standalone layouts) and **should not** use `usePortalTheme` for layout-level concerns; their colors come from their own headers directly.

### 4. Legacy `getUserTypeColor()` in `Profile.tsx`

`frontend/src/pages/Profile.tsx:204` has a `getUserTypeColor()` function returning per-user-type badge colors for the profile header (Creator=purple, Investor=green, Production=blue, etc.). This **is semantic**, not portal accent — it labels "which kind of user is this?" independent of which portal you're viewing from. Do not replace with the theme hook.

### 5. Tailwind JIT doesn't see template-literal class composition

See the "Adding new portal-themed UI" section. The rule: every final class string must appear as a literal in some source file. Use enumerated slots.

---

## Screenshots

> **Status:** screenshots referenced in this doc live at `docs/screenshots/`.
> Route-by-route captures live at `docs/screenshots/routes/<portal>/<route>.png`.
> Component galleries at `docs/screenshots/components/<slot>.png`.

Routes and component states are captured at deploy `f0564b59` unless otherwise noted.
