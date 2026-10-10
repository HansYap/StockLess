`stocky-hello.svg` and `stocky-hello.png` are static exports of the `hello` pose in
`src/onboarding/Stocky.tsx`. The print report uses the SVG; pdf-lib embeds the PNG.
Update both assets when the Stocky artwork changes so exports match the website.

`stockless-logo.svg` and `stockless-logo.png` are static exports of
`src/components/Logo.tsx`. Use the complete website lockup in both print and
downloaded PDF reports; update both assets when the website logo changes.
