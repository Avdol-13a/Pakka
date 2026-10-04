import { describe, it, expect } from "vitest";
import fs from "node:fs";
import {
  analyze,
  approve,
  canApprove,
  compare,
  defaultOffering,
  initialState,
  receipt,
  receiptText,
  scores,
  validOffering,
  type Model,
} from "../src/domain";
import { decode } from "../src/storage";
const model = JSON.parse(fs.readFileSync("public/model.json", "utf8")) as Model;
const run = (s: string) => analyze(s, defaultOffering, model);
const named = (s: string, kind: string) => run(s).find((i) => i.kind === kind)!;
describe("explicit request parsing and comparisons", () => {
  it("supports explicit counts and rejects excess capacity", () => {
    expect(
      compare(named("We are 6 guests.", "count"), defaultOffering).status,
    ).toBe("supported");
    expect(
      compare(named("We are 16 guests.", "count"), defaultOffering).status,
    ).toBe("unavailable");
  });
  it("arrival includes full visit duration", () => {
    expect(named("We arrive at 10 am.", "arrival").value).toBe("10:00");
    expect(
      compare(named("We arrive at 4 pm.", "arrival"), defaultOffering).status,
    ).toBe("unavailable");
    expect(
      compare(named("We arrive at 15:00.", "arrival"), defaultOffering).status,
    ).toBe("supported");
  });
  it("requires exact offered duration", () => {
    expect(
      compare(named("A 2 hour visit.", "duration"), defaultOffering).status,
    ).toBe("supported");
    expect(
      compare(named("A 3 hour visit.", "duration"), defaultOffering).status,
    ).toBe("unavailable");
  });
  it.each([
    "Arrive at 5.",
    "Arrive at 13 pm.",
    "Arrive at 10:75 am.",
    "We might arrive at 10 am.",
    "Arrive between 9 am and 11 am.",
  ])("clarifies uncertain time: %s", (text) => {
    expect(compare(named(text, "arrival"), defaultOffering).status).toBe(
      "clarify",
    );
  });
  it.each([
    "A few friends.",
    "6 adults and 3 children.",
    "We are 6 or 7 guests.",
  ])("clarifies incomplete/alternative count: %s", (text) => {
    expect(compare(named(text, "count"), defaultOffering).status).toBe(
      "clarify",
    );
  });
  it("simple negation is an exclusion; conditional negation is unresolved", () => {
    const a = named("We do not need lunch.", "feature");
    expect(a.polarity).toBe("notWanted");
    expect(compare(a, defaultOffering).reason).toBe("excluded");
    expect(
      compare(
        named("We do not need lunch unless children are hungry.", "feature"),
        defaultOffering,
      ).status,
    ).toBe("clarify");
  });
  it.each([
    "We cannot have lunch.",
    "Lunch without nuts.",
    "Not only lunch but tea.",
    "We never want tea.",
  ])("does not promise uncertain negative/modifier: %s", (text) => {
    expect(
      run(text)
        .filter((i) => i.kind === "feature")
        .every((i) => compare(i, defaultOffering).status === "clarify"),
    ).toBe(true);
  });
  it("preserves unsupported details even alongside recognized topics", () => {
    const items = run("Lunch and wheelchair access please.");
    expect(items.some((i) => i.feature === "lunch")).toBe(true);
    expect(
      items.some((i) => i.topic === "other" && i.source.includes("wheelchair")),
    ).toBe(true);
  });
  it("keeps non-English text unresolved", () => {
    expect(
      run("ہمیں کھانا چاہیے۔").every(
        (i) => compare(i, defaultOffering).status === "clarify",
      ),
    ).toBe(true);
  });
  it("detects conflicting values across sentences", () => {
    const items = run("We are 6 guests. We are 18 guests.");
    expect(
      items
        .filter((i) => i.kind === "count")
        .every((i) => compare(i, defaultOffering, items).reason === "conflict"),
    ).toBe(true);
  });
  it("compares against changed host facts", () => {
    const i = named("Transport please.", "feature");
    expect(compare(i, defaultOffering).status).toBe("unavailable");
    expect(
      compare(i, {
        ...defaultOffering,
        available: [...defaultOffering.available, "transport"],
      }).status,
    ).toBe("supported");
  });
  it.each([
    "We are at least 5 guests.",
    "We are 6-15 guests.",
    "We are 5 guests and 4 babies.",
  ])("retains ambiguous group qualifications: %s", (text) => {
    expect(compare(named(text, "count"), defaultOffering).status).toBe(
      "clarify",
    );
  });
  it("preserves decimal source text and double negation as unclear", () => {
    const items = run("A 2.5 hour visit.");
    expect(items.every((i) => i.source === "A 2.5 hour visit.")).toBe(true);
    expect(
      compare(items.find((i) => i.kind === "duration")!, defaultOffering)
        .status,
    ).toBe("clarify");
    expect(
      compare(named("We dont need no lunch.", "feature"), defaultOffering)
        .status,
    ).toBe("clarify");
  });
});
describe("approval and receipts", () => {
  const state = {
    ...structuredClone(initialState),
    request: "Lunch please. Transport please. Wheelchair access?",
    analyzedRequest: "Lunch please. Transport please. Wheelchair access?",
    items: run("Lunch please. Transport please. Wheelchair access?").map(
      (i) => ({ ...i, reviewed: true }),
    ),
  };
  it("requires review and current request", () => {
    expect(canApprove(state)).toBe(true);
    expect(canApprove({ ...state, request: "Changed" })).toBe(false);
    expect(() =>
      approve({
        ...state,
        items: state.items.map((i) => ({ ...i, reviewed: false })),
      }),
    ).toThrow();
  });
  it("includes only approved requested features and retains questions", () => {
    const a = approve(state);
    const r = receipt(a, "en");
    expect(r.inclusions).toContain("Lunch");
    expect(r.inclusions).not.toContain("Tea");
    expect(r.exclusions).toContain(
      "Guest transport — unavailable as requested.",
    );
    expect(r.questions.some((q) => q.includes("Wheelchair"))).toBe(true);
    expect(receiptText(a, "ur")).toContain("مہمان کی رضامندی کا انتظار ہے۔");
    expect(receiptText(a, "en")).toContain("Guest agreement pending.");
  });
  it("snapshots cannot change with mutable live facts", () => {
    const s = structuredClone(state);
    const a = approve(s);
    s.offering.available = [];
    expect(receipt(a, "en").inclusions).toContain("Lunch");
  });
  it("revalidates persisted approval and malformed data", () => {
    const s = { ...state, approval: approve(state) };
    expect(decode(JSON.stringify(s)).approval).not.toBeNull();
    s.offering.capacity = 3;
    expect(decode(JSON.stringify(s)).approval).toBeNull();
    expect(() => decode("{")).toThrow();
    expect(() => decode('{"version":99}')).toThrow();
  });
  it("rejects invalid facts", () => {
    expect(validOffering({ ...defaultOffering, closes: "08:00" })).toBe(false);
    expect(validOffering({ ...defaultOffering, capacity: 0 })).toBe(false);
    expect(validOffering({ ...defaultOffering, duration: 900 })).toBe(false);
  });
});
describe("model and provenance", () => {
  it("bundles an actual small linear model with valid output", () => {
    expect(fs.statSync("public/model.json").size).toBeLessThan(2_000_000);
    expect(scores("lunch and a pickup", model)).toHaveLength(5);
    expect(
      scores("tea", model).every((p) => p.score >= 0 && p.score <= 1),
    ).toBe(true);
  });
  it("uses disjoint families and examples with reproducible evaluation", () => {
    const sets = ["train", "validation", "test"].map((x) =>
      JSON.parse(fs.readFileSync(`data/${x}.json`, "utf8")),
    );
    expect(sets.map((x) => x.length)).toEqual([600, 150, 150]);
    const families = sets.map(
      (s) => new Set(s.map((r: { family: string }) => r.family)),
    );
    expect(
      [...families[0]].some((f) => families[1].has(f) || families[2].has(f)),
    ).toBe(false);
    expect([...families[1]].some((f) => families[2].has(f))).toBe(false);
    expect(new Set(sets.flat().map((r) => r.text)).size).toBe(900);
    const report = JSON.parse(fs.readFileSync("docs/evaluation.json", "utf8"));
    expect(report.modelBytes).toBe(fs.statSync("public/model.json").size);
    let tp = 0,
      fp = 0,
      fn = 0;
    for (const r of sets[2])
      scores(r.text, model).forEach((p) => {
        const a = p.score >= p.threshold,
          b = r.labels.includes(p.topic);
        tp += +(a && b);
        fp += +(a && !b);
        fn += +(!a && b);
      });
    expect((2 * tp) / (2 * tp + fp + fn)).toBeCloseTo(
      report.classifier.microF1,
      12,
    );
  });
});
