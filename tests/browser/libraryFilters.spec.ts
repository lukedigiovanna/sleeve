import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator("#auth-demo").click();
  await expect(page.locator("#library-query")).toBeVisible();
});

test("numeric filters validate ranges, combine with search, and can be removed", async ({
  page,
}) => {
  const original = await page.locator("#library-count").textContent();
  await expect(page.locator("#library-filter-chips")).toBeHidden();
  await page
    .locator(".library-toolbar .genre-filter-dropdown > summary")
    .click();
  await page
    .getByRole("radiogroup", { name: "From rating" })
    .getByRole("radio", { name: "4 stars", exact: true })
    .check();
  await expect(
    page.locator('#library-filter-chips [data-filter="rating"]'),
  ).toHaveAttribute("aria-description", "≥ 4 stars");
  await expect(
    page.locator('#library-filter-chips [data-filter="rating"]'),
  ).toHaveText("≥");
  const filtered = await page.locator("#library-count").textContent();
  await page
    .getByRole("radiogroup", { name: "To rating" })
    .getByRole("radio", { name: "3 stars", exact: true })
    .check();
  await expect(
    page.locator('[data-numeric="rating"] .filter-error'),
  ).toContainText("end must be at least the start");
  await expect(page.locator("#library-count")).toHaveText(filtered!);
  await page
    .getByRole("radiogroup", { name: "To rating" })
    .getByRole("radio", { name: "5 stars", exact: true })
    .check();
  await expect(
    page.locator('#library-filter-chips [data-filter="rating"]'),
  ).toHaveAttribute("aria-description", "4 stars – 5 stars");
  await page
    .locator(".library-toolbar .genre-filter-dropdown > summary")
    .click();
  await page.locator("#library-query").fill("no-such-album-xyz");
  await expect(page.locator("#library-count")).toContainText("0 of");
  await page.locator("#library-query").fill("");
  await page.getByRole("button", { name: "Remove Rating filter" }).click();
  await expect(page.locator("#library-count")).toHaveText(original!);
  await expect(page.locator("#library-filter-chips")).toBeEmpty();
});

test("category pills preserve selections during search and return removed choices when relevant", async ({
  page,
}) => {
  await page
    .locator(".library-toolbar .genre-filter-dropdown > summary")
    .click();
  const group = page.locator('.category-filter[data-category="genres"]');
  const search = group.getByRole("searchbox");
  const regularBorder = await search.evaluate(
    (input) => getComputedStyle(input).borderColor,
  );
  await search.click();
  await expect(search).toHaveCSS("outline-style", "none");
  await expect(search).not.toHaveCSS("border-color", regularBorder);
  await search.blur();
  await expect(search).toHaveCSS("border-color", regularBorder);
  const results = group.locator("[data-category-results]");
  const selected = group.locator("[data-category-selected]");
  const first = results.getByRole("button").first();
  const name = (await first.getAttribute("aria-label"))!.slice(4);
  const counts = await results
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons.map((button) => Number(button.title.split(" ")[0])),
    );
  expect(counts).toEqual([...counts].sort((a, b) => b - a));
  await first.click();
  await expect(
    group.getByRole("button", { name: `Remove ${name}`, exact: true }),
  ).toBeVisible();
  await expect(
    results.getByRole("button", { name: `Add ${name}`, exact: true }),
  ).toHaveCount(0);
  await page.locator("#library-genres-search").fill(name);
  await expect(
    selected.getByRole("button", { name: `Remove ${name}`, exact: true }),
  ).toBeVisible();
  await selected
    .getByRole("button", { name: `Remove ${name}`, exact: true })
    .click();
  await expect(
    results.getByRole("button", { name: `Add ${name}`, exact: true }),
  ).toBeVisible();
  await results
    .getByRole("button", { name: `Add ${name}`, exact: true })
    .click();
  await page.locator("#library-genres-search").fill("no-such-genre-xyz");
  await expect(results).toContainText("No matches");
  await selected
    .getByRole("button", { name: `Remove ${name}`, exact: true })
    .click();
  await expect(selected).toBeHidden();
  await expect(results).toContainText("No matches");
  await page.locator("#library-genres-search").fill("");
  await expect(
    results.getByRole("button", { name: `Add ${name}`, exact: true }),
  ).toBeVisible();
  await expect(group.locator("select, fieldset")).toHaveCount(0);
  await expect(group.locator(".category-filter-search > svg")).toBeVisible();
});

