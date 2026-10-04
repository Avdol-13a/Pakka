import {
  initialState,
  validOffering,
  canApprove,
  type AppState,
  type Interpretation,
} from "./domain";
export const STORAGE_KEY = "pakka.v1";
function validItem(i: Interpretation) {
  return (
    i &&
    typeof i.id === "string" &&
    typeof i.source === "string" &&
    typeof i.value === "string" &&
    typeof i.feature === "string" &&
    ["meals", "transport", "timing", "group", "activities", "other"].includes(
      i.topic,
    ) &&
    ["feature", "arrival", "duration", "count", "unknown"].includes(i.kind) &&
    ["wanted", "notWanted", "uncertain"].includes(i.polarity) &&
    ["ambiguous", "reviewed", "dismissed", "corrected"].every(
      (k) => typeof i[k as keyof Interpretation] === "boolean",
    )
  );
}
export function decode(raw: string): AppState {
  const s = JSON.parse(raw) as AppState;
  if (
    s.version !== 1 ||
    !["en", "ur"].includes(s.lang) ||
    !validOffering(s.offering) ||
    typeof s.request !== "string" ||
    typeof s.analyzedRequest !== "string" ||
    !Array.isArray(s.items) ||
    !s.items.every(validItem)
  )
    throw Error("Invalid saved state");
  // Revalidate snapshots instead of trusting persisted approval flags.
  if (
    s.approval &&
    (!canApprove(s) ||
      JSON.stringify(s.approval.offering) !== JSON.stringify(s.offering) ||
      JSON.stringify(s.approval.items) !== JSON.stringify(s.items) ||
      s.approval.request !== s.request ||
      typeof s.approval.approvedAt !== "string")
  )
    s.approval = null;
  return s;
}
export function loadState(): { state: AppState; error: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return {
      state: raw ? decode(raw) : structuredClone(initialState),
      error: false,
    };
  } catch {
    return { state: structuredClone(initialState), error: true };
  }
}
