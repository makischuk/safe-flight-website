# Safe Flight

Marketing site for Safe Flight — a design company working across brand, product & experience.

Built from the June 2026 Figma designs (desktop + mobile). No build step — it's plain
HTML/CSS/JS so it can be served from anywhere.

## Run locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Structure

```
index.html          markup for both the desktop and mobile layouts
css/styles.css       styling, responsive layouts, load-in cascade, fullscreen overlay
js/blob.js           the interactive "Brand · Product · Experience" ethos graphic
js/main.js           load-in orchestration + fullscreen blob controller
assets/wordmark.svg  outlined "Safe Flight" wordmark (replace with the real export)
fonts/               licensed Feijoa Medium (body copy)
```

## Notable behaviour

- **Load-in cascade** — the logo fades in first, then the text, then sections I → V
  reveal one by one. Respects `prefers-reduced-motion`.
- **The ethos graphic** is a hardcoded canvas rebuild of the original screen recording.
  Its surface morphs organically and gooily reaches toward your cursor. Click it (or press
  Enter) to open it fullscreen; close with the ✕ at the bottom, `Esc`, or a backdrop click.

## To finish the brand

- Drop the real outlined wordmark into `assets/wordmark.svg` (white fill, transparent bg).
- Point the `Contact` / `Get in touch` links (currently `mailto:hello@safeflight.studio`)
  at the real address.
