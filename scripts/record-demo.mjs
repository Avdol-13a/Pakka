// Records real UI interactions. Captions are a video overlay, not part of the app.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
fs.mkdirSync("demo/raw", { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: "demo/raw", size: { width: 1280, height: 800 } },
});
const page = await context.newPage();
await page.goto("http://127.0.0.1:4173");
await page.getByText("Offline ready", { exact: true }).waitFor();
const start = Date.now();
const at = async (seconds) => {
  const wait = seconds * 1000 - (Date.now() - start);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
};
const caption = async (text) =>
  page.evaluate((text) => {
    let el = document.getElementById("video-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "video-caption";
      el.style.cssText =
        "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:9999;background:#174d38;color:#fffdf4;border:1px solid #8baf89;padding:13px 24px;border-radius:12px;font:600 18px Arial;box-shadow:0 6px 22px #0002;pointer-events:none;white-space:nowrap";
      document.body.append(el);
    }
    el.textContent = text;
  }, text);
await caption("PAKKA · A clear promise before the visit");
await at(5);
await page.getByLabel("Farm name").scrollIntoViewIfNeeded();
await caption("01 · Save the facts your farm can stand behind");
await at(8);
await page
  .getByLabel("Guest transport", { exact: true })
  .scrollIntoViewIfNeeded();
await at(11);
await page.getByRole("button", { name: "Save offering" }).click();
await at(13);
await page.getByRole("button", { name: /02.*Check Request/ }).click();
await page
  .getByLabel("What did your guest ask for?")
  .fill(
    "We are 16 guests. Lunch please. Transport please. Can we arrive at 5?",
  );
await caption("02 · Paste an English guest request");
await at(17);
await page.getByRole("button", { name: "Check against my offering" }).click();
await page.locator(".results-header").scrollIntoViewIfNeeded();
await caption("Original sentence + saved fact + a clear comparison");
await at(21);
await page
  .getByTestId("interpretation")
  .filter({
    has: page.getByRole("heading", { name: "Guest transport", exact: true }),
  })
  .scrollIntoViewIfNeeded();
await caption("Unavailable transport stays visible");
await at(25);
const time = page
  .getByTestId("interpretation")
  .filter({ has: page.getByRole("heading", { name: /^Arrival at / }) });
await time.scrollIntoViewIfNeeded();
await caption("Unclear time? The host corrects the interpretation.");
await time.getByText("Correct this interpretation").click();
await at(28);
await time.getByLabel("Arrival time", { exact: true }).fill("10:00");
await time.getByLabel("Guest intent").selectOption("wanted");
await time.getByLabel("Still ambiguous").uncheck();
await at(31);
for (const button of await page.locator(".review-button").all())
  await button.click();
await page.getByRole("button", { name: "Approve & create receipt" }).click();
await caption("03 · Host-approved English + Urdu receipt");
await at(36);
await page.locator(".pending").first().scrollIntoViewIfNeeded();
await caption("Inclusions, exclusions, questions · Guest agreement pending");
await at(41);
await context.setOffline(true);
await page.reload();
await page.getByText("Working offline", { exact: true }).waitFor();
await caption("Network disabled · Reloaded successfully");
await at(44);
await page.getByRole("button", { name: /03.*Promise Receipt/ }).click();
await caption("The approved receipt is still here, completely offline");
await at(48);
await page.getByRole("button", { name: "Switch to Urdu" }).click();
await caption("Local classifier + transparent rules + operator approval");
await at(52.5);
await caption("pakka. · Small hosts. Clear expectations.");
await at(55);
const video = page.video();
await context.close();
const raw = await video.path();
await browser.close();
// Fixed 55s output, including tail padding. Never exceed the user's 60s limit.
const r = spawnSync(
  ffmpeg,
  [
    "-y",
    "-i",
    raw,
    "-i",
    "demo/narration.mp3",
    "-filter_complex",
    "[0:v]tpad=stop_mode=clone:stop_duration=3[v];[1:a]apad[a]",
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-t",
    "55",
    "-r",
    "25",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "demo/pakka-demo.mp4",
  ],
  { encoding: "utf8" },
);
if (r.status !== 0) throw Error(r.stderr);
console.log("Created demo/pakka-demo.mp4 (55 seconds).");
const probe = spawnSync(
  ffmpeg,
  ["-i", "demo/pakka-demo.mp4", "-f", "null", "-"],
  { encoding: "utf8" },
);
const match = probe.stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
if (!match) throw Error("Could not measure video duration");
const seconds =
  Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
if (seconds > 60) throw Error("Demo exceeds 60 seconds");
fs.writeFileSync(
  "demo/metadata.json",
  JSON.stringify(
    {
      durationSeconds: seconds,
      bytes: fs.statSync("demo/pakka-demo.mp4").size,
      narrationProvider: "ElevenLabs",
      voice: "Bella - Professional, Bright, Warm",
      model: "eleven_multilingual_v2",
      narrationSeconds: 52.19845804988662,
      footage: "Actual local Pakka production build, automated UI interactions",
      captionOverlay: true,
    },
    null,
    2,
  ) + "\n",
);