test("category selections use unions for genres/artists and intersections for instruments", async ({
  page,
}) => {
  await page
    .locator(".library-toolbar .genre-filter-dropdown > summary")
    .click();
  for (const field of ["genres", "artists", "instruments"]) {
    const group = page.locator(`.category-filter[data-category="${field}"]`);
    const results = group.locator("[data-category-results]");
    const selected = group.locator("[data-category-selected]");
    const firstName = (await results
      .getByRole("button")
      .first()
      .getAttribute("aria-label"))!.slice(4);
    await results.getByRole("button").first().click();
    const firstAlbums = await page
      .locator("#library-results .album-card")
      .evaluateAll((cards) => cards.map((card) => card.getAttribute("href")));
    const secondName = (await results
      .getByRole("button")
      .first()
      .getAttribute("aria-label"))!.slice(4);
    await results.getByRole("button").first().click();
    const combinedAlbums = await page
      .locator("#library-results .album-card")
      .evaluateAll((cards) => cards.map((card) => card.getAttribute("href")));
    await selected
      .getByRole("button", { name: `Remove ${firstName}`, exact: true })
      .click();
    const secondAlbums = await page
      .locator("#library-results .album-card")
      .evaluateAll((cards) => cards.map((card) => card.getAttribute("href")));
    const expected =
      field === "instruments"
        ? firstAlbums.filter((id) => secondAlbums.includes(id))
        : [...new Set([...firstAlbums, ...secondAlbums])];
    expect([...combinedAlbums].sort()).toEqual(expected.sort());
    await selected
      .getByRole("button", { name: `Remove ${secondName}`, exact: true })
      .click();
    await expect(selected).toBeHidden();
    await expect(page.locator("#library-filter-chips")).toBeEmpty();
  }
});

test("rating bounds support either end, exact values, clearing, and unrated albums", async ({
  page,
}) => {
  await page
    .locator(".library-toolbar .genre-filter-dropdown > summary")
    .click();
  await page
    .getByRole("radiogroup", { name: "To rating" })
    .getByRole("radio", { name: "3 stars", exact: true })
    .check();
  await expect(
    page.locator('#library-filter-chips [data-filter="rating"]'),
  ).toHaveAttribute("aria-description", "≤ 3 stars");
  await page
    .getByRole("radiogroup", { name: "From rating" })
    .getByRole("radio", { name: "3 stars", exact: true })
    .check();
  await expect(
    page.locator('#library-filter-chips [data-filter="rating"]'),
  ).toHaveAttribute("aria-description", "3 stars");
  const exactChip = page.locator(
    '#library-filter-chips [data-filter="rating"]',
  );
  await expect(exactChip).toHaveText("");
  await expect(exactChip.locator(".star")).toHaveCount(5);
  expect((await exactChip.boundingBox())!.height).toBeLessThanOrEqual(26);
  await page.locator("#rating-unset").check();
  await expect(
    page
      .getByRole("radiogroup", { name: "From rating" })
      .getByRole("radio")
      .first(),
  ).toBeDisabled();
  await expect(
    page.locator('#library-filter-chips [data-filter="rating"]'),
  ).toHaveAttribute("aria-description", "Unrated");
  await page.locator("#rating-unset").uncheck();
  await expect(
    page.locator('#library-filter-chips [data-filter="rating"]'),
  ).toHaveAttribute("aria-description", "3 stars");
  await page
    .getByRole("radiogroup", { name: "From rating" })
    .getByRole("radio", { name: "3 stars", exact: true })
    .click();
  await page
    .getByRole("radiogroup", { name: "To rating" })
    .getByRole("radio", { name: "3 stars", exact: true })
    .click();
  await expect(page.locator("#library-filter-chips")).toBeEmpty();
});

