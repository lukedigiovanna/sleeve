import { test, expect } from "@playwright/test";

test("album views default to list and remember layout choices independently", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#auth-demo").click();
  const collection = page.locator(".album-collection");
  await expect(collection).toHaveClass(/album-list/);
  await page.locator('[data-action="layout"][data-layout="grid"]').click();
  await expect(collection).toHaveClass(/album-grid/);

  await page.evaluate(() => {
    location.hash = "#artists";
  });
  await page.locator('main a[href^="#artist/"]').first().click();
  await expect(collection).toHaveClass(/album-list/);

  await page.evaluate(() => {
    location.hash = "#genres";
  });
  await page.locator('main a[href^="#genre/"]').first().click();
  await expect(collection).toHaveClass(/album-list/);
  await page
    .locator('[data-action="genre-layout"][data-layout="grid"]')
    .click();

  await page.reload();
  await page.locator("#auth-demo").click();
  await expect(collection).toHaveClass(/album-grid/);

  await page.evaluate(() => {
    location.hash = "#artists";
  });
  await page.locator('main a[href^="#artist/"]').first().click();
  await expect(collection).toHaveClass(/album-list/);

  await page.evaluate(() => {
    location.hash = "";
  });
  await expect(collection).toHaveClass(/album-grid/);
});
