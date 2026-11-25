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

  const restingColor = await profile.evaluate(
    (link) => getComputedStyle(link).color,
  );
  for (const action of [add, profile]) {
    await expect(action).toHaveCSS("width", "46px");
    await expect(action).toHaveCSS("height", "46px");
    await expect(action).toBeInViewport({ ratio: 1 });
    await expect(action).toHaveCSS("color", restingColor);
    await expect(action).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(action.locator("svg")).toHaveCSS("width", "26px");
  }
  await expect(profile).toHaveCSS("border-top-width", "0px");
  if (!isMobile) {
    await add.hover();
    await expect(add).toHaveCSS("color", "rgb(145, 191, 255)");
    await expect(add).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await page.mouse.down();
    await expect(add).toHaveCSS("color", "rgb(182, 214, 255)");
    await page.mouse.move(0, 0);
    await page.mouse.up();
  }
  const nav = header.getByRole("navigation", { name: "Main navigation" });
  const currentTab = nav.locator('[aria-current="page"]');
  await expect(currentTab).toHaveText("Library");
  const divider = nav.locator(".main-nav-divider");
  const underline = await divider.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      height: style.height,
      bottom: style.bottom,
      mask: style.maskImage,
    };
  });
  expect(underline.height).toBe("2px");
  expect(underline.bottom).toBe("-1px");
  expect(underline.mask).toContain("linear-gradient");

  const navBounds = (await nav.boundingBox())!;
  const headerBounds = (await header.boundingBox())!;
  expect(navBounds.y + navBounds.height + 1).toBeCloseTo(
    headerBounds.y + headerBounds.height,
    0,
  );
  expect(navBounds.x + navBounds.width / 2).toBeCloseTo(
    headerBounds.x + headerBounds.width / 2,
    0,
  );

  const artistsTab = nav.getByRole("link", { name: "Artists" });
  await artistsTab.click();
  await expect(artistsTab).toHaveAttribute("aria-current", "page");
  const artists = (await artistsTab.boundingBox())!;
  await expect
    .poll(async () => (await divider.boundingBox())!.x)
    .toBeCloseTo(artists.x, 0);
  expect((await divider.boundingBox())!.width).toBeCloseTo(artists.width, 0);

  await add.click();
  await expect(page.locator("#editor")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#editor")).toBeHidden();
  await profile.click();
  await expect(profile).toHaveAttribute("aria-current", "page");
  await expect(divider).toBeHidden();
});
