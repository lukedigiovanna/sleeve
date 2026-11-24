import { test, expect } from "@playwright/test";

test("profile charts, grouping, and return navigation", async ({ page }) => {
  await page.goto("/");
  await page.locator("#auth-demo").click();
  await page.locator("#library-query").fill("a");
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page).toHaveTitle("Profile — Sleeve");
  await expect(page.locator(".main-nav [aria-current]")).toHaveCount(0);
  await expect(page.locator(".nav-highlight")).toBeHidden();
  await expect(page.locator(".account-button")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    page
      .getByRole("region", { name: "Rating distribution" })
      .getByRole("listitem"),
  ).toHaveCount(10);
  await expect(page.getByRole("button", { name: "By decade" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page
      .getByRole("region", { name: "Release year distribution" })
      .getByRole("listitem")
      .first(),
  ).toContainText(/\d{4}s/);
  await page.getByRole("button", { name: "By year", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "By year", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "By year", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page
      .getByRole("region", { name: "Release year distribution" })
      .getByRole("listitem")
      .first(),
  ).not.toContainText(/\d{4}s/);
  const yearChart = page.getByRole("region", {
    name: "Release year distribution",
  });
  await expect(yearChart.locator(".chart-label")).toHaveCount(0);
  expect(
    await yearChart.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  const firstYear = yearChart.getByRole("listitem").first();
  await firstYear.focus();
  await expect(firstYear.locator(".chart-count")).toBeVisible();
  await expect(firstYear).toHaveAccessibleName(/\d{4}: \d+ albums/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.locator(".back-link").click();
  await expect(page.locator("#library-query")).toHaveValue("a");
  await page.goForward();
  await expect(page.locator("#page-title")).toHaveText("Profile");
  const settings = page.getByRole("button", { name: "Settings", exact: true });
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeHidden();
  await settings.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(settings).toBeFocused();
  await settings.click();
  await dialog.getByRole("button", { name: "Close settings" }).click();
  await expect(dialog).toBeHidden();
  await expect(settings).toBeFocused();
  await settings.click();
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("#auth-email")).toBeVisible();
});

test("profile direct entry has a library fallback", async ({ page }) => {
  await page.goto("/#profile");
  await page.locator("#auth-demo").click();
  await expect(page.locator("#page-title")).toHaveText("Profile");
  await expect(page.locator(".back-link")).toHaveText("Back to library");
  await page.locator(".back-link").click();
  await expect(page.locator("#library-query")).toBeVisible();
});

test("all profile charts fit narrow screens without horizontal scrolling", async ({
  page,
}) => {
  await page.goto("/#profile");
  await page.locator("#auth-demo").click();

  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 850 });
    for (const grouping of ["By decade", "By year"]) {
      await page.getByRole("button", { name: grouping, exact: true }).click();
      for (const chart of await page.locator(".profile-chart-scroll").all()) {
        expect(
          await chart.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
          ),
        ).toBe(true);
        const bars = chart.locator(".chart-bar");
        const first = await bars.first().boundingBox();
        const last = await bars.last().boundingBox();
        const bounds = await chart.boundingBox();
        expect(first!.x).toBeGreaterThanOrEqual(bounds!.x);
        expect(last!.x + last!.width).toBeLessThanOrEqual(
          bounds!.x + bounds!.width + 1,
        );
      }
    }
  }
});

test("histogram links replace filters and survive refresh and history navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#auth-demo").click();
  await page.locator("#library-query").fill("no-such-album");
  await page.getByRole("link", { name: "Profile", exact: true }).click();

  for (const chartName of [
    "Rating distribution",
    "Release year distribution",
  ]) {
    const chart = page.getByRole("region", { name: chartName });
    const bars = chart.locator("a.chart-column");
    const index = await bars.evaluateAll((elements) =>
      elements.findIndex((element) =>
        /: [1-9]\d* albums$/.test(element.getAttribute("aria-label") ?? ""),
      ),
    );
    const bar = bars.nth(index);
    const label = (await bar.getAttribute("aria-label"))!;
    const count = Number(label.match(/: (\d+) albums/)![1]);
    const href = (await bar.getAttribute("href"))!;
    await bar.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"),
    );
    await expect(page.locator("#library-query")).toHaveValue("");
    await expect(page.locator(".album-card")).toHaveCount(count);
    await page.reload();
    await page.locator("#auth-demo").click();
    await expect(page.locator("#library-query")).toBeVisible();
    await expect(page.locator(".album-card")).toHaveCount(count);
    await page.goBack();
    await expect(page.locator("#page-title")).toHaveText("Profile");
    await page.goForward();
    await expect(page.locator(".album-card")).toHaveCount(count);
    await page.goBack();
  }

  await page.getByRole("button", { name: "By year", exact: true }).click();
  const year = page
    .getByRole("region", { name: "Release year distribution" })
    .locator("a.chart-column")
    .first();
  const label = (await year.getAttribute("aria-label"))!;
  await year.click();
  await expect(page).toHaveURL(new RegExp(`year=${label.slice(0, 4)}$`));
});

test("old activity links open the profile activity section", async ({
  page,
}) => {
  await page.goto("/#activity");
  await page.locator("#auth-demo").click();
  await expect(
    page.getByRole("heading", { name: "Profile", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Activity", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".account-button")).toHaveAttribute(
    "aria-current",
    "page",
  );
});
