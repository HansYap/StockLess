# Homepage

The homepage is implemented in the React application. There is no separate exported homepage to maintain.

## Run locally

From the repository root:

```sh
npm install
npm run dev --workspace stockless-frontend
```

Open the address printed by the development server. The homepage start links use `#start`, which opens Upload for new visitors and the saved-data page for returning visitors.

## Source files

- `frontend/src/screens/HomePage.tsx`: homepage sections and illustrative purchase example.
- `frontend/src/homepage.css`: homepage styles, scoped to `.sl-home`.
- `frontend/src/i18n/homepage-refresh.ts`: English, Malay and Chinese homepage copy.
- `frontend/src/Site.tsx`: navigation between the homepage and workspace.
- `frontend/public/homepage/`: local images used by the homepage.

The homepage purchase example is illustrative and does not change a retailer's purchase plan. The actual workflow uses the application's import, matching, readiness and forecasting logic.

Manrope, Source Sans 3 and Inter are bundled locally. Styles use their registered variable-font family names so the browser loads the intended fonts.

## Mobile flyer

The lightweight static flyer is served at `https://stockless.pages.dev/flyer/`.
Its HTML, styles, optional sharing helper and downloadable image are in
`frontend/public/flyer/`. It uses the existing logo and Stocky artwork in
`frontend/public/report/` and a locally bundled Manrope font.

The main action uses `/#start`, the application's existing entry route. The
flyer does not load the React application or forecasting models. To preview it
with Vite, open `/flyer/index.html` explicitly; Cloudflare Pages serves the clean
`/flyer/` address. `?export=1` renders a 1080 x 1920 portrait composition.
Regenerate `stockless-flyer.png` after changing the flyer design.

Cloudflare Pages automatically builds and publishes pushes to `main`. The normal
frontend build includes the flyer; no separate Worker is required. QR codes use
the permanent flyer URL, so visual updates do not require new printed codes.

Generated expo files belong outside this repository. Keep font licences and the
downloadable flyer image with the assets that need them.

## Validation

```sh
npm run typecheck
npm run build
npm test
```
