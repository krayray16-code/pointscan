# PointScan tests

```bash
node tests/points-engine.test.cjs          # unit tests (no deps)
node tools/validate-food-db.cjs            # food DB validation + report

node tests/fixtures/make-camera-fixtures.cjs   # once, before browser tests
node tests/smoke.mjs                       # app flows: meals, search, plan toggle
node tests/ios-scan.mjs                    # iPhone live scanner (simulated iOS Safari)
node tests/android-and-prep.mjs            # Android native scanner + add-ins flow
```

The browser tests need Playwright and Chromium. They default to this
environment's paths and can be pointed elsewhere:

```bash
PW_MODULES=/path/to/node_modules CHROMIUM_PATH=/path/to/chrome node tests/smoke.mjs
```

## How the scanner is tested without a phone

`ios-scan.mjs` is the important one. It reproduces an iPhone by deleting
`window.BarcodeDetector` (Safari doesn't have it) and setting an iPhone user
agent, then feeds Chromium a fake camera playing a real, checksum-valid EAN-13
barcode via `--use-file-for-fake-video-capture`. So the test drives the exact
path a real iPhone takes: `getUserMedia` → ZXing `decodeFromStream` → barcode →
product lookup → points. `android-and-prep.mjs` covers the other branch by
installing a `BarcodeDetector` shim, confirming Android still uses the native
decoder and that both platforms price an identical scan identically.

The `.y4m` video fixtures are generated, not committed (~7MB each).
