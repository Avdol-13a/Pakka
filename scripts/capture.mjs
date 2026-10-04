import { chromium } from "@playwright/test";
import fs from "node:fs";
fs.mkdirSync("docs/screenshots", { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1360, height: 1000 },
});
const page = await context.newPage();
await page.goto("http://127.0.0.1:4173");
await page.getByText("Offline ready", { exact: true }).waitFor();
await page.screenshot({
  path: "docs/screenshots/offering-desktop.png",
  fullPage: true,
});
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: "docs/screenshots/offering-mobile.png",
  fullPage: true,
});
await page.getByRole("button", { name: /02.*Check Request/ }).click();
await page.getByRole("button", { name: "A few mismatches" }).click();
await page.getByRole("button", { name: "Check against my offering" }).click();
await page.screenshot({
  path: "docs/screenshots/check-mobile.png",
  fullPage: true,
});
for (const b of await page.locator(".review-button").all()) await b.click();
await page.getByRole("button", { name: "Approve & create receipt" }).click();
await page.screenshot({
  path: "docs/screenshots/receipt-mobile.png",
  fullPage: true,
});
await page.pdf({
  path: "docs/sample-receipt.pdf",
  format: "A4",
  printBackground: true,
});
await page.setViewportSize({ width: 1360, height: 1000 });
await page.screenshot({
  path: "docs/screenshots/receipt-desktop.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Switch to Urdu" }).click();
await page.getByRole("button", { name: /01/ }).click();
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: "docs/screenshots/offering-urdu.png",
  fullPage: true,
});
await browser.close();
console.log("Captured desktop/mobile, Urdu and receipt PDF.");
