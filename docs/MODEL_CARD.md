# Model and data provenance

## Intended use

Experimental local **topic-mention detection** for English farm-visit requests: meals, transport, timing, group size, activities. The model does not decide availability, polarity, guest agreement, or translation. It can produce both false positives and false negatives. Do not reuse it as an autonomous booking agent.

## Origin and training

All 900 examples were authored synthetically for this implementation. No scraped text, personal information, external datasets, pretrained weights, external LLM calls, or real guest conversations were used. No field study was conducted. Every JSON record has `synthetic: true`, an ID, a family ID, text, and topic labels.

`scripts/train.mjs` contains the full generation procedure and phrase pools. The splits contain 20/5/5 separate sentence-frame families and split-specific topic phrase pools. Each family contributes 30 topic-mask combinations; unsupported topics are inserted deterministically. Some families are negated or explicitly uncertain. Mentions are labeled even when negated; polarity is a separate task. Exact duplicates and family overlap cause training to fail. Paraphrases, negative requests, uncertain wording, and unsupported topics appear in the held-out split.

This avoids exact template-family reuse, but shares a narrow compositional grammar, common topic words, and synthetic slot concepts across splits. It is NOT equivalent to a genuinely independent, human-authored test population. Data diversity and grammatical realism are limited. Number and phrase variants correlate with masks, a potential source of spurious associations. Poor held-out performance is reported rather than hidden.

Preprocessing: lowercase, remove straight/curly apostrophes, tokenize ASCII words and digit runs, binary word unigrams plus adjacent bigrams. Vocabulary is fitted on training only, minimum document frequency 2. Five logistic classifiers are learned using 140 epochs of seeded shuffled SGD, decaying learning rate, and a small active-feature shrinkage term. Seed: 20261004. Biases/weights are rounded to seven decimal places before threshold selection and evaluation. Thresholds are selected for validation F1 from a fixed grid. The held-out split is generated/frozen before training and never used for tuning. Browser/training prediction parity is checked against the complete held-out report.

`public/model.json` includes vocabulary, weights, biases, labels, thresholds, preprocessing notes, version, and training seed. Total: **21,283 bytes**, far below 2 MB. No runtime model package is needed.

## Evaluation and failure disclosure

See [EVALUATION.md](EVALUATION.md) and [evaluation.json](evaluation.json). The classifier has **49.0% micro F1**, while the keyword baseline has **74.3%**. Classifier exact-set match is only **7.3%**. 139 of 150 examples contain at least one topic-label error. The JSON records every classifier and baseline failure, not only selected examples. These are multilabel topic scores; they say nothing about translation quality or the accuracy of unrestricted English understanding.

The baseline uses a frozen, hand-written regex per label. It has no validation/test fitting. The app's deterministic feature synonyms and numeric parsers are separate from this baseline and are not presented as the trained model's performance.

## Guardrails and known limitations

- Structured parsers recognize only bounded explicit forms, such as `6 guests`, `10 am`, `15:00`, and `2 hours`. Counts with adult/child subgroups, alternatives, missing AM/PM, vague phrases, or conflicting times require review. A requested duration must equal the fixed offered duration.
- An arrival is supported only when the entire offered visit fits opening hours. Dates, weekdays, departure times, overnight visits, multiple windows, seasonal availability, and actual inventory are unsupported.
- Simple explicit negative requests become exclusions. Mixed/conditional negation and obvious modifiers remain questions. This is a transparent heuristic, not a complete negation parser.
- Unknown words produce a source-linked unresolved item even inside a sentence containing a recognized feature. The trained classifier adds topic suggestions when rules have no specific interpretation. This intentionally over-asks and may duplicate questions; an operator may dismiss duplicates after review.
- Non-ASCII guest text is routed to clarification. Latin-script non-English text is not reliably detected; the UI explicitly requires English and retains uncovered content. No language identification accuracy is claimed.
- Operators may correct all structured interpretations. Clearing uncertainty is a human assertion and is deliberately not represented as model certainty. Every card must be reviewed; any correction resets all reviews. Facts/request edits invalidate approval.
- Receipts are deterministic templates filled from a cloned approved snapshot. Unknown English quotations stay in English, with bidi isolation in Urdu. Custom activity names must be supplied in both languages by the operator.
- Urdu templates need native-speaker validation. No autonomous legal contract, booking confirmation, translation guarantee, or guest consent is inferred.

## Licenses and distribution

Application source and synthetic data are authored in this workspace for this project. Dependency licenses are supplied by their packages. Icons and farm illustration are original procedural/vector artwork. The optional demo narration was generated through the user's connected ElevenLabs workspace using its premade Bella voice and `eleven_multilingual_v2`; its use is governed by the user's ElevenLabs terms. No cloned real-person voice is used. Media tools do not enter the offline application bundle.
