// All examples are synthetic, authored for this MVP. No external data or API.
import fs from "node:fs";
import crypto from "node:crypto";
const labels = ["meals", "transport", "timing", "group", "activities"];
const pools = {
  train: [
    [
      "lunch for everyone",
      "tea during the visit",
      "breakfast at the farm",
      "dinner for us",
    ],
    [
      "a pickup from town",
      "transport to the farm",
      "a shuttle for everyone",
      "a ride back",
    ],
    [
      "arrival at 10 am",
      "a 2 hour visit",
      "departure at 4 pm",
      "an early morning visit",
    ],
    [
      "6 guests in our group",
      "a party of 14 people",
      "3 adults and 2 children",
      "a large group",
    ],
    [
      "a guided farm walk",
      "vegetable picking",
      "horse riding",
      "feeding the animals",
    ],
  ],
  validation: [
    [
      "a meal for the visitors",
      "cups of tea",
      "lunch with the hosts",
      "evening dinner",
    ],
    [
      "a vehicle to collect us",
      "pickup from the hotel",
      "a return shuttle",
      "transport for visitors",
    ],
    [
      "a visit at 11 am",
      "staying for 3 hours",
      "arrival after lunch",
      "a late visit",
    ],
    [
      "8 visitors together",
      "a group of 15 guests",
      "4 adults with children",
      "several people",
    ],
    [
      "a farm walking tour",
      "picking fresh vegetables",
      "a horse ride",
      "time with farm animals",
    ],
  ],
  test: [
    [
      "something to eat for lunch",
      "tea to drink",
      "a breakfast meal",
      "food for supper",
    ],
    [
      "being picked up at our hotel",
      "a bus ride to your farm",
      "a car for the journey back",
      "help arranging transport",
    ],
    [
      "getting there at 9 am",
      "spending 4 hours there",
      "coming sometime after noon",
      "leaving at 6 pm",
    ],
    [
      "10 people coming along",
      "a total of 16 visitors",
      "2 grownups plus 3 kids",
      "a few of our friends",
    ],
    [
      "walking around the farm with a guide",
      "harvesting vegetables ourselves",
      "riding horses on the property",
      "letting children feed animals",
    ],
  ],
};
const wrappers = {
  train: [
    "We would like {x}.",
    "Please include {x}.",
    "Can you provide {x}?",
    "Our plan involves {x}.",
    "We need {x}.",
    "Could we have {x}?",
    "We are looking for {x}.",
    "The family wants {x}.",
    "Please arrange {x}.",
    "Is {x} possible?",
    "Tell me whether you offer {x}.",
    "We hope to get {x}.",
    "Our request is {x}.",
    "We do not need {x}.",
    "Please do not include {x}.",
    "We might want {x}.",
    "We have not decided about {x}.",
    "Would it be possible to book {x}?",
    "We expect {x}.",
    "Before visiting, can you confirm {x}?",
  ],
  validation: [
    "For our outing, we are considering {x}.",
    "Will there be an option for {x}?",
    "We can manage without {x}.",
    "Perhaps {x} would suit us.",
    "I am checking the possibility of {x}.",
  ],
  test: [
    "The trip would work for us if it came with {x}.",
    "My relatives asked whether {x} is on offer.",
    "Leave {x} out of the arrangement, please.",
    "We have mixed feelings about {x}; nothing is settled.",
    "What can you tell a first-time visitor about {x}?",
  ],
};
const unsupported = [
  "overnight accommodation",
  "wheelchair access",
  "a refund policy",
  "Wi-Fi access",
  "a birthday cake",
  "a prayer room",
];
fs.mkdirSync("data", { recursive: true });
fs.mkdirSync("docs", { recursive: true });
fs.mkdirSync("public", { recursive: true });
const sets = {};
for (const [split, templates] of Object.entries(wrappers)) {
  sets[split] = templates.flatMap((template, f) =>
    Array.from({ length: 30 }, (_, r) => {
      const mask = (r + f * 7) % 32;
      const topics = labels.filter((_, k) => mask & (1 << k));
      const parts = labels.flatMap((_, k) =>
        mask & (1 << k) ? [pools[split][k][(r + f + k) % 4]] : [],
      );
      if (!parts.length || r % 7 === 0)
        parts.push(unsupported[(r + f) % unsupported.length]);
      const x = parts.join(" and ");
      return {
        id: `${split}-${f}-${r}`,
        synthetic: true,
        family: `${split}-family-${f}`,
        text: template.replace("{x}", x),
        labels: topics,
      };
    }),
  );
  fs.writeFileSync(
    `data/${split}.json`,
    JSON.stringify(sets[split], null, 2) + "\n",
  );
}
const all = Object.values(sets).flat();
if (new Set(all.map((x) => x.text.toLowerCase())).size !== all.length)
  throw Error("Duplicate text across dataset");
