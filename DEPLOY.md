# Deploying the Gradient Tool

This is a **fully client-side web app** (React + Vite, no backend, no database, no
API keys). Everything — gradient rendering and PNG/video/GIF export — runs in the
visitor's browser. That means it hosts as plain static files anywhere.

Whoever you share it with just **opens the URL in their browser**. No install.

---

## Option A — Drag-and-drop (easiest, no accounts-as-code, no build on their end)

The built site is already packaged: **`gradient-tool-dist.zip`** (in this folder).

1. Go to **https://app.netlify.com/drop**
2. Drag **`gradient-tool-dist.zip`** (or the unzipped `dist/` folder) onto the page.
3. Netlify gives you a live URL instantly (e.g. `https://random-name.netlify.app`).
4. Share that URL. Done.

> You can create a free Netlify account to keep the site and rename it; without an
> account the drop still works but the URL is temporary.

Cloudflare Pages has the same drag-and-drop flow at **https://pages.cloudflare.com**.

---

## Option B — Deploy from Git (auto-rebuilds on every change)

Best if you want the site to update automatically when you edit the code.

1. Put this project on GitHub (see the repo setup note below).
2. On **Netlify** or **Vercel**, "Add new site" → "Import from Git" → pick the repo.
3. Settings are already provided:
   - Netlify reads `netlify.toml` (build: `pnpm build`, publish: `dist`).
   - Vercel reads `vercel.json` (SPA rewrite); set build command `pnpm build`,
     output dir `dist`.
4. Deploy. Every `git push` re-deploys automatically.

---

## Option C — Rebuild the static files yourself

If you change the app and want fresh files to drop somewhere:

```bash
pnpm build      # outputs the site into dist/
```

Then upload the contents of `dist/` to any static host (Netlify, Vercel,
Cloudflare Pages, S3 + CloudFront, GitHub Pages, nginx, etc.).

> On this machine, pnpm lives at `~/.hermes/node/bin` — prepend it to PATH first:
> `export PATH="$HOME/.hermes/node/bin:$PATH"`. On hosted CI builders, pnpm is
> standard and this isn't needed.

---

## Notes

- **SPA routing**: `dist/_redirects` (and `netlify.toml` / `vercel.json`) send every
  path to `index.html` so the app loads on any URL. Already set up.
- **Base path**: the build assumes the site is served from the domain root (`/`).
  If you deploy to a **sub-path** (e.g. GitHub Pages project site
  `username.github.io/gradient-tool/`), set `base: "/gradient-tool/"` in
  `vite.config.ts` and rebuild.
- **Browser support**: needs a modern browser (uses Canvas, `backdrop-filter`,
  `MediaRecorder` for video, OKLCH color). Chrome/Edge/Firefox/Safari current
  versions are all fine.
- **File size**: ~700 KB zipped; loads fast. The main JS is ~468 KB gzipped.
