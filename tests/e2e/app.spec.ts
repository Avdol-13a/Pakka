import { test, expect, type Page } from "@playwright/test";
async function check(page: Page, text: string) {
  await page.getByRole("button", { name: /02.*Check Request/ }).click();
  await page.getByLabel("What did your guest ask for?").fill(text);
  await page.getByRole("button", { name: "Check against my offering" }).click();
}
async function review(page: Page) {
  for (const button of await page.locator(".review-button").all())
    await button.click();
  await page.getByRole("button", { name: "Approve & create receipt" }).click();
}
test("complete flow, bilingual receipt, copy fallback, print and mobile layout", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "My Offering." }),
  ).toBeVisible();
  await check(
    page,
    "We are 6 guests. We arrive at 10 am. Lunch please. Transport please. Wheelchair access?",
  );
  await expect(
    page.getByRole("button", { name: "Approve & create receipt" }),
  ).toBeDisabled();
  await review(page);
  await expect(
    page.getByText("Guest agreement pending.", { exact: true }),
  ).toBeVisible();
  const english = page.locator(".receipt[lang=en]");
  await expect(english).toContainText("Lunch");
  await expect(english).toContainText(
    "Guest transport — unavailable as requested.",
  );
  await expect(english).toContainText("Wheelchair access?");
  await expect(english).not.toContainText("Tea");
  await expect(page.locator(".receipt[lang=ur]")).toHaveAttribute("dir", "rtl");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "Copy receipt" }).click();
  await expect(page.locator(".copy-fallback textarea")).toContainText(
    "Guest agreement pending.",
  );
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".topbar")).toBeHidden();
  await expect(english).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("edited offering invalidates review and changes comparisons", async ({
  page,
}) => {
  await page.goto("/");
  await check(page, "Transport please.");
  await review(page);
  await page.getByRole("button", { name: /01.*My Offering/ }).click();
  await page.getByLabel("Guest transport", { exact: true }).check();
  await page.getByLabel("Maximum guests").fill("4");
  await page.getByRole("button", { name: "Save offering" }).click();
  await page.getByRole("button", { name: /03.*Promise Receipt/ }).click();
  await expect(page.getByText("A promise starts with a review.")).toBeVisible();
  await check(page, "Transport please. We are 6 guests.");
  const transport = page
    .getByTestId("interpretation")
    .filter({
      has: page.getByRole("heading", { name: "Guest transport", exact: true }),
    });
  await expect(transport.locator(".badge")).toHaveText("Supported");
  await expect(
    page
      .getByTestId("interpretation")
      .filter({
        has: page.getByRole("heading", { name: "6 guests", exact: true }),
      })
      .locator(".badge"),
  ).toHaveText("Unavailable");
  await page.reload();
  await expect(page.getByLabel("Maximum guests")).toHaveValue("4");
});
test("uncertainty and correction require fresh approval", async ({ page }) => {
  await page.goto("/");
  await check(
    page,
    "We might be a few friends. We do not need lunch unless children are hungry. Arrive at 5.",
  );
  await expect(page.locator(".summary.supported b")).toHaveText("0");
  const time = page
    .getByTestId("interpretation")
    .filter({ has: page.getByRole("heading", { name: /^Arrival at / }) });
  await time.getByText("Correct this interpretation").click();
  await time.getByLabel("Arrival time", { exact: true }).fill("10:00");
  await time.getByLabel("Guest intent").selectOption("wanted");
  await time.getByLabel("Still ambiguous").uncheck();
  await expect(time.locator(".badge")).toHaveText("Supported");
  await review(page);
  await expect(page.locator(".receipt[lang=en]")).toContainText(
    "Arrival at 10:00",
  );
  await expect(page.locator(".receipt[lang=en]")).toContainText(
    "Please clarify:",
  );
});
test("cached production app reloads and completes flow with network disabled", async ({
  page,
  context,
}) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:4173") &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
  await page.goto("/");
  await expect(page.getByText("Offline ready", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByText("Working offline", { exact: true }),
  ).toBeVisible();
  await check(page, "We are 6 guests. Lunch please.");
  await review(page);
  await expect(
    page.getByText("Guest agreement pending.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /03.*Promise Receipt/ }).click();
  await expect(
    page.getByText("Guest agreement pending.", { exact: true }),
  ).toBeVisible();
  expect(external).toEqual([]);
  await context.setOffline(false);
});
test("Urdu controls, keyboard access, and 320px layout", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByText("Skip to content")).toBeFocused();
  await page.getByRole("button", { name: "Switch to Urdu" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByLabel("فارم کا نام")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ur");
});
test("malformed storage and failed writes are surfaced", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("pakka.v1", '{"broken":');
    Object.defineProperty(Storage.prototype, "setItem", {
      value: () => {
        throw new Error("quota");
      },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Local storage");
  await page.getByRole("button", { name: "Save offering" }).click();
  await expect(page.getByText("Not saved", { exact: true })).toBeVisible();
});
