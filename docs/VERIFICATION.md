# Verification record

Executed locally on Windows with Node 24.12.0 and Playwright Chromium. This is a measured implementation check, not field validation.

## Passing checks

- `npm test`: **31 passing tests** covering exact counts/times/durations, capacity and full-visit opening-hour comparisons, conditional/uncertain/double negation, ambiguous ranges and lower bounds, decimal sentence preservation, unsupported sentence details, non-English input, conflicting counts, changed facts, approval gating, receipt accuracy, snapshot immutability, persisted-data validation, model size, split disjointness, and browser/training evaluation parity.
- `npm run build`: TypeScript check and Vite production build pass. Eight app assets are precached, plus the generated service worker. The model is **21,283 bytes** uncompressed; the initial full production directory measured approximately **305 kB** (excluding demo video, screenshots, data, docs, and development tools).
- `npm run test:e2e`: **6 passing production-browser tests**. The machine-readable run is in `e2e-results.json`.
- Dependency audit after updates: **0 vulnerabilities** reported by npm.

## Browser scenarios

1. A complete mobile flow from offering to an approved bilingual receipt. It includes only the requested lunch, excludes unavailable transport, preserves an unknown wheelchair-access question, and says guest agreement pending. Clipboard denial exposes selectable text. Print emulation hides app navigation and preserves receipt content.
2. Changed capacity/transport facts invalidate approval, alter comparisons, and survive reload.
3. Vague counts, conditional negation, and missing AM/PM remain unresolved. A host correction produces a supported explicit arrival only after the operator changes intent and uncertainty, then reviews the cards.
4. A fresh production page waits for confirmed cache readiness. Browser networking is disabled, the page is reloaded, a new request is checked, a receipt is approved, and a second reload preserves it. No external resource requests are observed.
5. Keyboard skip navigation works; Urdu controls use RTL and persist across reload. A 320px viewport has no horizontal overflow.
6. Malformed storage and denied writes show visible warnings and do not falsely report a successful save.

## Issues found and fixed

- The correction test originally selected a card by its old heading; editing its time changed the heading. The test now locates the stable arrival-card role/prefix.
- Offline asset requests initially missed cache entries because Vite's static responses varied by Origin while module/CSS request headers differed from precache requests. Cache lookup now ignores Vary only for the same-origin, build-enumerated cache. Network-disabled reload passes after the fix.
- Offline readiness now checks an already installed worker independently of registration updates, which can fail while disconnected.
- The initial Vitest dependency had a reported development-tool advisory. It was updated to patched 4.1.11 and the audit became clean.

## Visual inspection

Desktop, 390px mobile, Urdu RTL, and English/Urdu receipt screenshots were rendered and inspected. A sample print PDF is included. System fonts, explicit text statuses, warm cream/green colors, focus outlines, and full-row checkbox targets are used. Unknown English quotations are preserved and bidi-isolated in Urdu receipt templates.

## Limits of these checks

Chromium emulation does not certify real Android/iOS devices, Safari/Firefox, every installation prompt, assistive technology, or native Urdu wording quality. Offline storage can still be evicted by browsers. No real guest traffic or farm operator research was used. The topic classifier's negative evaluation result remains a known limitation; it was not tuned on the held-out set to improve the report.