test("year bounds are inclusive, validate reversed ranges, and survive rerendering", async ({
  page,
}) => {
  await page
    .locator(".library-toolbar .genre-filter-dropdown > summary")
    .click();
  await page.locator("#releaseYear-max").selectOption("2000");
  await expect(
    page.locator('#library-filter-chips [data-filter="releaseYear"]'),
  ).toHaveAttribute("aria-description", "≤ 2000");
  await page.locator("#releaseYear-min").selectOption("2001");
  await expect(page.locator("#releaseYear-min")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(
    page.locator('#library-filter-chips [data-filter="releaseYear"]'),
  ).toHaveAttribute("aria-description", "≤ 2000");
  await page.locator("#releaseYear-min").selectOption("1980");
  await expect(
    page.locator('#library-filter-chips [data-filter="releaseYear"]'),
  ).toHaveAttribute("aria-description", "1980 – 2000");
  await expect(
    page.locator('#library-filter-chips [data-filter="releaseYear"]'),
  ).toHaveText("1980–2000");
  await page
    .locator(".library-toolbar .genre-filter-dropdown > summary")
    .click();
  const filteredUrl = page.url();
  await page.goto("/#artists");
  await page.goto(filteredUrl);
  await page
    .locator(".library-toolbar .genre-filter-dropdown > summary")
    .click();
  await expect(page.locator("#releaseYear-min")).toHaveValue("1980");
  await expect(page.locator("#releaseYear-max")).toHaveValue("2000");
  await page.locator("#releaseYear-max").selectOption("");
  await expect(
    page.locator('#library-filter-chips [data-filter="releaseYear"]'),
  ).toHaveAttribute("aria-description", "≥ 1980");
  await page.getByRole("button", { name: "Clear year filter" }).click();
  await expect(page.locator("#releaseYear-min")).toHaveValue("");
  await expect(page.locator("#releaseYear-max")).toHaveValue("");
  await expect(page.locator("#library-filter-chips")).toBeEmpty();
});

test("rating stars support half stars and keyboard selection", async ({
  page,
}) => {
  await page
    .locator(".library-toolbar .genre-filter-dropdown > summary")
    .click();
  await expect(
    page.getByRole("radio", { name: "Any", exact: true }),
  ).toHaveCount(0);
  const from = page.getByRole("radiogroup", { name: "From rating" });
  await from.getByRole("radio", { name: "3.5 stars", exact: true }).check();
  await expect(
    page.locator('#library-filter-chips [data-filter="rating"]'),
  ).toHaveAttribute("aria-description", "≥ 3.5 stars");
  await expect(from.locator(".star-fill").nth(3)).toHaveAttribute(
    "style",
    "--fill:50%",
  );
  await from
    .getByRole("radio", { name: "3.5 stars", exact: true })
    .press("ArrowRight");
  await expect(
    from.getByRole("radio", { name: "4 stars", exact: true }),
  ).toBeChecked();
  await expect(
    page.locator('#library-filter-chips [data-filter="rating"]'),
  ).toHaveAttribute("aria-description", "≥ 4 stars");
  await from.getByRole("radio", { name: "4 stars", exact: true }).click();
  await expect(page.locator("#library-filter-chips")).toBeEmpty();
});

test("rating controls fit on one line with a compact unrated toggle", async ({
  page,
}, testInfo) => {
  await page
    .locator(".library-toolbar .genre-filter-dropdown > summary")
    .click();
  const row = page.locator('[data-numeric="rating"] .numeric-filter-row');
  const label = await row.locator("#rating-label").boundingBox();
  const from = await row
    .getByRole("radiogroup", { name: "From rating" })
    .boundingBox();
  const to = await row
    .getByRole("radiogroup", { name: "To rating" })
    .boundingBox();
  const toggle = row.getByRole("checkbox", { name: "Unrated only" });
  const unset = await toggle.boundingBox();
  for (const bounds of [from, to, unset]) {
    expect(
      Math.abs(bounds!.y + bounds!.height / 2 - label!.y - label!.height / 2),
    ).toBeLessThan(2);
  }
  expect(from!.x).toBeGreaterThan(label!.x + label!.width);
  expect(to!.x).toBeGreaterThan(from!.x + from!.width);
  expect(unset!.x).toBeGreaterThan(to!.x + to!.width);
  await expect(row).not.toContainText("From");
  await expect(row).not.toContainText("To");
  await toggle.check();
  await expect(
    page.locator('#library-filter-chips [data-filter="rating"]'),
  ).toHaveAttribute("aria-description", "Unrated");
  await toggle.uncheck();
  await expect(page.locator("#library-filter-chips")).toBeEmpty();
  await row.screenshot({
    path: testInfo.outputPath("rating-row.png"),
  });
});

test("year pickers use a bounded year list and align with rating columns", async ({
  page,
}) => {
  await page
    .locator(".library-toolbar .genre-filter-dropdown > summary")
    .click();
  const currentYear = await page.evaluate(() => new Date().getFullYear());
  const minimum = page.getByRole("combobox", { name: "From year" });
  const maximum = page.getByRole("combobox", { name: "To year" });
  const clearBounds = await page
    .getByRole("button", { name: "Clear year filter" })
    .boundingBox();
  const minBounds = await minimum.boundingBox();
  expect(
    Math.abs(
      clearBounds!.y +
        clearBounds!.height / 2 -
        minBounds!.y -
        minBounds!.height / 2,
    ),
  ).toBeLessThan(1);
  await expect(minimum).toHaveCSS("text-align-last", "center");
  const values = await minimum
    .locator("option")
    .evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    );
  expect(values[0]).toBe("");
  expect(values[1]).toBe(String(currentYear));
  expect(values.at(-1)).toBe("1000");
  expect(values).toHaveLength(currentYear - 998);
  for (const [year, rating] of [
    [minimum, page.getByRole("radiogroup", { name: "From rating" })],
    [maximum, page.getByRole("radiogroup", { name: "To rating" })],
  ]) {
    const yearBounds = await year.boundingBox();
    const ratingBounds = await rating.boundingBox();
    expect(Math.abs(yearBounds!.x - ratingBounds!.x)).toBeLessThan(1);
    expect(yearBounds!.height).toBeLessThanOrEqual(28);
  }
  await minimum.selectOption("1000");
  await maximum.selectOption(String(currentYear));
  await expect(
    page.locator('#library-filter-chips [data-filter="releaseYear"]'),
  ).toHaveAttribute("aria-description", `1000 – ${currentYear}`);
  await minimum.selectOption("");
  await expect(
    page.locator('#library-filter-chips [data-filter="releaseYear"]'),
  ).toHaveAttribute("aria-description", `≤ ${currentYear}`);
});

