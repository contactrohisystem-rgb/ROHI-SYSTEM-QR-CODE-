# ROHI Restaurant QR Pay — Master Design System

> Generated with UI UX Pro Max design intelligence.
> This document is the global design foundation for the ROHI platform.
> All pages, components, and restaurant-specific themes inherit from this.

## 1. Brand Identity

**ROHI** is a multi-restaurant QR payment and lightweight billing SaaS platform
for the Mozambican market (Maputo pilot).

### Core principles
- **Trust** — payment confidence, precise amounts, authoritative confirmation.
- **Clarity** — information hierarchy over decoration.
- **Speed** — fast QR landing, minimal friction, efficient operations.
- **Adaptability** — each restaurant expresses its identity; the platform stays consistent.

### Design inspirations (not copied)
- Stripe — payment confidence + clarity.
- Linear — interface consistency + information hierarchy.
- Square — restaurant + payment usability.
- Toast — restaurant operational workflows.

## 2. Colour System

### Platform (ROHI-owned)
| Token | Light | Dark | Role |
|---|---|---|---|
| `--background` | warm white `oklch(0.985 0.003 75)` | navy-charcoal `oklch(0.16 0.013 255)` | page |
| `--card` | white | `oklch(0.205 0.013 255)` | surfaces |
| `--foreground` | `oklch(0.2 0.01 255)` | `oklch(0.96 0.004 255)` | text |
| `--muted-foreground` | `oklch(0.5 0.01 255)` | `oklch(0.66 0.01 255)` | secondary text |
| `--border` | `oklch(0.92 0.004 75)` | `oklch(1 0 0 / 8%)` | dividers |
| `--destructive` | `oklch(0.55 0.21 25)` | `oklch(0.62 0.21 25)` | errors |

### Per-restaurant branding (CSS variable overrides)
Each restaurant configures:
- `--primary` (brand colour, hex → applied via `BrandTheme` wrapper).
- `--primary-foreground` (auto-computed via `contrastForeground()`).
- `--ring`, `--chart-1`, `--sidebar-primary` → match `--primary`.
- `appearance` → `dark` (default) or `light` (applies `.theme-light` scope).

### Chart palette
| Token | Colour | Use |
|---|---|---|
| `--chart-1` | brand primary | revenue / success |
| `--chart-2` | amber `oklch(0.7 0.15 65)` | secondary metric |
| `--chart-3` | orange `oklch(0.65 0.18 45)` | tertiary |
| `--chart-4` | teal `oklch(0.6 0.1 195)` | info |
| `--chart-5` | rose `oklch(0.62 0.2 15)` | failed / negative |

## 3. Typography

- **Sans**: Geist Sans (loaded via `next/font/google`).
- **Mono**: Geist Mono (references, IDs, data).
- **Scale**: Tailwind defaults (text-xs → text-2xl for dashboard; text-sm → text-lg for guest).
- **Tabular numbers**: `font-variant-numeric: tabular-nums` on all money + data figures (`.tabular` class).
- **Letter-spacing**: tracking-tight on headings; tracking-wider on uppercase labels.

## 4. Spacing + Layout

- **Radius**: `--radius: 0.75rem` (admin), `0.875rem` (guest light).
- **Card padding**: `p-4` (compact) or `p-6` (standard).
- **Grid**: responsive `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
- **Max width**: `max-w-6xl` (admin), `max-w-md` (guest mobile-first).
- **Gap**: `gap-3` (tight) or `gap-4` (standard).

## 5. Component Standards

### Buttons
- Primary: `bg-primary text-primary-foreground` — brand colour.
- Outline: `border border-input bg-background`.
- Ghost: `hover:bg-accent`.
- Destructive: `text-destructive` variant for delete/reject.
- Icon buttons: min 44px touch target, `aria-label` required.

### Status indicators
| Status | Colour | Badge variant |
|---|---|---|
| Available / Succeeded | `bg-primary/12 text-primary` | secondary |
| Pending / Awaiting | amber | secondary |
| Failed / Rejected | `bg-destructive/12 text-destructive` | secondary |
| Occupied / Neutral | `bg-muted text-muted-foreground` | secondary |

### Tables / Lists
- Divide-y for rows; no heavy borders.
- Right-align money + data figures.
- Truncate long text with `truncate`.

### Dialogs
- Max width: `max-w-md` (standard), `max-w-lg` (bill manager).
- Sticky footer with actions.
- AlertDialog for destructive confirmations.

### Toasts
- Bottom-right; auto-dismiss after 1s (TOAST_REMOVE_DELAY fixed from 1000000).

## 6. Accessibility

- WCAG AA contrast: dark bg + light text ≥ 4.5:1; brand colour + white text checked via `contrastForeground()`.
- Keyboard: all interactive elements focusable; focus-visible ring (`ring-2 ring-ring`).
- Floor plan tables: `role="button"`, `tabIndex={0}`, `aria-label`, Enter/Space to select.
- Screen reader: `sr-only` for context; semantic HTML (`main`, `header`, `nav`, `footer`).
- Reduced motion: `animate-fade-up` respects motion (CSS animation; can be disabled).

## 7. Responsive Behaviour

- **Mobile** (< 640px): sidebar collapses to hamburger Sheet; grids stack to 1 column; guest page is `max-w-md`.
- **Tablet** (640–1024px): 2-column grids; sidebar visible at `lg` (1024+).
- **Desktop** (> 1024px): full sidebar; 3-4 column grids; floor plan canvas.
- **Touch targets**: min 44px for interactive elements.

## 8. Multi-Restaurant Architecture

- `BrandTheme` wrapper applies restaurant CSS variables to staff dashboard + guest `/pay`.
- Restaurant switcher (header dropdown) → cookie-based → JWT reads on every request.
- Guest `/pay` applies brand via `brandCssVars()` inline style on `<main>`.
- Tables, bills, payments, orders, menu — all scoped by `restaurantId`.
