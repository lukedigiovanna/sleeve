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

test("header actions fit the viewport and retain accessible names", async ({
  page,
  isMobile,
}) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 720 });

  await page.goto("/");
  await page.locator("#auth-demo").click();

  const header = page.locator(".masthead");
  const add = header.getByRole("button", { name: "Add album", exact: true });
  const profile = header.getByRole("link", { name: "Profile", exact: true });

  if (isMobile) {
    await expect(add.locator(".top-add-label")).toBeHidden();
    for (const [action, size] of [
      [add, "40px"],
      [profile, "44px"],
    ] as const) {
      await expect(action).toHaveCSS("width", size);
      await expect(action).toHaveCSS("height", size);
      await expect(action).toBeInViewport({ ratio: 1 });
    }
  } else {
    await expect(add.locator(".top-add-label")).toBeVisible();
  }

  await add.click();
  await expect(page.locator("#editor")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#editor")).toBeHidden();
  await profile.click();
  await expect(profile).toHaveAttribute("aria-current", "page");
});