test("vinyl icon toggles combine as a union and deselect independently", async ({
  page,
}) => {
  await page
    .locator(".library-toolbar .genre-filter-dropdown > summary")
    .click();
  const group = page.getByRole("group", { name: "Vinyl", exact: true });
  const owned = group.getByRole("checkbox", {
    name: "Owned on vinyl",
    exact: true,
  });
  const wishlisted = group.getByRole("checkbox", {
    name: "Vinyl wishlist",
    exact: true,
  });
  await expect(group.getByRole("checkbox")).toHaveCount(2);
  await expect(group.locator("svg")).toHaveCount(2);
  const yearBox = await page
    .locator('[data-numeric="releaseYear"]')
    .boundingBox();
  const vinylBox = await group.boundingBox();
  const genresBox = await page
    .locator('.category-filter[data-category="genres"]')
    .boundingBox();
  expect(vinylBox!.y).toBeGreaterThanOrEqual(yearBox!.y + yearBox!.height);
  expect(genresBox!.y).toBeGreaterThanOrEqual(vinylBox!.y + vinylBox!.height);
  await page.locator("#releaseYear-min").selectOption("1980");
  await owned.click();
  await expect(owned).toBeChecked();
  await expect(wishlisted).not.toBeChecked();
  const ownedAlbums = await page
    .locator("#library-results .album-card")
    .evaluateAll((cards) => cards.map((card) => card.getAttribute("href")));
  await wishlisted.press("Space");
  await expect(owned).toBeChecked();
  await expect(wishlisted).toBeChecked();
  const unionAlbums = await page
    .locator("#library-results .album-card")
    .evaluateAll((cards) => cards.map((card) => card.getAttribute("href")));
  await expect(
    page.locator('#library-filter-chips [data-filter="vinylStatus"]'),
  ).toHaveAttribute("aria-description", "Owned on vinyl or Vinyl wishlist");
  await owned.click();
  await expect(owned).not.toBeChecked();
  const wishlistAlbums = await page
    .locator("#library-results .album-card")
    .evaluateAll((cards) => cards.map((card) => card.getAttribute("href")));
  expect([...unionAlbums].sort()).toEqual(
    [...new Set([...ownedAlbums, ...wishlistAlbums])].sort(),
  );
  await wishlisted.click();
  await expect(wishlisted).not.toBeChecked();
  await expect(
    page.locator('#library-filter-chips [data-filter="vinylStatus"]'),
  ).toHaveCount(0);
  await expect(page.locator("#releaseYear-min")).toHaveValue("1980");
});
