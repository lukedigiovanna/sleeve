# Stylesheet organization

`main.css` is the single entry point, imported by `src/main.ts`. Vite resolves its local imports for development and bundles them for production.

Imports preserve the original stylesheet's exact rule order. Each file is a contiguous slice, including its existing media/container queries and comments. The split does not introduce cascade layers, change selectors, consolidate duplicate rules, or relocate responsive overrides.

- `themes/`: semantic color and font tokens, with compatibility aliases for existing components.
- `base.css`: reset, native controls, and default focus behavior.
- `layout/`: header, footer, original responsive overrides (including reduced motion), and swipe previews.
- `components/`: utilities, buttons, dialogs/forms/search/rating controls, late focus overrides, and visibility/draft controls.
- `features/`: library, album detail, catalog pickers/pages/presentation, listening/credits, genres, artists, and authentication.

Some slices intentionally contain styles shared with another feature: the library slice includes album cards and ratings; catalog styles include main navigation and shared buttons. `catalog-presentation.css` remains last because its later responsive rules override earlier catalog styles. Likewise, `focus-overrides.css` follows the original genre section, and `visibility-and-drafts.css` follows authentication. Moving those rules beside earlier related declarations would change their cascade position.

Add styles to the owning file where its cascade position is appropriate. Any reordering or duplicate consolidation should be a separate change with before/after visual verification. Recheck library, detail, all three catalogs, album editor, and authentication at desktop/narrow widths and with reduced motion; run the Node/browser suites and production build.

## Adding a theme

1. Copy a palette in `themes/` and define every semantic color and font token. Set `color-scheme` for native widgets. Keep layout and spacing out of theme files.
2. Import it before `themes/tokens.css` in `main.css`.
3. Register its ID and label in `public/theme-init.js` and extend the `Theme` union in `src/app/theme.ts`. The Profile selector and saved-preference validation use this registry.
4. Check text contrast, focused controls, dialogs, charts, and all catalog pages at desktop and mobile sizes. Extend `tests/browser/themes.spec.ts` with the palette's expected background.

`theme-init.js` runs synchronously before rendering and reads `sleeve-theme` from local storage. Invalid or unavailable storage falls back to Walnut. Preferences stay on this browser and do not change account data. The production service worker includes the script in its app shell.

Newsreader, Inter, Alegreya Sans, Space Grotesk, Cormorant Garamond, Source Serif 4, Fraunces, and IBM Plex Mono load through Google Fonts with `display=swap`; named local fallbacks keep the app usable offline or when fonts are blocked. Sage retains the original system font stacks. Muted text in the light themes is slightly darker than the initial palette proposal for readability. Decorative vinyl artwork keeps its own colors, just like album images.

Walnut uses Alegreya Sans with slightly open letter spacing for body text alongside Newsreader headings. It pairs warm brown surfaces and cream text with deep forest green controls and lighter leaf green links and amber ratings, inspired by a warmly lit wood listening room. Editorial, Sage, Walnut, Prism, Nocturne, and Soul are the available themes; saved Midnight and Modern preferences fall back to Walnut.

Walnut is the default palette, including the CSS fallback before initialization. Prism pairs near-black surfaces with cyan controls, Fraunces headings, and Space Grotesk body text. Its optional `--color-accent-spectrum` gradient adds thin static rainbow accents to the masthead, primary buttons, chart bars, and filled rating stars; other themes default to `none`. Keep gradients decorative and use solid semantic colors for text, focus rings, and control contrast.

Rating gradients span the entire five-star row, including gaps. Each filled star reveals its segment of that shared spectrum; half and empty stars retain the existing clipping.

Nocturne takes its cues from a classical concert hall: burgundy velvet surfaces, ivory text, champagne gold controls and ratings, Cormorant Garamond headings, and Source Serif 4 body text. It uses solid accents and the shared layout, with Walnut remaining the default.

Soul evokes seventies soul and funk record sleeves and vintage hi-fi equipment. Light honey backgrounds and warm peach-cream panels pair with espresso text, burnt-orange controls, and dark amber ratings. Stacked olive, orange, and brown header stripes, heavier Fraunces headings and album titles, and Alegreya Sans body text give it a bolder soul/funk character.

Saved preferences using Soul’s former `retro` ID continue to load Soul.

Themes can provide `--color-accent-readable` when their control accent is too dark for text against the page background. Walnut uses this for its deep forest green controls, keeping links and focus indicators readable.
