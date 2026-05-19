# Tailwind CSS v4

> https://tailwindcss.com/llms.txt returned 404 — no official llms.txt published yet.
> Refer to https://tailwindcss.com/docs for full documentation.

## Key facts for SalesTrack

- Tailwind v4 is **CSS-first** — configuration lives in `src/app/globals.css`, not a JS config file.
- **Do not create `tailwind.config.js`** — it does not exist in this project and is not needed.
- Design tokens are CSS variables (`--color-background`, `--color-foreground`, etc.).
- Use semantic utility classes: `bg-background`, `text-foreground`, `border-border`, `ring-ring`.
- shadcn components already use correct Tailwind v4 class names — do not change them.
- `@tailwindcss/postcss` is the PostCSS plugin (replaces the old `tailwindcss` postcss plugin).

## v4 vs v3 differences to watch

| v3                          | v4                                  |
|-----------------------------|-------------------------------------|
| `tailwind.config.js`        | CSS `@theme` block in globals.css   |
| `@apply` with config values | CSS variables via `var(--...)`      |
| `purge` / `content` array   | Auto-detected from template files  |
| `theme.extend.colors`       | `@theme { --color-brand: #... }`    |
| `darkMode: 'class'`         | `@variant dark (&:where(.dark,...))`|

## Adding custom tokens

```css
/* src/app/globals.css */
@theme {
  --color-brand: oklch(0.6 0.18 250);
  --radius-card: 0.75rem;
}
```

## Resources

- [Tailwind v4 docs](https://tailwindcss.com/docs)
- [Upgrade guide v3→v4](https://tailwindcss.com/docs/upgrade-guide)
- [shadcn Tailwind v4 guide](https://ui.shadcn.com/docs/tailwind-v4)
