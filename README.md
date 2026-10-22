# StockLess

**Stock Less, Waste Less.**

StockLess helps Malaysian micro and small food retailers turn historical sales
data into clearer restocking decisions. It highlights data problems, estimates
four-week demand and checks planned orders for potential overstock or shortages.

[Live application](https://stockless.pages.dev/) · [Mobile flyer](https://stockless.pages.dev/flyer/)

## Features

- Import CSV and Excel sales files and map their columns.
- Review missing values, duplicates and unusual sales records.
- Explore sales history and estimated demand for each product.
- Review suggested orders against available and incoming stock.
- Apply supplier carton sizes, minimum orders and delivery lead times.
- Estimate the stock, money and food-waste impact of purchasing decisions.
- Export purchase plans and reports.

Sales files are processed in the browser and remain on the user's device. No
account is required. Suggestions support the retailer's judgment; the retailer
makes the final purchasing decision.

## Development

Requires Node.js 24 or later and npm. From the repository root:

```sh
npm install
npm run dev --workspace stockless-frontend
```

Open the local address printed by the development server. The flyer is available
at `/flyer/index.html` in development.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

The production build is written to `frontend/dist`.

## Project structure

```text
backend/            Browser-compatible planning and analysis engine
  fixtures/         Development and test datasets
  src/              Domain logic and reference data
  tests/            Engine tests
frontend/
  public/           Static assets, bundled models, samples and mobile flyer
  scripts/          Development, build and test entry points
  src/              React application
  tests/            Interface and integration tests
HOMEPAGE.md         Homepage, flyer and deployment maintenance notes
```

The application uses React, TypeScript and Vite, with Vitest and React Testing
Library for tests. Spreadsheet imports use SheetJS; report exports use ExcelJS
and PDF-Lib; browser-based model inference uses Transformers.js.

## Deployment

The existing Cloudflare Pages project automatically builds and publishes changes
pushed to `main`. The mobile flyer is included in the same deployment. Generated
expo exports and local build output are excluded from version control.

## Sustainability

StockLess supports UN SDG 12.3 by helping retailers identify unnecessary orders
before excess stock becomes avoidable food waste.

Built by **Nexus 12**.
