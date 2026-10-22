# StockLess expo flyer

This is an independent, lightweight static page within the existing Vite site.
It does not load the application, forecasting models, or React bundle.
For Vite's development server, open `/flyer/index.html` explicitly. Cloudflare
Pages serves the same file at the clean `/flyer/` URL.

- Public URL: https://stockless.pages.dev/flyer/
- Main action: `/#start` uses the application's existing entry route.
- Assets: the existing report logo and Stocky SVGs, and a locally bundled Manrope font.
- `?export=1`: a fixed 1080 x 1920 layout for exporting the shareable flyer.
- `stockless-flyer.png`: the downloadable portrait image. Regenerate it after visual edits.
- No analytics, tracking, external fonts, accounts, or new server resources are added.

## Publish

Build the existing frontend with `npm run build`. Publish `frontend/dist` to the
existing Cloudflare Pages project using its normal deployment method. The flyer
will be included automatically at `/flyer/`; a separate Worker is unnecessary.
Confirm the live flyer returns successfully before printing the booth QR sign.

## Expo files

`frontend/scripts/build-expo-assets.py` generates the QR code and A4/A5 booth
signs from the permanent flyer URL. Generated printable PDFs are in `output/pdf`;
the export kit is in `outputs/expo`. The script uses ReportLab and Pillow.

The QR embeds the full HTTPS flyer URL directly; it has a four-module quiet zone,
high error correction, and no third-party redirect or subscription dependency.
The printed sign also includes the address for visitors who prefer typing it.

Print the PDF at **actual size / 100%**, in portrait. The QR is 50 mm wide
on A5 and about 71 mm on A4. Test a printed copy with at least two phones over mobile data.
