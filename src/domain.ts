export type Lang = "en" | "ur";
export type Topic =
  | "meals"
  | "transport"
  | "timing"
  | "group"
  | "activities"
  | "other";
export type Status = "supported" | "unavailable" | "clarify";
export type Polarity = "wanted" | "notWanted" | "uncertain";
export interface Feature {
  id: string;
  en: string;
  ur: string;
  topic: "meals" | "transport" | "activities";
}
export const catalog: Feature[] = [
  { id: "tea", en: "Tea", ur: "چائے", topic: "meals" },
  { id: "lunch", en: "Lunch", ur: "دوپہر کا کھانا", topic: "meals" },
  { id: "breakfast", en: "Breakfast", ur: "ناشتہ", topic: "meals" },
  { id: "dinner", en: "Dinner", ur: "رات کا کھانا", topic: "meals" },
  {
    id: "transport",
    en: "Guest transport",
    ur: "مہمانوں کی آمد و رفت",
    topic: "transport",
  },
  {
    id: "walk",
    en: "Guided farm walk",
    ur: "رہنما کے ساتھ فارم کی سیر",
    topic: "activities",
  },
  {
    id: "picking",
    en: "Vegetable picking",
    ur: "سبزیاں چننا",
    topic: "activities",
  },
  { id: "horses", en: "Horse riding", ur: "گھڑ سواری", topic: "activities" },
  {
    id: "animals",
    en: "Animal feeding",
    ur: "جانوروں کو چارہ کھلانا",
    topic: "activities",
  },
];
export interface Offering {
  name: string;
  opens: string;
  closes: string;
  capacity: number;
  duration: number;
  available: string[];
  custom: Feature[];
  revision: number;
}
export const defaultOffering: Offering = {
  name: "Pakka Demo Farm",
  opens: "09:00",
  closes: "17:00",
  capacity: 12,
  duration: 120,
  available: ["tea", "lunch", "walk", "picking"],
  custom: [],
  revision: 1,
};
export interface Interpretation {
  id: string;
  source: string;
  topic: Topic;
  feature: string;
  kind: "feature" | "arrival" | "duration" | "count" | "unknown";
  value: string;
  polarity: Polarity;
  ambiguous: boolean;
  reviewed: boolean;
  dismissed: boolean;
  corrected: boolean;
  confidence?: number;
}
export interface Approval {
  offering: Offering;
  items: Interpretation[];
  request: string;
  approvedAt: string;
}
export interface AppState {
  version: 1;
  lang: Lang;
  offering: Offering;
  request: string;
  analyzedRequest: string;
  items: Interpretation[];
  approval: Approval | null;
}
export interface Model {
  version: number;
  labels: Topic[];
  vocabulary: string[];
  weights: number[][];
  bias: number[];
  thresholds: number[];
}
export const initialState: AppState = {
  version: 1,
  lang: "en",
  offering: defaultOffering,
  request: "",
  analyzedRequest: "",
  items: [],
  approval: null,
};
export const demos = [
  "We are 6 guests. We will arrive at 10 am. We would like lunch and a guided farm walk.",
  "We are 16 guests. We will arrive at 4 pm. Please include lunch and transport. We want horse riding.",
  "We might be a few friends. We do not need lunch unless the children are hungry. Can we arrive around 5? Is wheelchair access available?",
];
export const featuresFor = (o: Offering) => [...catalog, ...o.custom];
export function validOffering(o: Offering): boolean {
  return (
    !!o &&
    typeof o.name === "string" &&
    o.name.trim().length > 0 &&
    o.name.length <= 100 &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(o.opens) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(o.closes) &&
    o.opens < o.closes &&
    Number.isInteger(o.capacity) &&
    o.capacity > 0 &&
    o.capacity <= 500 &&
    Number.isInteger(o.duration) &&
    o.duration >= 15 &&
    o.duration <= minutes(o.closes) - minutes(o.opens) &&
    Array.isArray(o.available) &&
    o.available.every((x) => typeof x === "string") &&
    Array.isArray(o.custom) &&
    o.custom.every(
      (f) =>
        f &&
        typeof f.id === "string" &&
        f.id.startsWith("custom-") &&
        typeof f.en === "string" &&
        !!f.en.trim() &&
        f.en.length <= 80 &&
        typeof f.ur === "string" &&
        !!f.ur.trim() &&
        f.ur.length <= 80 &&
        f.topic === "activities",
    ) &&
    new Set(o.custom.map((f) => f.id)).size === o.custom.length &&
    o.available.every((id) =>
      [...catalog, ...o.custom].some((f) => f.id === id),
    )
  );
}
export const minutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
export function tokenize(text: string) {
  const words =
    text
      .toLowerCase()
      .replace(/[’']/g, "")
      .match(/[a-z]+|\d+/g) || [];
  return [
    ...new Set([...words, ...words.slice(1).map((w, i) => words[i] + " " + w)]),
  ];
}
export function scores(text: string, model: Model) {
  const seen = new Set(tokenize(text));
  const indices = model.vocabulary.flatMap((v, i) => (seen.has(v) ? [i] : []));
  return model.labels.map((topic, k) => ({
    topic,
    score:
      1 /
      (1 +
        Math.exp(
          -Math.max(
            -30,
            Math.min(
              30,
              model.bias[k] +
                indices.reduce((s, i) => s + model.weights[k][i], 0),
            ),
          ),
        )),
    threshold: model.thresholds[k],
  }));
}
const patterns: Record<string, RegExp> = {
  tea: /\btea\b/i,
  lunch: /\blunch\b/i,
  breakfast: /\bbreakfast\b/i,
  dinner: /\b(?:dinner|supper)\b/i,
  transport:
    /\b(?:transport|pickup|pick[- ]?up|picked up|shuttle|taxi|bus|car ride|ride back)\b/i,
  walk: /\b(?:(?:guided )?farm walk|walking tour|walk around the farm|walking around the farm|farm tour)\b/i,
  picking:
    /\b(?:vegetable picking|picking (?:fresh )?vegetables|harvesting vegetables)\b/i,
  horses: /\b(?:horse riding|riding horses|horse ride)\b/i,
  animals:
    /\b(?:animal feeding|feeding (?:the )?animals|feed (?:the )?animals)\b/i,
};
// A deliberately small English grammar. Uncovered words become an explicit review item.
const grammar = new Set(
  "we i our us my the a an are is will would like want wants need needs please can could you include provide arrange for everyone and with at to from of in on have be visit arrive arrival guests guest people person visitors visitor adults adult children child kids kid group party total duration hours hour minutes minute am pm do not dont no without request farm guided walk lunch tea breakfast dinner supper transport pickup pick up picked shuttle taxi bus car ride back vegetable picking fresh vegetables harvesting horse riding horses animals animal feeding feed around there hello thanks thank".split(
    " ",
  ),
);
export function analyze(
  text: string,
  o: Offering,
  model: Model,
): Interpretation[] {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const result: Interpretation[] = [];
  let id = 0;
  for (const source of sentences) {
    const s = source.toLowerCase().replace(/[’']/g, "");
    const predictions = scores(source, model);
    const push = (
      topic: Topic,
      kind: Interpretation["kind"],
      feature = "",
      value = "",
      ambiguous = false,
      polarity: Polarity = "wanted",
    ) =>
      result.push({
        id: "i" + ++id,
        source,
        topic,
        kind,
        feature,
        value,
        ambiguous,
        polarity,
        reviewed: false,
        dismissed: false,
        corrected: false,
        confidence: predictions.find((p) => p.topic === topic)?.score,
      });
    if (/[^\x00-\x7F“”’–—]/.test(source)) {
      push("other", "unknown", "", "", true, "uncertain");
      continue;
    }
    const uncertain =
      /\b(maybe|might|perhaps|unless|if|either|or|but|around|about|approximately|few|several|some|roughly|after|before|between|except|only|allergic|allergy|free|without|never|cannot|cant|wont|isnt|arent|doesnt|didnt|wasnt|not|least|most|over|under|more|less|plus|couple)\b/.test(
        s,
      ) || /\d+\.\d+|\d\s*[-–]\s*\d/.test(s);
    const simpleNegation =
      /^(?:we |i |please )?(?:do not|dont|no need (?:for|to include)|no|without)\b/.test(
        s,
      ) &&
      !/\b(unless|if|but|or|except|only|and)\b/.test(s) &&
      (
        s.match(
          /\b(no|not|dont|without|never|cannot|cant|wont|isnt|arent|doesnt|didnt|wasnt)\b/g,
        ) || []
      ).length === 1;
    const negation =
      /\b(no|not|dont|without|never|cannot|cant|wont|isnt|arent|doesnt|didnt|wasnt)\b/.test(
        s,
      );
    const polarity: Polarity = simpleNegation
      ? "notWanted"
      : uncertain || negation
        ? "uncertain"
        : "wanted";
    const start = result.length;
    let remainder = s;
    for (const f of featuresFor(o)) {
      const p = patterns[f.id];
      const matched = p ? p.test(s) : s.includes(f.en.toLowerCase());
      if (matched) {
        push(f.topic, "feature", f.id, "", polarity === "uncertain", polarity);
        remainder = p
          ? remainder.replace(p, " ")
          : remainder.replace(f.en.toLowerCase(), " ");
      }
    }
    const counts = [
      ...s.matchAll(
        /\b(\d+)\s+(guests?|people|persons?|visitors?|adults?|children|kids?)\b/g,
      ),
    ];
    const groupMentions =
      /\b(group|party|people|persons?|guests?|visitors?|adults?|children|kids?|friends)\b/.test(
        s,
      );
    if (counts.length || groupMentions) {
      const complete =
        counts.length === 1 &&
        /^(guests?|people|persons?|visitors?)$/.test(counts[0][2]) &&
        !/\b(babies|baby|grownups|infants|teenagers)\b/.test(s);
      push(
        "group",
        "count",
        "",
        complete ? counts[0][1] : "",
        !complete || uncertain || negation,
        polarity,
      );
    }
    const times = [
      ...s.matchAll(
        /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b([01]?\d|2[0-3]):([0-5]\d)\b/g,
      ),
    ];
    const durations = [...s.matchAll(/\b(\d+)\s*(hours?|minutes?)\b/g)];
    if (durations.length) {
      const d = durations[0];
      push(
        "timing",
        "duration",
        "",
        String(Number(d[1]) * (d[2].startsWith("hour") ? 60 : 1)),
        durations.length !== 1 || uncertain || negation,
        polarity,
      );
    }
    if (times.length) {
      const t = times[0];
      const valid =
        t[4] !== undefined ||
        (Number(t[1]) >= 1 && Number(t[1]) <= 12 && Number(t[2] || 0) < 60);
      const h =
        t[4] !== undefined
          ? Number(t[4])
          : (Number(t[1]) % 12) + (t[3] === "pm" ? 12 : 0);
      const m = t[5] || t[2] || "00";
      push(
        "timing",
        "arrival",
        "",
        valid ? String(h).padStart(2, "0") + ":" + m : "",
        !valid ||
          times.length !== 1 ||
          uncertain ||
          negation ||
          /\b(depart|departure|leave|leaving|until|by|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(
            s,
          ),
        polarity,
      );
    } else if (
      /\b(arriv\w*|time|morning|evening|noon|night|late|early|at\s+\d)\b/.test(
        s,
      )
    )
      push("timing", "arrival", "", "", true, "uncertain");
    for (const p of predictions)
      if (
        p.score >= p.threshold &&
        !result.slice(start).some((i) => i.topic === p.topic)
      )
        push(p.topic, "unknown", "", "", true, "uncertain");
    const uncovered = (remainder.match(/[a-z]+/g) || []).filter(
      (w) => !grammar.has(w),
    );
    if (uncovered.length || result.length === start)
      push("other", "unknown", "", "", true, "uncertain");
  }
  return result;
}
export interface Comparison {
  status: Status;
  reason:
    | "unknown"
    | "ambiguous"
    | "excluded"
    | "offered"
    | "notOffered"
    | "capacity"
    | "tooMany"
    | "hours"
    | "outsideHours"
    | "duration"
    | "tooLong"
    | "conflict";
}
export function compare(
  i: Interpretation,
  o: Offering,
  all: Interpretation[] = [],
): Comparison {
  const clarify = (reason: Comparison["reason"] = "ambiguous"): Comparison => ({
    status: "clarify",
    reason,
  });
  if (i.kind === "unknown" || i.topic === "other") return clarify("unknown");
  if (i.ambiguous || i.polarity === "uncertain") return clarify();
  const peers = all.filter(
    (x) =>
      !x.dismissed &&
      !x.ambiguous &&
      x.polarity !== "uncertain" &&
      x.kind === i.kind &&
      (i.kind !== "feature" || x.feature === i.feature),
  );
  if (peers.some((x) => x.value !== i.value || x.polarity !== i.polarity))
    return clarify("conflict");
  if (i.polarity === "notWanted")
    return { status: "supported", reason: "excluded" };
  if (i.kind === "feature") {
    if (!featuresFor(o).some((f) => f.id === i.feature))
      return clarify("unknown");
    return o.available.includes(i.feature)
      ? { status: "supported", reason: "offered" }
      : { status: "unavailable", reason: "notOffered" };
  }
  const n = Number(i.value);
  if (i.kind === "count") {
    if (!Number.isInteger(n) || n <= 0) return clarify();
    return n <= o.capacity
      ? { status: "supported", reason: "capacity" }
      : { status: "unavailable", reason: "tooMany" };
  }
  if (i.kind === "duration") {
    if (!Number.isInteger(n) || n <= 0) return clarify();
    return n === o.duration
      ? { status: "supported", reason: "duration" }
      : { status: "unavailable", reason: "tooLong" };
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(i.value)) return clarify();
  const arrival = minutes(i.value);
  return arrival >= minutes(o.opens) &&
    arrival + o.duration <= minutes(o.closes)
    ? { status: "supported", reason: "hours" }
    : { status: "unavailable", reason: "outsideHours" };
}
export function itemName(i: Interpretation, o: Offering, l: Lang) {
  if (i.kind === "feature")
    return (
      featuresFor(o).find((f) => f.id === i.feature)?.[l] ||
      (l === "en" ? "Unspecified feature" : "غیر متعین سہولت")
    );
  if (i.kind === "count")
    return l === "en" ? `${i.value || "?"} guests` : `${i.value || "؟"} مہمان`;
  if (i.kind === "duration")
    return l === "en"
      ? `${i.value || "?"} minute visit`
      : `${i.value || "؟"} منٹ کا دورہ`;
  if (i.kind === "arrival")
    return l === "en"
      ? `Arrival at ${i.value || "?"}`
      : `آمد کا وقت ${i.value || "؟"}`;
  return l === "en" ? "Unresolved detail" : "غیر واضح تفصیل";
}
export function canApprove(s: AppState) {
  return (
    validOffering(s.offering) &&
    !!s.request.trim() &&
    s.request === s.analyzedRequest &&
    s.items.length > 0 &&
    s.items.every((i) => i.reviewed)
  );
}
export function approve(s: AppState): Approval {
  if (!canApprove(s)) throw Error("Review required");
  return structuredClone({
    offering: s.offering,
    items: s.items,
    request: s.request,
    approvedAt: new Date().toISOString(),
  });
}
export function receipt(a: Approval, l: Lang) {
  const inclusions: string[] = [],
    exclusions: string[] = [],
    questions: string[] = [];
  for (const i of a.items) {
    if (i.dismissed) continue;
    const c = compare(i, a.offering, a.items);
    const name = itemName(i, a.offering, l);
    if (c.status === "clarify") {
      questions.push(
        l === "en"
          ? `Please clarify: “${i.source}”`
          : `براہ کرم وضاحت کریں: “\u2066${i.source}\u2069”`,
      );
    } else if (i.polarity === "notWanted")
      exclusions.push(
        l === "en"
          ? `${name} — not requested.`
          : `${name} — درخواست میں شامل نہیں۔`,
      );
    else if (c.status === "unavailable")
      exclusions.push(
        l === "en"
          ? `${name} — unavailable as requested.`
          : `${name} — مطلوبہ صورت میں دستیاب نہیں۔`,
      );
    else inclusions.push(name);
  }
  const unique = (x: string[]) => [...new Set(x)];
  return {
    inclusions: unique(inclusions),
    exclusions: unique(exclusions),
    questions: unique(questions),
  };
}
export function receiptText(a: Approval, l: Lang) {
  const r = receipt(a, l),
    o = a.offering;
  const labels =
    l === "en"
      ? [
          "PROMISE RECEIPT",
          "Inclusions",
          "Exclusions",
          "Unresolved questions",
          "None recorded.",
          "Guest agreement pending.",
          "Operator approved. This is not a booking confirmation.",
        ]
      : [
          "وعدے کی رسید",
          "شامل سہولیات",
          "شامل نہیں",
          "غیر حل شدہ سوالات",
          "کوئی درج نہیں۔",
          "مہمان کی رضامندی کا انتظار ہے۔",
          "میزبان نے منظور کیا۔ یہ بکنگ کی تصدیق نہیں ہے۔",
        ];
  return `${labels[0]}\n${o.name}\n${l === "en" ? `Offering: ${o.opens}–${o.closes} daily · ${o.duration} minutes · maximum ${o.capacity} guests` : `فارم کے اوقات: ${o.opens}–${o.closes} روزانہ · ${o.duration} منٹ · زیادہ سے زیادہ ${o.capacity} مہمان`}\n\n${[r.inclusions, r.exclusions, r.questions].map((items, k) => labels[k + 1] + "\n" + (items.length ? items.map((x) => "• " + x).join("\n") : labels[4])).join("\n\n")}\n\n${labels[5]}\n${labels[6]}`;
}