for (const a of Object.keys(sets))
  for (const b of Object.keys(sets))
    if (
      a !== b &&
      sets[a].some((x) => sets[b].some((y) => x.family === y.family))
    )
      throw Error("Family overlap");
export function tokens(text) {
  const words =
    text
      .toLowerCase()
      .replace(/[’']/g, "")
      .match(/[a-z]+|\d+/g) || [];
  return [
    ...new Set([...words, ...words.slice(1).map((w, i) => words[i] + " " + w)]),
  ];
}
const counts = new Map();
for (const row of sets.train)
  for (const t of tokens(row.text)) counts.set(t, (counts.get(t) || 0) + 1);
const vocabulary = [...counts]
  .filter(([, c]) => c >= 2)
  .map(([t]) => t)
  .sort();
const lookup = new Map(vocabulary.map((t, i) => [t, i]));
const features = (text) =>
  tokens(text)
    .filter((t) => lookup.has(t))
    .map((t) => lookup.get(t));
const sigmoid = (z) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
const train = sets.train.map((r) => ({
  x: features(r.text),
  y: labels.map((l) => +r.labels.includes(l)),
}));
let seed = 20261004;
const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
const weights = labels.map(() => Array(vocabulary.length).fill(0)),
  bias = labels.map(() => 0);
for (let epoch = 0; epoch < 140; epoch++) {
  const order = train.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const rate = 0.07 / (1 + epoch * 0.018);
  for (const n of order) {
    const { x, y } = train[n];
    for (let k = 0; k < 5; k++) {
      const p = sigmoid(bias[k] + x.reduce((sum, i) => sum + weights[k][i], 0));
      const error = p - y[k];
      bias[k] -= rate * error;
      for (const i of x)
        weights[k][i] -= rate * (error + 0.002 * weights[k][i]);
    }
  }
}
for (let k = 0; k < 5; k++) {
  bias[k] = +bias[k].toFixed(7);
  weights[k] = weights[k].map((w) => +w.toFixed(7));
}
const predict = (text) => {
  const x = features(text);
  return labels.map((_, k) =>
    sigmoid(bias[k] + x.reduce((s, i) => s + weights[k][i], 0)),
  );
};
const thresholds = labels.map((l, k) => {
  let best = -1,
    chosen = 0.5;
  for (const t of [0.25, 0.35, 0.45, 0.5, 0.55, 0.65, 0.75]) {
    let tp = 0,
      fp = 0,
      fn = 0;
    for (const r of sets.validation) {
      const p = predict(r.text)[k] >= t,
        y = r.labels.includes(l);
      tp += +(p && y);
      fp += +(p && !y);
      fn += +(!p && y);
    }
    const f = (2 * tp) / (2 * tp + fp + fn || 1);
    if (f > best) {
      best = f;
      chosen = t;
    }
  }
  return chosen;
});
const model = {
  version: 1,
  labels,
  vocabulary,
  weights,
  bias,
  thresholds,
  preprocessing:
    "lowercase; delete apostrophes; ASCII letters/digits; binary unigrams and adjacent bigrams",
  trainingSeed: 20261004,
};
const json = JSON.stringify(model);
fs.writeFileSync("public/model.json", json);
// Frozen baseline, specified independently of held-out scores.
const baselinePatterns = [
  /\b(meal|meals|food|lunch|breakfast|dinner|tea)\b/i,
  /\b(transport|pickup|shuttle|ride|taxi)\b/i,
  /\b(time|arrival|departure|hour|hours|am|pm|morning|late)\b/i,
  /\b(group|guests|people|adults|children|party)\b/i,
  /\b(walk|tour|picking|riding|animals|activities)\b/i,
];
function evaluate(fn) {
  const rows = sets.test.map((r) => ({ r, p: fn(r.text) }));
  const perLabel = labels.map((label, k) => {
    let tp = 0,
      fp = 0,
      fn = 0;
    for (const { r, p } of rows) {
      const y = r.labels.includes(label);
      tp += +(p[k] && y);
      fp += +(p[k] && !y);
      fn += +(!p[k] && y);
    }
    return {
      label,
      tp,
      fp,
      fn,
      precision: tp / (tp + fp || 1),
      recall: tp / (tp + fn || 1),
      f1: (2 * tp) / (2 * tp + fp + fn || 1),
    };
  });
  const total = perLabel.reduce(
    (a, r) => ({ tp: a.tp + r.tp, fp: a.fp + r.fp, fn: a.fn + r.fn }),
    { tp: 0, fp: 0, fn: 0 },
  );
  return {
    perLabel,
    microF1: (2 * total.tp) / (2 * total.tp + total.fp + total.fn),
    macroF1: perLabel.reduce((s, r) => s + r.f1, 0) / 5,
    exactMatch:
      rows.filter(({ r, p }) =>
        labels.every((l, k) => p[k] === r.labels.includes(l)),
      ).length / rows.length,
    failures: rows
      .filter(({ r, p }) =>
        labels.some((l, k) => p[k] !== r.labels.includes(l)),
      )
      .map(({ r, p }) => ({
        text: r.text,
        expected: r.labels,
        predicted: labels.filter((_, k) => p[k]),
      })),
  };
}
const result = {
  seed: 20261004,
  counts: Object.fromEntries(
    Object.entries(sets).map(([k, v]) => [k, v.length]),
  ),
  modelBytes: Buffer.byteLength(json),
  modelSha256: crypto.createHash("sha256").update(json).digest("hex"),
  testSha256: crypto
    .createHash("sha256")
    .update(fs.readFileSync("data/test.json"))
    .digest("hex"),
  familyOverlap: 0,
  duplicateTexts: 0,
  classifier: evaluate((text) =>
    predict(text).map((p, k) => p >= thresholds[k]),
  ),
  keywordBaseline: evaluate((text) =>
    baselinePatterns.map((re) => re.test(text)),
  ),
};
fs.writeFileSync(
  "docs/evaluation.json",
  JSON.stringify(result, null, 2) + "\n",
);
const pct = (n) => (n * 100).toFixed(1) + "%";
let report =
  "# Measured synthetic evaluation\n\nGenerated by `npm run train`. No real guest data or user research. The held-out set is never used to fit vocabulary, weights, or thresholds.\n\n";
report += `600 training / 150 validation / 150 held-out examples. 20 / 5 / 5 template families; zero family overlap and zero exact text duplicates. Model: **${result.modelBytes.toLocaleString()} bytes** uncompressed (target <2,000,000).\n\n`;
report +=
  "| System | Micro F1 | Macro F1 | Exact label match |\n|---|---:|---:|---:|\n";
for (const [name, r] of [
  ["Classifier", result.classifier],
  ["Keyword baseline", result.keywordBaseline],
])
  report += `| ${name} | ${pct(r.microF1)} | ${pct(r.macroF1)} | ${pct(r.exactMatch)} |\n`;
report +=
  "\n| Label | Model precision | Model recall | Model F1 | Baseline precision | Baseline recall | Baseline F1 |\n|---|---:|---:|---:|---:|---:|---:|\n";
result.classifier.perLabel.forEach((r, k) => {
  const b = result.keywordBaseline.perLabel[k];
  report += `| ${r.label} | ${pct(r.precision)} | ${pct(r.recall)} | ${pct(r.f1)} | ${pct(b.precision)} | ${pct(b.recall)} | ${pct(b.f1)} |\n`;
});
report +=
  "\n## Actual classifier failures (first 12)\n\n" +
  (result.classifier.failures
    .slice(0, 12)
    .map(
      (r) =>
        `- “${r.text}” Expected: ${r.expected.join(", ") || "none"}. Predicted: ${r.predicted.join(", ") || "none"}.`,
    )
    .join("\n") ||
    "No errors on this synthetic topic-label test. This does not establish real-world accuracy.");
report +=
  "\n\n## Interpretation and limitations\n\nTopic labels indicate mentions, including negated mentions; they do not measure request polarity, feature extraction, fulfillment, translation, or safety. The report includes every failure in evaluation.json. Split-specific sentence frames AND topic phrase pools prevent exact template reuse across splits. Shared topic words and a shared composition grammar remain: the data is small, synthetic, repetitive, and not an independent field evaluation. Slots and labels are balanced through deterministic masks, not representative traffic. Unsupported examples are intentionally included but not an exhaustive language detector. The implementation uses conservative rules and operator review, with separate behavioral tests. No held-out-driven retraining or baseline tuning is performed.\n";
fs.writeFileSync("docs/EVALUATION.md", report);
console.log(
  JSON.stringify({
    modelBytes: result.modelBytes,
    classifier: result.classifier.microF1,
    baseline: result.keywordBaseline.microF1,
    failures: result.classifier.failures.length,
  }),
);
