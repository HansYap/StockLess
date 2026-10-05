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

## Validation

```sh
npm run typecheck
npm run build
npm test
```
