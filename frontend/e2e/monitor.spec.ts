import { expect, test } from "@playwright/test";

test("research workflow: filtering, selection, baseline, pins, export, refresh, methodology", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".ranking-table tbody tr")).toHaveCount(45);
  await expect(page.locator(".price-chart .recharts-line")).toHaveCount(2);
  await page.getByRole("button", { name: "Auto refresh on" }).click();
  await page.getByLabel("Currency filter").selectOption("EUR");
  await expect(page.locator(".ranking-table tbody tr")).toHaveCount(9);
  await page.getByLabel("Search currency pairs").fill("EUR/USD");
  await expect(page.locator(".ranking-table tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Inspect EUR/USD", exact: true })
    .click();
  await expect(page.getByLabel("EUR/USD pair detail")).toBeVisible();
  await page.getByRole("button", { name: "Pin EUR/USD", exact: true }).click();
  await page.getByRole("button", { name: "Watchlist 1", exact: true }).click();
  await expect(page.locator(".ranking-table tbody tr")).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Unpin EUR/USD", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Baseline lookback").selectOption("63");
  await expect(page.locator(".chart-subtitle")).toContainText(
    "63-session baseline",
  );
  await expect(page.locator(".price-chart .recharts-line")).toHaveCount(2);
  await page.getByRole("button", { name: "1Y", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "1Y", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Z-SCORE" }).click();
  const scores = await page.locator(".score-value").allTextContents();
  const numeric = scores
    .filter((s) => s !== "—")
    .map((s) => Math.abs(Number(s)));
  expect(numeric[0]).toBeLessThanOrEqual(numeric[1]);
  const downloadEvent = page.waitForEvent("download");
  await page.getByLabel("Export filtered ranking as CSV").click();
  expect((await downloadEvent).suggestedFilename()).toMatch(
    /^g10-rv-.*-63.csv$/,
  );
  await page.getByRole("button", { name: "Methodology", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Refresh data", exact: true }),
  ).toBeEnabled();
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/refresh") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Refresh data", exact: true }).click();
  expect((await response).status()).toBe(202);
  expect(errors).toEqual([]);
});

test("mobile keeps horizontal scrolling within the ranking table", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".ranking-table tbody tr")).toHaveCount(45);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".table-scroll")
      .evaluate((el) => el.scrollWidth > el.clientWidth),
  ).toBe(true);
  await page.getByRole("button", { name: "Methodology", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Back to monitor" }).click();
});

test("network outage gives an explicit retry state and no invented quotes", async ({
  page,
}) => {
  await page.route("**/api/monitor*", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ranking-table tbody tr")).toHaveCount(0);
});
