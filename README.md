# Grady — Gradient Tool

A premium, fully client-side **gradient design tool**. Build gradients, add
effects, animate them, and export to image, video, or GIF — all in the browser,
no backend required.

## Features

- **Gradient editor** — linear/radial/angular/diamond, multi-stop, OKLCH-based
  perceptual color with gamut-safe recolor and harmonize
- **Effects** — organic simplex film grain, vignette, glow, mesh, and color grade
- **Library** — curated presets, harmonize, and palette extraction from an image
- **Motion** — animated gradients (Hue / Spin / Drift) with matching CSS export
- **Canvas sizes** — ratio-labeled presets (Square 1:1, Story 9:16, OG, Banner…)
- **Export** — PNG/JPG stills, seamless looping video (WebM/MP4), and dithered GIF
- **Vibrant/glassy UI** theme

## Develop

```bash
pnpm install
pnpm dev        # start the dev server
pnpm build      # produce the static site in dist/
```

> On this machine pnpm lives at `~/.hermes/node/bin` — prepend it to PATH first.

## Deploy

Hosted on Netlify with auto-deploy: every push to `main` rebuilds and publishes.
See [`DEPLOY.md`](./DEPLOY.md) for the full options (drag-and-drop, Git, or manual).

Built on the [Toolcraft](https://github.com/pixel-point/toolcraft) scaffold.
