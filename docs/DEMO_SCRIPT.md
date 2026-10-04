# Three-minute live demo

This is the requested **live presentation script**. The separate recorded submission video is capped at **55 seconds**, under the user's one-minute maximum.

## 0:00–0:25 — Problem and boundary

“A small farm host can receive a request that sounds straightforward but includes things the farm does not offer. Pakka helps the host spot those mismatches and make a clear promise. This is a local offline MVP with three screens. It does not book a visit or claim unrestricted language understanding.”

Show My Offering. Point out that Pakka Demo Farm is fictional and editable.

## 0:25–0:55 — Host facts

“The host saves opening hours, the maximum group size, the visit duration, meals, transport, and activities. Here we offer lunch and a guided walk, but no transport. These are the facts against which requests will be checked.”

Change maximum guests from 12 to 8, save, and show the local save indicator. Briefly switch to Urdu and back.

## 0:55–1:35 — Guest request and interpretation

Open Check Request and select A few mismatches. Run the check.

“Sixteen guests exceed our saved capacity. A four p.m. arrival does not leave enough time for a two-hour visit before closing. Lunch is offered; transport and horse riding are not. Every card preserves the original sentence and explains the comparison.”

Show the unavailable cards. Open a correction and explain that the operator controls the interpretation. Do not arbitrarily approve a different time: describe it as a correction after clarification with a hypothetical guest.

## 1:35–2:05 — Uncertainty and approval

Try Not so clear. Show vague group size, conditional negation, missing AM/PM, and wheelchair access.

“These stay unresolved. English guest text is the only supported input. The local classifier detects topics, but its held-out score was lower than the keyword baseline. Transparent rules and human review control the promise.”

Mark each item reviewed, keeping unresolved questions. Approve the receipt.

## 2:05–2:35 — Receipt

“The English and Urdu receipts come from fixed wording and approved facts. They show inclusions, exclusions, and unresolved questions. Unknown English text stays quoted in English. Both say guest agreement pending. This is not a booking confirmation.”

Show both languages, copy, and print preview. Explain that edits invalidate approval.

## 2:35–3:00 — Offline proof and honest limits

Wait for Offline ready. Disable networking in browser developer tools and reload. Reopen Promise Receipt.

“The app shell, model, and facts are local. The receipt survived reload without network access. The entire model is 21,283 bytes. All data is labeled synthetic; the repository includes split data, training, actual failures, tests, and instructions. Urdu requires native-speaker review before deployment.”

# Recorded video production

- Target/output duration: **55 seconds**, measured after encoding.
- Actual production app interactions, not generated UI footage.
- Narration: ElevenLabs Bella, multilingual v2; one take, 52.2 seconds.
- `demo/narration.txt` contains the exact spoken words; `demo/metadata.json` records measured media properties.
- `scripts/record-demo.mjs` reproduces the recording from the local preview and included narration. It visibly shows facts, checking, correction, approval, receipts, and a network-disabled reload.
- Lovable was connected and inspected. Its connector provides app-building/hosting tools, not screen-video recording. A second generated app was unnecessary: this recording demonstrates the tested repository implementation directly.
