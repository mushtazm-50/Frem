# Frem Design System

Reference this file at the start of any session involving UI changes.

## Philosophy

Inspired by Claude.ai's design language: clean, minimal, generous whitespace, subtle card surfaces. Dark mode only. Data-forward. No decorative elements.

## Color Palette

### Backgrounds
- `bg-primary`: `#171717` — page background
- `bg-secondary`: `#1E1E1E` — sidebar, secondary surfaces
- `bg-surface`: `#252525` — card backgrounds
- `bg-surface-hover`: `#2A2A2A` — card hover state

### Accent
- `accent`: `#E8642A` — warm orange, the sole accent color
- `accent-hover`: `#D4581F` — darker orange for hover states
- `accent-muted`: `rgba(232, 100, 42, 0.15)` — subtle orange backgrounds (icon containers, badges)

### Text
- `text-primary`: `#F5F5F5` — headings, primary content
- `text-secondary`: `#A3A3A3` — body text, descriptions
- `text-tertiary`: `#737373` — labels, timestamps, meta

### Borders
- `border-subtle`: `rgba(255, 255, 255, 0.06)` — card borders, dividers (barely visible)

### Semantic
- `success`: `#4ADE80`
- `warning`: `#FBBF24`
- `error`: `#F87171`

## Typography

### Font Stack
- Sans: `Inter` (primary), system-ui fallback
- Mono: `JetBrains Mono` (numbers, stats, durations)

### Rules
- Headings: `font-semibold`, tight tracking (`tracking-tight`)
- Page titles: `text-2xl`
- Section titles: `text-lg font-semibold`
- Body: `text-sm text-text-secondary`
- Labels: `text-xs text-text-tertiary uppercase tracking-wider font-medium`
- Numbers/stats: `font-mono font-semibold` — numbers should feel data-forward, not decorative
- Large stat values: `text-2xl font-semibold font-mono tracking-tight`

## Spacing

- Page padding: `p-8`
- Card padding: `p-5` (small) or `p-6` (standard)
- Section gaps: `space-y-8`
- Card gaps in grids: `gap-4`
- Inner element spacing: `space-y-2` to `space-y-4`

## Component Patterns

### Cards
- Background: `bg-bg-surface`
- Border: `border border-border-subtle`
- Radius: `rounded-xl`
- No shadows. No gradients. The subtle border + slight background variation creates depth.
- Hover: `hover:bg-bg-surface-hover transition-colors`

### Stat Cards
```
bg-bg-surface rounded-xl p-5 border border-border-subtle
├── label row: icon (text-accent, 14-16px) + text-xs uppercase label
└── value: text-2xl font-semibold font-mono
```

### List Items (Activities)
```
flex items-center gap-4 bg-bg-surface rounded-xl px-5 py-4 border border-border-subtle
├── icon container: w-10 h-10 rounded-lg bg-accent-muted, icon text-accent
├── text: name (text-sm font-medium) + meta (text-xs text-text-tertiary)
├── stats: font-mono font-medium, sub-stat text-xs text-text-tertiary
└── chevron: text-text-tertiary → text-text-secondary on group-hover
```

### Icon Containers
- Small: `w-6 h-6 rounded-md bg-accent-muted`
- Medium: `w-10 h-10 rounded-lg bg-accent-muted`
- Large: `w-12 h-12 rounded-xl bg-accent-muted`
- Icon color: always `text-accent`

### Buttons
- Primary: `bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium`
- Ghost: `text-text-secondary hover:text-text-primary hover:bg-bg-surface`
- All buttons: `transition-colors`, no shadows

### Form Inputs
- `bg-bg-primary border border-border-subtle rounded-lg px-3 py-2.5 text-sm`
- Focus: `focus:outline-none focus:border-accent/40`
- Placeholder: `placeholder:text-text-tertiary`

### Progress Bars
- Track: `w-full bg-bg-primary rounded-full h-2`
- Fill: `bg-accent rounded-full h-2`

### Navigation (Sidebar)
- Active: `bg-accent-muted text-accent`
- Inactive: `text-text-secondary hover:text-text-primary hover:bg-bg-surface`

## Dark Mode

Dark mode is the only mode. There is no light mode toggle. All colors are designed for dark backgrounds.

## Anti-patterns — Do NOT use
- Shadows (`shadow-*`)
- Gradients (`bg-gradient-*`)
- Heavy borders (anything more opaque than `border-subtle`)
- Decorative elements, illustrations, or emojis in the UI
- Bright/saturated background colors
- Light mode considerations
- Rounded-full on cards (use `rounded-xl`)
- Large font sizes for body text (keep to `text-sm`)
