import { test, expect, type Page } from "@playwright/test";
import { mockAlbums } from "../../src/data/mockData";

async function enterDemo(page: Page) {
  await page.goto("/");
  await page.locator("#auth-demo").click();
  await expect(page.locator("#library-query")).toBeVisible();
}

async function reloadDemo(page: Page) {
  await page.reload();
  await page.locator("#auth-demo").click();
}

async function openAlbum(page: Page) {
  await page.locator('a[href^="#album/"]').first().click();
  await expect(page.locator("#page-title")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  // Metadata requests must never depend on live network responses.
  await page.route(
    /https:\/\/(musicbrainz\.org|coverartarchive\.org|.*\.wikipedia\.org|.*\.wikimedia\.org|www\.wikidata\.org)\//,
    (route) => route.abort(),
  );
  await enterDemo(page);
});

test("catalog album headings keep compact layout toggles on the title row", async ({
  page,
}) => {
  for (const width of [1280, 393, 320]) {
    await page.setViewportSize({ width, height: 850 });
    for (const catalog of ["artists", "genres"]) {
      await page.locator(`[data-nav="${catalog}"]`).click();
      const singular = catalog.slice(0, -1);
      await page.locator(`main a[href^="#${singular}/"]`).first().click();
      const heading = page.locator(".album-list-heading");
      await expect(heading).toBeVisible();
      const metadata = heading.locator(".detail-heading");
      if (catalog === "artists") {
        await expect(metadata).toHaveText("Albums");
        const profile = await page
          .locator(".artist-page-heading")
          .boundingBox();
        const sectionHeading = await heading.boundingBox();
        expect(sectionHeading!.y - (profile!.y + profile!.height)).toBeCloseTo(
          28,
          0,
        );
      } else {
        await expect(metadata.locator(".count-pill")).toHaveText(/^\d+$/);
      }
      const title = await heading.locator(".detail-heading").boundingBox();
      const chooser = heading.locator(".layout-toggle");
      await expect(chooser).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(
        chooser.getByRole("button", { name: "Grid view" }),
      ).toHaveCSS("width", "30px");
      if (await page.evaluate(() => matchMedia("(hover: hover)").matches)) {
        const inactive = chooser.locator('[aria-pressed="false"]');
        await inactive.hover();
        const highlight = (pressed: boolean) =>
          chooser.locator(`[aria-pressed="${pressed}"]`).evaluate((button) => {
            const style = getComputedStyle(button, "::before");
            return {
              width: style.width,
              height: style.height,
              color: style.backgroundColor,
            };
          });
        const hovered = await highlight(false);
        const selected = await highlight(true);
        expect(hovered.color).not.toBe("rgba(0, 0, 0, 0)");
        expect([hovered.width, hovered.height]).toEqual([
          selected.width,
          selected.height,
        ]);
        await expect(inactive).toHaveCSS(
          "background-color",
          "rgba(0, 0, 0, 0)",
        );
      }
      const toggle = await chooser.boundingBox();
      expect(toggle!.width).toBe(62);
      expect(
        Math.abs(title!.y + title!.height / 2 - toggle!.y - toggle!.height / 2),
      ).toBeLessThan(1);
      await heading
        .getByRole("button", { name: "List view", exact: true })
        .click();
      await expect(
        page
          .locator(".album-list-heading")
          .getByRole("button", { name: "List view", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await page
        .locator(".album-list-heading")
        .getByRole("button", { name: "Grid view", exact: true })
        .click();
      await expect(
        page
          .locator(".album-list-heading")
          .getByRole("button", { name: "Grid view", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
    }
  }
});

test("browse tabs share heading and toolbar spacing with flat results", async ({
  page,
}) => {
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await page.locator('[data-nav="library"]').click();

    const title = page.locator("#page-title");
    await expect(title).toHaveText("Your library");
    const measureHeading = () =>
      title.evaluate((heading) => {
        const search = heading
          .closest("section")!
          .querySelector(".search-field")!;
        const bounds = heading
          .closest(".catalog-heading")!
          .getBoundingClientRect();
        return {
          font: getComputedStyle(heading).font,
          top: bounds.top,
          gap: search.getBoundingClientRect().top - bounds.bottom,
        };
      });
    const discover = page.getByRole("button", {
      name: "Discover",
      exact: true,
    });
    const titleBox = (await title.boundingBox())!;
    const discoverBox = (await discover.boundingBox())!;
    expect(discoverBox.y + discoverBox.height / 2).toBeCloseTo(
      titleBox.y + titleBox.height / 2,
      0,
    );
    await expect(discover.locator("svg")).toBeVisible();
    const albumCount = page.locator("#library-count");
    await expect(albumCount).toBeVisible();
    await expect(albumCount).toHaveText(/^\d+ albums$/);
    const countStyle = (selector: string) =>
      page.locator(selector).evaluate((element) => {
        const style = getComputedStyle(element);
        const row = element.closest(".results-meta")!.getBoundingClientRect();
        return {
          font: style.font,
          color: style.color,
          rowHeight: row.height,
          countOffset: element.getBoundingClientRect().top - row.top,
        };
      });
    const albumCountStyle = await countStyle("#library-count");

    const library = await measureHeading();
    for (const [route, name, row] of [
      ["artists", "Artists", ".artist-catalog-row"],
      ["genres", "Genres", ".genre-tree > ul > li"],
      ["instruments", "Instruments", ".instrument-catalog-row"],
    ]) {
      const tab = page.locator(`[data-nav="${route}"]`);
      await tab.click();
      await expect(title).toHaveText(name);
      await expect(tab).toHaveAttribute("aria-current", "page");
      expect(await measureHeading()).toEqual(library);
      expect(await countStyle("#" + route + "-count")).toEqual(albumCountStyle);
      await expect(page.locator(row).first()).toHaveCSS(
        "background-color",
        "rgba(0, 0, 0, 0)",
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
    }
  }
});

test("library toolbar stays on one row and the sort dropdown orders albums", async ({
  page,
}) => {
  for (const width of [1280, 640, 393, 320]) {
    await page.setViewportSize({ width, height: 850 });
    const search = await page
      .locator(".library-toolbar .search-field")
      .boundingBox();
    const filters = await page
      .locator(".library-toolbar .genre-filter-dropdown > summary")
      .boundingBox();
    const sort = await page.locator(".library-sort").boundingBox();

    expect(search).not.toBeNull();
    expect(filters).not.toBeNull();
    expect(sort).not.toBeNull();
    expect(sort!.height).toBe(filters!.height);
    expect(sort!.y).toBe(filters!.y);
    expect(Math.abs(search!.y - sort!.y)).toBeLessThanOrEqual(1);
    expect(sort!.x + sort!.width).toBeLessThanOrEqual(width);
    await expect(page.locator(".library-sort-text")).toBeVisible({
      visible: width > 700,
    });

    if (width <= 700) {
      expect(filters!.width).toBe(40);
      expect(sort!.width).toBe(40);
      expect(sort!.height).toBe(40);
      const row = page.locator(".album-list .album-card").first();
      const toggle = await page
        .getByRole("button", { name: "List view" })
        .boundingBox();

      expect(toggle!.width).toBe(30);
      expect(toggle!.height).toBe(40);
      expect(toggle!.y).toBeGreaterThanOrEqual(search!.y + search!.height);
      expect((await row.boundingBox())!.y).toBeLessThan(275);
      await expect(row).toHaveCSS("border-top-width", "0px");
      await expect(
        page.locator(".album-list .star-fill[style='--fill:50%']").first(),
      ).toBeVisible();
    }

    const expectNoOverflow = async () => {
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
    };

    await expectNoOverflow();
    await page
      .locator(".library-toolbar .genre-filter-dropdown > summary")
      .click();
    const panel = await page
      .locator(".library-toolbar .genre-filter-panel")
      .boundingBox();
    expect(panel!.x).toBeGreaterThanOrEqual(0);
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(width);
    await expectNoOverflow();
    await page
      .locator(".library-toolbar .genre-filter-dropdown > summary")
      .click();
    await page.locator(".library-sort").click();
    const year = page.locator('[data-sort="year"]');
    await year.click();
    await expect(page.locator(".library-sort-dropdown")).toHaveAttribute(
      "open",
    );
    await page.keyboard.press("Escape");
    await expectNoOverflow();
  }

  await page.locator(".library-sort").click();
  await page.locator('[data-sort="title"]').click();
  await page.keyboard.press("Escape");
  const titles = await page
    .locator("#library-results .album-title strong")
    .allTextContents();
  expect(titles.length).toBeGreaterThan(1);
  expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));

  await page.locator(".library-sort").click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".library-sort-dropdown")).not.toHaveAttribute(
    "open",
  );
  await expect(page.locator(".library-sort")).toBeFocused();
  await page.locator(".library-sort").click();
  await page.locator("#library-query").click();
  await expect(page.locator(".library-sort-dropdown")).not.toHaveAttribute(
    "open",
  );

  await page.locator('[data-nav="artists"]').click();
  await page.locator('[data-nav="library"]').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page.locator(".library-sort").click();
  await expect(page.locator('[data-sort="title"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("Escape");
  await page.reload();
  await page.locator("#auth-demo").click();
  await expect(page.locator("#library-query")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});

test("sort categories cycle both directions and off, replacing the active category", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 850 });
  const titles = page.locator("#library-results .album-title strong");
  const dropdown = page.locator(".library-sort-dropdown");
  await page.locator(".library-sort").click();
  await expect(page.locator('[data-sort="created"]')).toHaveAccessibleName(
    "Date added, descending",
  );
  const activeChoice = page.locator('[data-sort="created"]');
  const sortArrow = activeChoice.locator(".sort-direction .icon");
  await expect(sortArrow).toHaveCSS("width", "12px");
  await expect(sortArrow).toHaveCSS(
    "color",
    await activeChoice.evaluate((element) => getComputedStyle(element).color),
  );
  await activeChoice.click();
  const original = await titles.allTextContents();

  for (const category of ["recent", "created", "title", "rating", "year"]) {
    const choice = page.locator(`[data-sort="${category}"]`);
    await choice.click();
    await expect(choice).toHaveAccessibleName(/, ascending$/);
    await expect(choice.locator(".ascending svg")).toHaveCount(1);
    await expect(
      page.locator('.library-sort-choice[aria-pressed="true"]'),
    ).toHaveCount(1);
    await expect(dropdown).toHaveAttribute("open");
    if (category === "title")
      expect(await titles.allTextContents()).toEqual(
        [...original].sort((a, b) => a.localeCompare(b)),
      );

    await page.keyboard.press("Enter");
    await expect(choice).toHaveAccessibleName(/, descending$/);
    await expect(choice.locator(".descending svg")).toHaveCount(1);
    if (category === "title")
      expect(await titles.allTextContents()).toEqual(
        [...original].sort((a, b) => b.localeCompare(a)),
      );

    await choice.click();
    await expect(choice).toHaveAccessibleName(/, off$/);
    await expect(
      page.locator('.library-sort-choice[aria-pressed="true"]'),
    ).toHaveCount(0);
    expect(await titles.allTextContents()).toEqual(original);
  }

  await page.locator('[data-sort="title"]').click();
  await page.locator('[data-sort="rating"]').click();
  await expect(page.locator('[data-sort="title"]')).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator('[data-sort="rating"]')).toHaveAccessibleName(
    "Rating, ascending",
  );
  await expect(
    page.locator('.library-sort-choice[aria-pressed="true"]'),
  ).toHaveCount(1);
});

test("unrated albums show a label in list view and omit the detail rating", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add album", exact: true }).click();
  await page.locator('[data-action="manual"]').click();
  await page.locator('[name="title"]').fill("Unrated stars experiment");
  await page.locator('#album-form button[type="submit"]').click();
  await expect(page.locator("#editor")).not.toBeVisible();
  await expect(page.locator(".detail-rating")).toHaveCount(0);
  await page.goto("/#");

  const unratedCard = page
    .locator(".album-card")
    .filter({ has: page.locator(".unrated") })
    .first();
  await expect(unratedCard.locator(".unrated-label")).toHaveText("Unrated");
  await expect(unratedCard.locator(".unrated-label")).toBeVisible();
  await expect(unratedCard.locator(".stars")).toHaveCount(0);

  await page.getByRole("button", { name: "Grid view" }).click();
  const rating = unratedCard.locator(".rating");
  await expect(rating).toHaveAttribute("aria-label", "Unrated");
  await expect(rating.locator(".star")).toHaveCount(5);
  await expect(rating.locator(".star-fill").first()).toHaveAttribute(
    "style",
    "--fill:0%",
  );
  const star = rating.locator(".star").first();
  const starColor = await star.evaluate(
    (element) => getComputedStyle(element).color,
  );
  await expect(star.locator(":scope > svg")).toHaveCSS("stroke", starColor);
  const ratedStar = page.locator(".rating:not(.unrated) .star").first();
  await expect(ratedStar).toHaveCSS("color", starColor);
  const ratedFillColor = await ratedStar
    .locator(".star-fill")
    .evaluate((element) => getComputedStyle(element).color);
  await expect(ratedStar.locator(".star-fill svg")).toHaveCSS(
    "stroke",
    ratedFillColor,
  );
  await expect(star.locator(":scope > svg")).toHaveCSS("fill-opacity", "0.3");
  await expect(star.locator(":scope > svg")).toHaveCSS("stroke-opacity", "1");
  await unratedCard.click();
  await expect(page.locator(".album-hero")).toBeVisible();
  await expect(page.locator(".detail-rating")).toHaveCount(0);
  await expect(page.getByText("Unrated", { exact: true })).toHaveCount(0);
});

test("album fields and music links survive save and reload", async ({
  page,
}) => {
  await openAlbum(page);
  await page.locator('[data-action="edit"]').click();
  await page.locator('[name="title"]').fill('Regression "album" & friends');
  await page.locator('[name="label"]').fill("Test label");

  await page.locator('[data-action="add-link"]').click();
  await page
    .locator('[name="linkUrl"]')
    .last()
    .fill("https://example.com/record?a=1&b=2");
  await page.locator('[name="linkLabel"]').last().fill("Test music link");
  await page.locator('#album-form button[type="submit"]').click();
  await expect(page.locator("#editor")).not.toBeVisible();
  await reloadDemo(page);
  await expect(page.locator("#page-title")).toHaveText(
    'Regression "album" & friends',
  );
  await expect(
    page.getByRole("link", {
      name: "Test music link (opens in a new tab)",
      exact: true,
    }),
  ).toHaveAttribute("href", "https://example.com/record?a=1&b=2");
  await page.locator('[data-action="edit"]').click();
  await expect(page.locator('[name="label"]')).toHaveValue("Test label");
  await expect(page.locator('[name="vinylStatus"]')).toHaveCount(0);
});

test("album artwork actions offer the preferred listening link", async ({
  page,
}) => {
  await page.locator('a[href="#album/seychelles"]').click();
  const shortcut = page.locator(".album-listen-button");
  const musicLinks = page.getByRole("region", { name: "Music links" });
  const edit = musicLinks.getByRole("button", { name: "Edit music links" });

  await expect(shortcut).toHaveAccessibleName(
    "Listen on Apple Music (opens in a new tab)",
  );
  const vinyl = page.locator("#vinyl-status-button");
  const vinylBounds = (await vinyl.boundingBox())!;
  const shortcutBounds = (await shortcut.boundingBox())!;
  expect(shortcutBounds.y).toBe(vinylBounds.y);
  expect(shortcutBounds.x + shortcutBounds.width).toBeLessThan(vinylBounds.x);

  const firstLink = musicLinks.getByRole("link").first();
  await expect(firstLink).toHaveAccessibleName(
    "Apple Music (opens in a new tab)",
  );
  await expect(firstLink).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(firstLink.locator("..")).toHaveCSS("border-top-width", "1px");
  await expect(firstLink).toHaveAttribute("target", "_blank");

  await edit.click();
  const editor = page.locator("#editor");
  const remove = editor.getByRole("button", {
    name: "Remove link",
    exact: true,
  });
  const save = editor.locator('button[type="submit"]');
  await remove.first().click();
  await save.click();

  await expect(shortcut).toHaveAccessibleName(
    "Listen on YouTube (opens in a new tab)",
  );
  await expect(shortcut).toHaveAttribute(
    "href",
    /^https:\/\/www\.youtube\.com\//,
  );

  await edit.click();
  await remove.first().click();
  await save.click();
  await expect(shortcut).toHaveCount(0);
  expect((await vinyl.boundingBox())!.x).toBe(vinylBounds.x);
  await expect(page.locator(".album-sleeve .cover")).toBeVisible();
});

test("new listening entry survives reload", async ({ page }) => {
  await openAlbum(page);
  await page.locator('[data-action="listen"]').first().click();
  await page.locator('[name="date"]').fill("2026-01-15");
  await page.locator('[name="rating"][value="8"]').check();
  await page.locator("#listening-notes").fill("Regression listening notes");
  await page.locator('#listen-form button[type="submit"]').click();
  await expect(page.locator("#editor")).not.toBeVisible();
  await reloadDemo(page);
  await expect(
    page.getByText("Regression listening notes", { exact: true }),
  ).toBeVisible();
  await page
    .locator('[data-action="edit-listen"]')
    .filter({ hasText: "Regression listening notes" })
    .click();
  await expect(page.locator('[name="date"]')).toHaveValue("2026-01-15");
  await expect(page.locator('[name="rating"][value="8"]')).toBeChecked();
});

test("listening note smart links survive drafts and open catalog pages", async ({
  page,
  isMobile,
}) => {
  const source = mockAlbums[0];
  const related = mockAlbums[1];
  const references = [
    { type: "Artist", label: related.artists[0].name },
    { type: "Album", label: related.title },
    { type: "Instrument", label: source.instruments[0].name },
    { type: "Genre", label: source.genres[0].name },
  ];

  await openAlbum(page);
  await page.getByRole("button", { name: "Log a listen" }).click();
  const notes = page.getByRole("combobox", { name: "Listening notes" });
  await notes.fill("mail@example.com");
  await expect(notes).toHaveAttribute("aria-expanded", "false");
  await notes.fill("Reminds me of @");
  await expect(notes).toHaveAttribute("aria-expanded", "true");
  await notes.press("Escape");
  await expect(notes).toHaveText("Reminds me of @");
  await expect(page.locator("#editor")).toBeVisible();

  for (const [index, { type, label }] of references.entries()) {
    if (index > 0) await page.keyboard.insertText("@");
    await page.keyboard.insertText(label);
    const option = page
      .getByRole("option", { name: new RegExp(`^${type} `) })
      .filter({ hasText: label })
      .first();
    await expect(option).toBeVisible();
    if (index === 0) await notes.press("Enter");
    else if (isMobile) await option.tap();
    else await option.click();

    await expect(notes.locator(".listen-note-chip").last()).toHaveText(label);
    await expect(notes).toBeFocused();
  }

  await notes.press("Shift+Enter");
  await page.keyboard.insertText("A second line.");
  await expect(page.getByText("Draft saved on this device")).toHaveCount(1);
  await reloadDemo(page);
  await expect(notes.locator(".listen-note-chip")).toHaveCount(4);
  await page.getByRole("button", { name: "Save listen" }).click();
  await expect(page.locator("#editor")).not.toBeVisible();
  await reloadDemo(page);

  const card = page.locator(".listen-row").filter({ hasText: "Reminds me of" });
  await expect(card.locator(".listen-notes")).toContainText("A second line.");
  expect(await card.locator(".listen-notes").textContent()).toMatch(
    /\nA second line\.$/,
  );
  for (const { type, label } of references) {
    const link = card.getByRole("link", { name: label, exact: true });
    await expect(link).toHaveAttribute(
      "href",
      new RegExp(`^#${type.toLowerCase()}/`),
    );
    await expect(link).toHaveCSS("font-weight", "700");
    await expect(link).toHaveCSS("text-decoration-line", "none");
  }
  await card.getByRole("link", { name: related.title, exact: true }).click();
  await expect(page.locator("#page-title")).toHaveText(related.title);
});

test("a saved smart link at the end of a note can be followed by text or deleted", async ({
  page,
  isMobile,
}) => {
  const title = mockAlbums[1].title;
  await openAlbum(page);
  await page.getByRole("button", { name: "Log a listen" }).click();
  const notes = page.getByRole("combobox", { name: "Listening notes" });
  await notes.fill(`@${title}`);
  await notes.press("Enter");
  const chip = notes.locator(".listen-note-chip");
  await expect(chip).toHaveCount(1);
  await page.getByRole("button", { name: "Save listen" }).click();
  await reloadDemo(page);

  const card = page.locator(".listen-row").filter({ hasText: title });
  await card.getByRole("button", { name: /Edit listen from/ }).click();
  const bounds = (await chip.boundingBox())!;
  const x = bounds.x + bounds.width + 8;
  const y = bounds.y + bounds.height / 2;
  if (isMobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await page.keyboard.type(" again");
  await expect(notes).toHaveText(`${title} again`);

  for (const _ of " again") await page.keyboard.press("Backspace");
  await expect(notes).toHaveText(title);
  await page.keyboard.press("Backspace");
  await expect(chip).toHaveCount(0);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(card).toHaveCount(0);
});

test("missing smart-link targets display the escaped fallback label", async ({
  page,
}) => {
  await openAlbum(page);
  await page.getByRole("button", { name: "Log a listen" }).click();
  await page
    .locator("#listening-notes")
    .fill(
      String.raw`From [Folk \[live\] & <friends>](sleeve:genre/missing) and [bad](sleeve:genre/%ZZ)`,
    );
  await page.getByRole("button", { name: "Save listen" }).click();
  const note = page.locator(".listen-notes").filter({ hasText: "Folk" });
  await expect(note).toHaveText(
    "From Folk [live] & <friends> and [bad](sleeve:genre/%ZZ)",
  );
  await expect(note.getByRole("link")).toHaveCount(0);
});

test("listening stars preview half-star ratings with a mouse", async ({
  page,
  isMobile,
}) => {
  await openAlbum(page);
  await page.locator('[data-action="listen"]').first().click();

  const threeAndAHalf = page.locator('[name="rating"][value="7"]');
  const fills = page.locator("#rating-stars .star-fill");
  if (isMobile) {
    await threeAndAHalf.tap();
  } else {
    await threeAndAHalf.hover();
    await expect(threeAndAHalf).not.toBeChecked();
    await expect(fills.nth(0)).toHaveCSS("clip-path", "inset(0px 0% 0px 0px)");
    await expect(fills.nth(3)).toHaveCSS("clip-path", "inset(0px 50% 0px 0px)");
    await expect(fills.nth(4)).toHaveCSS(
      "clip-path",
      "inset(0px 100% 0px 0px)",
    );
    await expect(fills.nth(3)).toHaveCSS("opacity", "0.65");
    await threeAndAHalf.click();
    await expect(fills.nth(3)).toHaveCSS("opacity", "1");
    const twoStars = page.locator('[name="rating"][value="4"]');
    await twoStars.hover();
    await expect(fills.nth(3)).toHaveCSS(
      "clip-path",
      "inset(0px 100% 0px 0px)",
    );
    await page.locator("#listening-notes").hover();
  }

  await expect(threeAndAHalf).toBeChecked();
  await expect(fills.nth(3)).toHaveCSS("clip-path", "inset(0px 50% 0px 0px)");
  await expect(fills.nth(3)).toHaveCSS("opacity", "1");
});

test("listening draft status appears on hover or tap", async ({
  page,
  isMobile,
}) => {
  await openAlbum(page);
  await page.locator('[data-action="listen"]').first().click();
  const row = page.locator(".listen-intro");
  const icon = row.getByRole("button", { name: "Draft status" });
  const message = row.locator("[data-draft-status]");
  const notes = page.locator("#listening-notes");
  await notes.fill("An unfinished listening note");
  await expect(message).toHaveText("Draft saved on this device");
  await expect(message).toHaveCSS("opacity", "0");

  if (isMobile) {
    await icon.tap();
    await expect(message).toHaveCSS("opacity", "1");
    await icon.tap();
  } else {
    await icon.hover();
    await expect(message).toHaveCSS("opacity", "1");
    await notes.hover();
    await expect(message).toHaveCSS("opacity", "0");
    await page.locator("#dialog-title").focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(icon).toBeFocused();
    await expect(message).toHaveCSS("opacity", "1");
    await page.keyboard.press("Tab");
  }

  await expect(message).toHaveCSS("opacity", "0");
});

test("note-only listens survive reload and preserve the latest rating", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add album", exact: true }).click();
  await page.locator('[data-action="manual"]').click();
  await page.locator('[name="title"]').fill("Notes-only regression album");
  await page.locator('#album-form button[type="submit"]').click();
  await page.locator('[data-action="listen"]').first().click();
  await page.locator('[name="date"]').fill("2026-01-15");
  await page.locator('[name="rating"][value="8"]').check();
  await page.getByRole("button", { name: "Save listen" }).click();

  await page.locator('[data-action="listen"]').first().click();
  const selectedRating = page.locator('[name="rating"]:checked');
  await expect(page.locator('[name="rating"]')).toHaveCount(10);
  await expect(selectedRating).toHaveCount(0);
  await page.locator("#listening-notes").fill("A thought about this album");
  await page.getByRole("button", { name: "Save listen" }).click();
  await reloadDemo(page);

  const entry = page
    .locator('[data-action="edit-listen"]')
    .filter({ hasText: "A thought about this album" });
  await expect(entry.locator(".unrated-label")).toHaveText("Unrated");
  await expect(page.locator(".detail-rating .rating")).toHaveAttribute(
    "aria-label",
    "4 out of 5 stars",
  );

  await entry.click();
  await expect(selectedRating).toHaveCount(0);
  await page.locator('[name="rating"][value="10"]').check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".detail-rating .rating")).toHaveAttribute(
    "aria-label",
    "5 out of 5 stars",
  );

  await entry.click();
  const fiveStars = page.locator('[name="rating"][value="10"]');
  await fiveStars.press("Space");
  await expect(selectedRating).toHaveCount(0);
  await fiveStars.check();
  await fiveStars.click();
  await expect(selectedRating).toHaveCount(0);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(entry.locator(".unrated-label")).toHaveText("Unrated");
  await expect(page.locator(".detail-rating .rating")).toHaveAttribute(
    "aria-label",
    "4 out of 5 stars",
  );
});

test("unchanged dialog dismisses with Escape and restores focus", async ({
  page,
}) => {
  await openAlbum(page);
  const opener = page.locator('[data-action="edit"]');
  await opener.click();
  await expect(page.locator("#editor")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#editor")).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test("unfinished album edits recover after reload without changing saved data", async ({
  page,
}) => {
  await openAlbum(page);
  const title = await page.locator("#page-title").textContent();
  await page.locator('[data-action="edit"]').click();
  await page.locator('[name="title"]').fill("Unfinished regression draft");
  await expect(page.locator("[data-draft-status]")).toHaveText(
    "Draft saved on this device",
  );
  await reloadDemo(page);
  await expect(page.locator('[name="title"]')).toHaveValue(
    "Unfinished regression draft",
  );
  await expect(page.locator("#page-title")).toHaveText(title!);
  await page.locator('#album-form [data-action="close"]').click();
  await page.locator("[data-draft-discard]").click();
  await page.locator('[data-action="edit"]').click();
  await expect(page.locator('[name="title"]')).toHaveValue(title!);
});

test("new genre associations survive reload and remain in the catalog after removal", async ({
  page,
}) => {
  await openAlbum(page);
  await page.locator('[data-action="edit"]').click();
  await page.locator("#genre-query").fill("Regression genre");
  await page.locator('[data-action="create-genre"]').click();
  await expect(page.locator("#genre-selected")).toContainText(
    "Regression genre",
  );
  await page.locator('#album-form button[type="submit"]').click();
  await expect(page.locator("#editor")).not.toBeVisible();
  await reloadDemo(page);
  const genre = page.getByRole("link", {
    name: "Regression genre",
    exact: true,
  });
  await expect(genre).toBeVisible();
  const genreHash = await genre.getAttribute("href");
  await page.locator('[data-action="edit"]').click();
  await page
    .getByRole("button", { name: "Remove Regression genre", exact: true })
    .click();
  await page.locator('#album-form button[type="submit"]').click();
  await expect(page.locator("#editor")).not.toBeVisible();
  await reloadDemo(page);
  await expect(genre).toHaveCount(0);
  await page.goto("/" + genreHash);
  await expect(page.locator("#page-title")).toHaveText("Regression genre");
});

test("metadata search can retry a failure and review an import before saving", async ({
  page,
}) => {
  let requests = 0;
  const wikipediaUrl =
    "https://en.wikipedia.org/wiki/Regression_import_(album)";
  await page.route("https://en.wikipedia.org/w/api.php*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("action") === "parse") {
      await route.fulfill({ json: { parse: { text: "" } } });
      return;
    }
    if (params.get("generator") === "search") {
      expect(params.get("gsrsearch")).toBe(
        'Regression import hastemplate:"Infobox album"',
      );
      expect(params.get("gsrnamespace")).toBe("0");
      requests++;
      if (requests === 1) {
        await route.fulfill({ status: 503, body: "unavailable" });
        return;
      }
      await route.fulfill({
        json: {
          query: {
            pages: [
              {
                title: "Regression import",
                index: 1,
                pageprops: { disambiguation: "" },
              },
              {
                title: "Regression import (album)",
                index: 2,
                extract: "Album by Regression artist",
              },
            ],
          },
        },
      });
      return;
    }

    expect(params.get("titles")).toBe("Regression import (album)");
    await route.fulfill({
      json: {
        query: {
          pages: [
            {
              title: "Regression import (album)",
              pageprops: { wikibase_item: "Q1" },
            },
          ],
        },
      },
    });
  });
  await page.route("https://www.wikidata.org/w/api.php*", async (route) => {
    const ids = new URL(route.request().url()).searchParams.get("ids");
    await route.fulfill({
      json: {
        entities:
          ids === "Q1"
            ? {
                Q1: {
                  claims: {
                    P175: [
                      { mainsnak: { datavalue: { value: { id: "Q2" } } } },
                    ],
                  },
                },
              }
            : { Q2: { labels: { en: { value: "Regression artist" } } } },
      },
    });
  });
  await page.locator("#top-add").click();
  await page.locator("#catalog-query").fill("Regression import");
  await expect(page.locator("#catalog-count")).toHaveText("Search failed");
  await page.locator('[data-action="retry-search"]').click();
  await expect(page.locator("#catalog-count")).toHaveText("1 result");
  await expect(page.locator('[data-action="pick"]')).toContainText(
    "Album by Regression artist",
  );
  await page.locator('[data-action="pick"]').click();
  await expect(page.locator('[name="title"]')).toHaveValue("Regression import");
  await expect(page.locator("#artist-selected")).toContainText(
    "Regression artist",
  );
  await page.locator('[name="title"]').fill("Reviewed regression import");
  await page.locator('#album-form button[type="submit"]').click();
  await expect(page.locator("#editor")).not.toBeVisible();
  await reloadDemo(page);
  await expect(page.locator("#page-title")).toHaveText(
    "Reviewed regression import",
  );
  await expect(page.locator("main")).toContainText("Regression artist");
  await expect(
    page.locator("main").getByRole("link", { name: "Wikipedia" }),
  ).toHaveAttribute("href", wikipediaUrl);
  expect(requests).toBe(2);
});

test("dirty editor supports continue, keep, resume, and discard", async ({
  page,
}) => {
  await openAlbum(page);
  await page.locator('[data-action="edit"]').click();
  await page.locator('[name="title"]').fill("Kept draft");
  const editorClose = page.locator('#album-form [data-action="close"]');
  const prompt = page.getByRole("dialog", { name: "Unsaved changes" });
  const continueEditing = prompt.getByRole("button", {
    name: "Continue editing",
  });

  await editorClose.click();
  await expect(continueEditing).toBeFocused();
  await expect(prompt.locator(".draft-actions")).toHaveCSS(
    "flex-direction",
    page.viewportSize()!.width <= 420 ? "column-reverse" : "row",
  );
  await page.mouse.click(1, 1);
  await expect(prompt).toBeVisible();
  await continueEditing.click();
  await expect(prompt).not.toBeVisible();
  await expect(editorClose).toBeFocused();
  await expect(page.locator('[name="title"]')).toHaveValue("Kept draft");

  await editorClose.click();
  await page.keyboard.press("Escape");
  await expect(prompt).not.toBeVisible();
  await expect(page.locator('[name="title"]')).toHaveValue("Kept draft");

  await page.mouse.click(1, 1);
  await expect(prompt).toBeVisible();
  await page.locator("[data-draft-keep]").click();
  await expect(page.locator("#editor")).not.toBeVisible();
  const toast = page.locator("#toast");
  await expect(toast).toHaveText("Draft kept on this device.");
  await page.getByRole("button", { name: "Resume draft" }).click();
  await expect(toast).toHaveText("Restored from draft.");
  await expect(page.locator('[name="title"]')).toHaveValue("Kept draft");
  await page.locator('#album-form [data-action="close"]').click();
  await page.locator("[data-draft-discard]").click();
  await expect(
    page.getByRole("button", { name: "Resume draft" }),
  ).not.toBeVisible();
});

test("draft toast stays above the editor and unsaved changes popup", async ({
  page,
}) => {
  await openAlbum(page);
  const edit = page.locator('[data-action="edit"]');
  const close = page.locator('#album-form [data-action="close"]');
  const toast = page.locator("#toast");

  await edit.click();
  await page.locator('[name="title"]').fill("Kept draft");
  await close.click();
  await page.locator("[data-draft-keep]").click();

  // Trying to start another edit restores the existing draft and shows a toast.
  await edit.click();
  await expect(toast).toContainText("Restored from draft.");
  await expect(
    page.locator("#editor").getByRole("status").filter({
      hasText: "Restored from draft.",
    }),
  ).toBeVisible();

  await close.click();
  const prompt = page.getByRole("dialog", { name: "Unsaved changes" });
  await expect(prompt.getByRole("status")).toBeVisible();
  await expect(toast).toHaveCSS("opacity", "1");

  // Temporarily enable hit testing to check the toast paints above the backdrop.
  expect(
    await toast.evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      element.style.pointerEvents = "auto";
      const hit = document.elementFromPoint(x + width / 2, y + height / 2);
      element.style.removeProperty("pointer-events");
      return element.contains(hit);
    }),
  ).toBe(true);

  await page.keyboard.press("Escape");
  await expect(page.locator("#editor #toast")).toBeVisible();
  await close.click();
  await page.locator("[data-draft-discard]").click();
  await expect(page.locator("#app > #toast")).toBeVisible();
});

test("navigation retains an unfinished edit", async ({ page }) => {
  await openAlbum(page);
  await page.locator('[data-action="edit"]').click();
  await page.locator('[name="title"]').fill("Navigation draft");
  await page.evaluate(() => {
    location.hash = "#artists";
  });
  await expect(page.locator("#editor")).not.toBeVisible();
  await page.getByRole("button", { name: "Resume draft" }).click();
  await expect(page.locator('[name="title"]')).toHaveValue("Navigation draft");
});

test("Tab wraps within the editor and backdrop drags do not dismiss", async ({
  page,
}) => {
  await openAlbum(page);
  await page.locator('[data-action="edit"]').click();
  const first = page.locator("#editor .close");
  const last = page.locator('#album-form button[type="submit"]');
  await last.focus();
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(last).toBeFocused();
  const bounds = await page.locator("#editor").boundingBox();
  await page.mouse.move(bounds!.x + 20, bounds!.y + 20);
  await page.mouse.down();
  await page.mouse.move(1, 1);
  await page.mouse.up();
  await expect(page.locator("#editor")).toBeVisible();
  await page.mouse.click(1, 1);
  await expect(page.locator("#editor")).not.toBeVisible();
});

test("picker accepts keyboard and pointer selection once", async ({
  page,
  isMobile,
}) => {
  await openAlbum(page);
  await page.locator('[data-action="edit"]').click();
  await page.locator("#genre-query").fill("Keyboard genre");
  await page.keyboard.press("Enter");
  await expect(page.locator("#genre-selected")).toContainText("Keyboard genre");
  await page.locator("#genre-query").fill("Pointer genre");
  const option = page.locator('[data-action="create-genre"]');
  if (isMobile) await option.tap();
  else await option.click();
  await expect(
    page.getByRole("button", { name: "Remove Pointer genre", exact: true }),
  ).toHaveCount(1);
});

test("blocked draft storage keeps the dirty editor open", async ({ page }) => {
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  await openAlbum(page);
  await page.locator('[data-action="edit"]').click();
  await page.locator('[name="title"]').fill("Unsaved draft");
  await expect(page.locator("[data-draft-status]")).toHaveText(
    "Draft could not be saved on this device",
  );
  await page.locator('#album-form [data-action="close"]').click();
  await page.locator("[data-draft-keep]").click();
  await expect(
    page.getByRole("dialog", { name: "Unsaved changes" }).getByRole("alert"),
  ).toHaveText("Couldn’t save the draft on this device.");
  await expect(page.locator("#editor")).toBeVisible();
  await page.locator("[data-draft-discard]").click();
});

test("drafts from another account do not restore in demo mode", async ({
  page,
}) => {
  await openAlbum(page);
  await page.locator('[data-action="edit"]').click();
  await page.locator('[name="title"]').fill("Private account draft");
  await expect(page.locator("[data-draft-status]")).toHaveText(
    "Draft saved on this device",
  );
  await page.evaluate(() => {
    localStorage.setItem(
      "sleeve:editor-draft:v1:other-account",
      localStorage.getItem("sleeve:editor-draft:v1:demo")!,
    );
    localStorage.removeItem("sleeve:editor-draft:v1:demo");
    // Prevent pagehide from saving the demo edit again.
    document.querySelector<HTMLDialogElement>("#editor")!.close();
  });
  await reloadDemo(page);
  await expect(page.locator("#editor")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resume draft" }),
  ).not.toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("sleeve:editor-draft:v1:other-account"),
    ),
  ).toContain("Private account draft");
});

test("dialog mount and disposal remove listeners and queued work", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    // Load the same module as the application through Vite.
    const modulePath = "/src/app/dialog.ts";
    const { Dialog } = await import(/* @vite-ignore */ modulePath);
    const editor = document.createElement("dialog");
    document.body.append(editor);
    let dismissals = 0;
    let rendered = 0;
    const options = {
      editor,
      main: document.querySelector("main")!,
      formState: () => "",
      onRendered: () => {
        rendered++;
      },
      dismissDialog: () => {
        dismissals++;
      },
      updateArtists: () => {},
      updateGenres: () => {},
      onClose: () => {},
      routeHash: () => location.hash,
    };
    const first = new Dialog(options);
    first.mount();
    first.mount();
    editor.dispatchEvent(new Event("cancel", { cancelable: true }));
    first.showDialog("Test", "", "#dialog-title");
    first.dispose();
    editor.close();
    await Promise.resolve();
    editor.dispatchEvent(new Event("cancel", { cancelable: true }));
    const second = new Dialog(options);
    second.mount();
    editor.dispatchEvent(new Event("cancel", { cancelable: true }));
    second.dispose();
    editor.remove();
    return { dismissals, rendered };
  });
  expect(result).toEqual({ dismissals: 2, rendered: 0 });
});

test("listening edits and deletion persist independently of other entries", async ({
  page,
}) => {
  await openAlbum(page);
  await page.locator('[data-action="listen"]').first().click();
  await page.locator('[name="rating"][value="6"]').check();
  await page.locator("#listening-notes").fill("Entry to edit");
  await page.locator('#listen-form button[type="submit"]').click();
  await page
    .locator('[data-action="edit-listen"]')
    .filter({ hasText: "Entry to edit" })
    .click();
  await page.locator('[name="rating"][value="9"]').check();
  await page.locator("#listening-notes").fill("Edited entry");
  await page.locator('#listen-form button[type="submit"]').click();
  await reloadDemo(page);
  const entries = page.locator('[data-action="edit-listen"]');
  const count = await entries.count();
  await entries.filter({ hasText: "Edited entry" }).click();
  await expect(page.locator('[name="rating"][value="9"]')).toBeChecked();
  await page.getByText("Delete listening entry", { exact: true }).click();
  await page.locator('[data-action="delete-listen"]').click();
  await expect(page.locator("#editor")).not.toBeVisible();
  await reloadDemo(page);
  await expect(entries).toHaveCount(count - 1);
  await expect(page.getByText("Edited entry", { exact: true })).toHaveCount(0);
});

test("artist countries link to a shareable Library filter with collaboration matches", async ({
  page,
}) => {
  const album = mockAlbums[0];
  const japan = {
    ...album.artists[0],
    country: " jp ",
    name: "Country test artist",
  };
  const taiwan = {
    ...japan,
    id: "country-test-taiwan",
    country: "TW",
    name: "Country test collaborator",
    role: "featured",
    position: 1,
  };
  const albums = [
    { ...album, title: "Country test collaboration", artists: [japan, taiwan] },
    {
      ...album,
      id: "country-test-album-tw",
      title: "Country test Taiwan solo",
      artists: [{ ...taiwan, role: "primary", position: 0 }],
      genres: [],
    },
    {
      ...album,
      id: "country-test-album-unknown",
      title: "Country test unknown origin",
      artists: [],
      genres: [],
    },
  ];
  const otherArtist = {
    ...taiwan,
    id: "country-test-extra",
    name: "Country test extra",
  };
  await page.evaluate(
    (data) => {
      localStorage.setItem("sleeve-demo-v1", JSON.stringify(data));
    },
    { albums, artists: [otherArtist] },
  );
  await reloadDemo(page);

  await page.locator('[data-nav="artists"]').click();
  await page.getByRole("button", { name: "Add artist" }).click();
  const countryInput = page.getByRole("combobox", { name: "Country" });
  await countryInput.click();
  const options = page
    .getByRole("listbox", { name: "Countries" })
    .getByRole("option");
  await expect(options.nth(0)).toHaveText("Taiwan");
  await expect(options.nth(1)).toHaveText("Japan");
  await expect(options.nth(2)).toHaveText("Afghanistan");
  await countryInput.press("Escape");
  await expect(countryInput).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Escape");

  const filters = page.locator(
    '.library-toolbar summary[aria-label^="Filters"]',
  );
  await filters.click();
  await page
    .getByRole("searchbox", { name: "Search artist countries" })
    .fill("Taiwan");
  await page.getByRole("button", { name: "Add Taiwan" }).click();
  await expect(filters).toHaveAccessibleName("Filters, 1 active");
  await expect(page.locator("#artists-count")).toHaveText("2 artists");
  const genre = album.genres[0].name;
  await page.getByRole("searchbox", { name: "Search genres" }).fill(genre);
  await page.getByRole("button", { name: `Add ${genre}`, exact: true }).click();
  await expect(page.locator("#artists-count")).toHaveText("1 artist");
  const artistRow = page.locator(".artist-catalog-row");
  const artistName = artistRow.locator(".artist-catalog-name");
  const flag = artistRow.getByRole("img", { name: "Taiwan" }).locator("img");
  await expect(artistName).toHaveText("Country test collaborator");
  await expect(artistName).toHaveCSS("font-size", "16px");
  await expect(flag).toHaveCSS("height", "13px");
  const nameBox = (await artistName.boundingBox())!;
  const flagBox = (await flag.boundingBox())!;
  expect(flagBox.y + flagBox.height / 2).toBeCloseTo(
    nameBox.y + nameBox.height / 2,
  );
  await expect(
    page.getByRole("button", { name: "Remove Genre filter" }),
  ).toHaveText(genre);
  await page
    .locator(".library-filter-controls")
    .getByRole("button", { name: "Clear filters" })
    .click();
  await expect(filters).toHaveAccessibleName("Filters");
  await expect(page.locator("#artists-count")).toHaveText("3 artists");

  await page.locator('summary[aria-label="Sort artists"]').click();
  const alphabetical = page.locator(
    '[data-action="artist-sort"][data-sort="name"]',
  );
  const names = page.locator(".artist-catalog-name");
  await expect(alphabetical).toHaveAccessibleName("Alphabetical, ascending");
  await expect(names.first()).toHaveText("Country test artist");
  await alphabetical.click();
  await expect(alphabetical).toHaveAccessibleName("Alphabetical, descending");
  await expect(names.first()).toHaveText("Country test extra");
  await alphabetical.click();
  await expect(alphabetical).toHaveAccessibleName("Alphabetical, off");
  await expect(names.first()).toHaveText("Country test artist");
  const albumCount = page.getByRole("button", { name: /^Album count,/ });
  await albumCount.click();
  await expect(albumCount).toHaveAccessibleName("Album count, ascending");
  await expect(names.first()).toHaveText("Country test extra");
  await albumCount.click();
  await expect(albumCount).toHaveAccessibleName("Album count, descending");
  await expect(names.first()).toHaveText("Country test collaborator");
  await page.getByRole("button", { name: "Last logged, off" }).click();
  await expect(names.last()).toHaveText("Country test extra");
  await page.getByRole("button", { name: "Last updated, off" }).click();
  await expect(
    page.getByRole("button", { name: "Last logged, off" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.locator("#artists-search").fill("Taiwan");
  await expect(page.locator("#artists-count")).toHaveText("2 artists");
  const collaborator = page.getByRole("link", {
    name: /Country test collaborator/,
  });
  await expect(collaborator.getByRole("img", { name: "Taiwan" })).toBeVisible();
  await expect(
    collaborator.getByText("2 albums", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("link", { name: /Country test extra/ })
      .getByText("0 albums", { exact: true }),
  ).toBeVisible();
  const row = await collaborator.boundingBox();
  expect(row?.height).toBeLessThanOrEqual(56);
  await collaborator.click();
  await page
    .getByRole("link", { name: "Browse albums by artists from Taiwan" })
    .click();
  await expect(page).toHaveURL(/#library\?country=TW$/);
  await expect(page.locator("#library-count")).toHaveText("2 of 3 albums");
  await expect(
    page.getByRole("button", { name: "Remove Country filter" }),
  ).toHaveText("Taiwan");

  await page.locator('.library-toolbar summary[aria-label^="Filters"]').click();
  const countries = page.getByRole("group", {
    name: "Country suggestions",
  });
  await countries.getByRole("button", { name: "Add Japan" }).click();
  await expect(page.locator("#library-count")).toHaveText("2 of 3 albums");
  await expect(page).toHaveURL(/country=TW&country=JP$/);

  await reloadDemo(page);
  await expect(page.locator("#library-count")).toHaveText("2 of 3 albums");
  await page.getByRole("button", { name: "Remove Country filter" }).click();
  await expect(page.locator("#library-count")).toHaveText("3 albums");
});

test("album artwork URL aligns with its preview and restores it from draft", async ({
  page,
}) => {
  await openAlbum(page);
  await page.locator('[data-action="edit"]').click();
  const form = page.locator("#album-form");
  const artwork = form.getByRole("textbox", { name: "Artwork URL" });
  const preview = form.locator(".catalog-image-preview");

  await expect(form.getByText(/Paste an image URL/)).toHaveCount(0);
  const inputBounds = (await artwork.boundingBox())!;
  const previewBounds = (await preview.boundingBox())!;
  expect(previewBounds.y).toBe(inputBounds.y);
  expect(previewBounds.height).toBe(inputBounds.height);
  expect(previewBounds.x).toBeGreaterThan(inputBounds.x + inputBounds.width);

  const url = "https://example.test/cover.svg";
  await page.route(url, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: /* HTML */ `<svg
        xmlns="http://www.w3.org/2000/svg"
        width="39"
        height="39"
      ></svg>`,
    }),
  );
  await artwork.fill(url);
  await expect(preview.locator("img")).toHaveAttribute("src", url);

  await form.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Keep draft" }).click();
  await page.getByRole("button", { name: "Resume draft" }).click();
  await expect(artwork).toHaveValue(url);
  await expect(preview.locator("img")).toHaveAttribute("src", url);
});

test("instrument rows sort by usage and filter by category", async ({
  page,
}) => {
  await page.goto("/#instruments");
  const rows = page.locator(".instrument-catalog-row");
  const counts = await rows.locator(".catalog-row-count").allTextContents();
  expect(counts.length).toBeGreaterThan(1);
  const usage = counts.map((count) => Number.parseInt(count, 10));
  expect(usage).toEqual([...usage].sort((a, b) => b - a));

  expect((await rows.first().boundingBox())?.height).toBeLessThanOrEqual(56);
  expect(
    (await rows.first().locator(".catalog-image").boundingBox())?.width,
  ).toBe(42);

  await page.locator('summary[aria-label="Sort instruments"]').click();
  const count = page.getByRole("button", { name: "Album count, descending" });
  await expect(count).toBeVisible();
  await page.getByRole("button", { name: "Alphabetical, off" }).click();
  const names = await rows.locator(".catalog-row-name").allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  await page.keyboard.press("Escape");

  const filters = page.locator(".genre-filter-dropdown summary");
  await filters.click();
  const clearFilters = page
    .locator(".genre-filter-panel")
    .getByRole("button", { name: "Clear filters" });
  expect((await clearFilters.boundingBox())?.height).toBe(28);
  const search = page.getByRole("searchbox", {
    name: "Search categories",
  });
  await search.fill("wood");
  await page.getByRole("button", { name: "Add Woodwind" }).click();
  await expect(rows).toHaveCount(2);
  await search.fill("keyboard");
  await page.getByRole("button", { name: "Add Keyboard" }).click();
  await expect(rows).toHaveCount(5);
  await expect(filters).toHaveAccessibleName("Filters, 1 active");
  await page.getByRole("button", { name: "Remove Woodwind" }).click();
  await expect(rows).toHaveCount(3);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Remove Category filter" }).click();
  await expect(rows).toHaveCount(counts.length);
});

test("catalog artist and instrument editors validate and retain details", async ({
  page,
}) => {
  await page.goto("/#artists");
  await page.locator('[data-action="new-catalog-artist"]').click();
  const form = page.locator("#catalog-artist-form");
  await expect(form.getByLabel("Sort name")).toHaveCount(0);
  await expect(form.getByLabel("MusicBrainz artist ID")).toHaveCount(0);
  const photo = form.getByRole("textbox", { name: "Photo URL" });
  const preview = form.locator(".catalog-image-preview");
  await expect(form.getByText(/Paste an image URL/)).toHaveCount(0);
  const inputBounds = (await photo.boundingBox())!;
  const previewBounds = (await preview.boundingBox())!;
  expect(previewBounds.height).toBe(inputBounds.height);
  expect(previewBounds.y).toBe(inputBounds.y);

  const spacing = await form.locator(".dialog-body").evaluate((body) => {
    const [artistName, photoField, countryField, hint] = [...body.children]
      .slice(0, 4)
      .map((field) => field.getBoundingClientRect());
    return [
      photoField.top - artistName.bottom,
      countryField.top - photoField.bottom,
      hint.top - countryField.bottom,
    ];
  });
  expect(spacing).toEqual([spacing[2], spacing[2], spacing[2]]);

  await page.locator('[name="artistName"]').fill("Catalog regression artist");
  const countryField = page.getByRole("combobox", { name: "Country" });
  await countryField.fill("Great Britain");
  const country = page.getByRole("option", {
    name: "United Kingdom",
    exact: true,
  });
  await expect(country.locator("img")).toHaveAttribute("src", "/flags/gb.svg");
  await countryField.press("ArrowDown");
  await countryField.press("Enter");
  await expect(countryField).toHaveValue("United Kingdom");
  await page.locator('#catalog-artist-form button[type="submit"]').click();
  await expect(page.locator("#page-title")).toHaveText(
    "Catalog regression artist",
  );
  const musicbrainzId = "abcdef12-1234-1234-1234-123456789012";
  await page.evaluate((musicbrainzId) => {
    const key = "sleeve-demo-v1";
    const snapshot = JSON.parse(localStorage.getItem(key)!);
    const artist = snapshot.artists.find(
      ({ name }) => name === "Catalog regression artist",
    );
    artist.sortName = "Regression artist, Catalog";
    artist.musicbrainzId = musicbrainzId;
    localStorage.setItem(key, JSON.stringify(snapshot));
  }, musicbrainzId);
  await reloadDemo(page);
  await page.locator('[data-action="edit-catalog-artist"]').click();
  await expect(countryField).toHaveValue("United Kingdom");
  await page.getByRole("button", { name: "Clear country" }).click();
  await expect(countryField).toHaveValue("");
  await page.locator('#catalog-artist-form button[type="submit"]').click();
  await expect(
    page.getByRole("link", { name: /Browse albums by artists from/ }),
  ).toHaveCount(0);
  const savedArtist = await page.evaluate(() => {
    const snapshot = JSON.parse(localStorage.getItem("sleeve-demo-v1")!);
    return snapshot.artists.find(
      ({ name }) => name === "Catalog regression artist",
    );
  });
  expect(savedArtist.sortName).toBe("Regression artist, Catalog");
  expect(savedArtist.musicbrainzId).toBe(musicbrainzId);
  await page.goto("/#instruments");
  await page.locator('[data-action="new-catalog-instrument"]').click();
  await page
    .locator('[name="instrumentName"]')
    .fill("Catalog regression instrument");
  const category = page.locator('[name="category"]').first();
  const categoryValue = await category.inputValue();
  await category.check();
  await page.locator('#catalog-instrument-form button[type="submit"]').click();
  await expect(page.locator("#page-title")).toHaveText(
    "Catalog regression instrument",
  );
  await reloadDemo(page);
  await page.locator('[data-action="edit-catalog-instrument"]').click();
  await expect(
    page.locator(`[name="category"][value="${categoryValue}"]`),
  ).toBeChecked();
  await page
    .locator('[name="instrumentName"]')
    .fill("Renamed regression instrument");
  await page.locator('#catalog-instrument-form button[type="submit"]').click();
  await expect(page.locator("#page-title")).toHaveText(
    "Renamed regression instrument",
  );
});

test("artists without album credits can be deleted from their detail page", async ({
  page,
}) => {
  await page.goto("/#artists");
  await page
    .locator(".artist-catalog-row")
    .filter({ hasText: /\b[1-9]\d* albums?\b/ })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Delete artist", exact: true }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Back to artists" }).click();
  await page.locator('[data-action="new-catalog-artist"]').click();
  await page
    .getByRole("textbox", { name: "Artist name" })
    .fill("Unused artist");
  await page.getByRole("button", { name: "Save artist" }).click();
  await expect(page.locator("#page-title")).toHaveText("Unused artist");
  await expect(page.getByText("No albums yet")).toHaveCount(0);

  await page.getByRole("button", { name: "Edit artist" }).click();
  const editor = page.getByRole("dialog", { name: "Edit artist" });
  await expect(editor.getByText(/Delete artist/)).toHaveCount(0);
  await editor.getByRole("button", { name: "Cancel" }).click();

  const deleteArtist = page.getByRole("button", { name: "Delete artist" });
  const confirmation = page.getByRole("dialog", { name: "Delete artist?" });
  await deleteArtist.click();
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator("#page-title")).toHaveText("Unused artist");

  await deleteArtist.click();
  await confirmation.getByRole("button", { name: "Delete artist" }).click();
  await expect(page).toHaveURL(/#artists$/);
  await reloadDemo(page);
  await expect(page.getByRole("link", { name: /Unused artist/ })).toHaveCount(
    0,
  );
});

test("artist and instrument draft selections stay separate from committed catalogs", async ({
  page,
}) => {
  await openAlbum(page);
  await page.locator('[data-action="edit"]').click();
  await page.locator("#artist-query").fill("Draft only artist");
  await page.locator('[data-action="create-artist"]').click();
  await page.locator("#instrument-query").fill("Draft only instrument");
  await page.locator('[data-action="create-instrument"]').click();
  await reloadDemo(page);
  await expect(page.locator("#artist-selected")).toContainText(
    "Draft only artist",
  );
  await expect(page.locator("#instrument-selected")).toContainText(
    "Draft only instrument",
  );
  await page.locator('#album-form [data-action="close"]').click();
  await page.locator("[data-draft-discard]").click();
  await page.goto("/#artists");
  await page.locator("#artists-search").fill("Draft only artist");
  await expect(page.locator('main a[href^="#artist/"]')).toHaveCount(0);
  await page.goto("/#instruments");
  await page.locator("#instruments-search").fill("Draft only instrument");
  await expect(page.locator('main a[href^="#instrument/"]')).toHaveCount(0);
});

test("a delayed metadata result cannot replace a manual editor", async ({
  page,
}) => {
  let release!: () => void;
  let requested!: () => void;
  const waiting = new Promise<void>((resolve) => {
    requested = resolve;
  });
  const response = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("https://en.wikipedia.org/w/api.php*", async (route) => {
    requested();
    await response;
    await route.fulfill({ json: { query: { pages: [] } } });
  });
  await page.locator("#top-add").click();
  await page.locator("#catalog-query").fill("Delayed search");
  await waiting;
  await page.locator('[data-action="manual"]').click();
  await page.locator('[name="title"]').fill("Manual editor survives");
  const completed = page.waitForResponse("https://en.wikipedia.org/w/api.php*");
  release();
  await completed;
  await expect(page.locator('[name="title"]')).toHaveValue(
    "Manual editor survives",
  );
  await page.locator('#album-form button[type="submit"]').click();
  await expect(page.locator("#page-title")).toHaveText(
    "Manual editor survives",
  );
});

test("route previews match live lists and remounting handles each save once", async ({
  page,
}) => {
  // Start at the auth screen so this test owns the controller lifecycle.
  await page.goto("/");
  const previews = await page.evaluate(async () => {
    const appPath = "/src/app/app.ts";
    const controllerPath = "/src/app/controller.ts";
    const { renderApp } = await import(/* @vite-ignore */ appPath);
    const { initializeApp } = await import(/* @vite-ignore */ controllerPath);
    document.querySelector("#app")!.innerHTML = renderApp();
    const first = initializeApp();
    const results = [];
    for (const hash of ["#artists", "#genres", "#instruments", "#"]) {
      const changed = new Promise<void>((resolve) =>
        window.addEventListener("hashchange", () => resolve(), { once: true }),
      );
      location.hash = hash;
      await changed;
      const preview = first.renderPreview(hash);
      const live = document
        .querySelector("main")!
        .cloneNode(true) as HTMLElement;
      live.querySelector("#page-title")?.removeAttribute("tabindex");
      live
        .querySelectorAll("[id]")
        .forEach((element) => element.removeAttribute("id"));
      results.push({
        hash,
        same: preview.innerHTML === live.innerHTML,
        inert: preview.inert,
        hidden: preview.getAttribute("aria-hidden"),
        ids: preview.querySelectorAll("[id]").length,
      });
    }
    first.dispose();
    first.dispose();
    initializeApp();
    return results;
  });
  for (const preview of previews) {
    expect(preview).toEqual({
      hash: preview.hash,
      same: true,
      inert: true,
      hidden: "true",
      ids: 0,
    });
  }
  await openAlbum(page);
  await page.locator('[data-action="listen"]').first().click();
  await page.locator('[name="rating"][value="8"]').check();
  await page.locator("#listening-notes").fill("Saved once after remount");
  await page.locator('#listen-form button[type="submit"]').click();
  await expect(page.locator("#editor")).not.toBeVisible();
  await expect(
    page
      .locator('[data-action="edit-listen"]')
      .filter({ hasText: "Saved once after remount" }),
  ).toHaveCount(1);
});

test("artist roles and order recover from drafts and survive save and removal", async ({
  page,
  isMobile,
}) => {
  await openAlbum(page);
  await page.locator('[data-action="edit"]').click();
  const originalNames = await page
    .locator("#artist-selected strong")
    .allTextContents();
  for (const name of ["First draft artist", "Second draft artist"]) {
    await page.locator("#artist-query").fill(name);
    const create = page.locator('[data-action="create-artist"]');
    if (isMobile) await create.tap();
    else await create.click();
  }

  const first = page
    .locator(".artist-credit-row")
    .filter({ hasText: "First draft artist" });
  await first.locator("select").selectOption("featured");
  await page
    .getByRole("button", {
      name: "Move Second draft artist earlier",
      exact: true,
    })
    .click();
  const expectedNames = [
    ...originalNames,
    "Second draft artist",
    "First draft artist",
  ];
  await expect(page.locator("#artist-selected strong")).toHaveText(
    expectedNames,
  );

  await reloadDemo(page);
  await expect(page.locator("#artist-selected strong")).toHaveText(
    expectedNames,
  );
  await expect(first.locator("select")).toHaveValue("featured");
  await page.locator('#album-form button[type="submit"]').click();
  await expect(page.locator("#editor")).not.toBeVisible();

  await reloadDemo(page);
  await page.locator('[data-action="edit"]').click();
  await expect(page.locator("#artist-selected strong")).toHaveText(
    expectedNames,
  );
  await expect(first.locator("select")).toHaveValue("featured");
  await page
    .getByRole("button", { name: "Remove First draft artist", exact: true })
    .click();
  await page.locator('#album-form button[type="submit"]').click();
  await expect(page.locator("#editor")).not.toBeVisible();

  await reloadDemo(page);
  await page.locator('[data-action="edit"]').click();
  await expect(page.locator("#artist-selected strong")).toHaveText([
    ...originalNames,
    "Second draft artist",
  ]);
});

test("genres show the catalog count and update it during search", async ({
  page,
}) => {
  await page.goto("/#genres");
  const count = page.locator("#genres-count");
  await expect(count).toHaveText(/^[1-9]\d* genres$/, { useInnerText: true });
  const total = await count.innerText();

  const search = page.getByRole("searchbox", { name: "Search genres" });
  await search.fill("Japanese Fusion");
  await expect(count).toHaveText("1 genre");
  await search.fill("no-such-genre-xyz");
  await expect(count).toHaveText("0 genres");
  await search.clear();
  await expect(count).toHaveText(total);
});

test("long parent genre names fit the picker on narrow screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const name = "VeryLongGenreName".repeat(4);
  await page.goto("/#genres");
  await page.locator('[data-action="new-catalog-genre"]').click();
  await page.locator('[name="genreName"]').fill(name);
  await page.locator('#catalog-genre-form button[type="submit"]').click();
  await expect(page.locator("#page-title")).toHaveText(name);

  await page.goto("/#genres");
  await page.locator('[data-action="new-catalog-genre"]').click();
  await page.locator('[name="genreName"]').fill("Child genre");
  await page.getByRole("checkbox", { name, exact: true }).check();
  await page.locator('#catalog-genre-form button[type="submit"]').click();
  await expect(page.locator("#page-title")).toHaveText("Child genre");

  await page.goto("/#genres");
  await page.locator('[data-action="new-catalog-genre"]').click();
  const options = page.locator("#genre-parent-options");
  await expect(
    options.getByRole("checkbox", { name: "Child genre", exact: true }),
  ).toBeVisible();
  expect(
    await options.evaluate((list) => list.scrollWidth - list.clientWidth),
  ).toBe(0);
  expect(
    await options.evaluate((list) => list.getBoundingClientRect().right),
  ).toBeLessThanOrEqual(320);
});

test("genre graph preserves explicit tags, shares branches, and prevents cycles", async ({
  page,
}) => {
  const genreHashes: string[] = [];
  for (const name of ["Graph Jazz", "Graph House", "Graph Jazz House"]) {
    await page.goto("/#genres");
    await page.locator('[data-action="new-catalog-genre"]').click();
    await page.locator('[name="genreName"]').fill(name);
    await page.locator('#catalog-genre-form button[type="submit"]').click();
    await expect(page.locator("#page-title")).toHaveText(name);
    genreHashes.push(new URL(page.url()).hash);
  }

  await page.goto("/#");
  await openAlbum(page);
  const albumHash = new URL(page.url()).hash;
  for (const names of [["Graph Jazz", "Graph Jazz House"]]) {
    await page.locator('[data-action="edit"]').click();
    for (const name of names) {
      await page.locator("#genre-query").fill(name);
      await page
        .locator("#genre-results")
        .getByRole("button", { name, exact: true })
        .click();
    }
    await page.locator('#album-form button[type="submit"]').click();
    await expect(page.locator("#editor")).not.toBeVisible();
  }

  await page.goto("/" + genreHashes[2]);
  await page.locator('[data-action="edit-catalog-genre"]').click();
  await page.getByRole("checkbox", { name: "Graph Jazz", exact: true }).check();
  await page
    .getByRole("checkbox", { name: "Graph House", exact: true })
    .check();
  // Both parent selections survive a draft reload.
  await reloadDemo(page);
  await expect(
    page.getByRole("checkbox", { name: "Graph Jazz", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Graph House", exact: true }),
  ).toBeChecked();
  await page.locator('#catalog-genre-form button[type="submit"]').click();
  await expect(page.locator("#editor")).not.toBeVisible();
  await expect(page.locator(".genre-breadcrumb")).toContainText("Graph Jazz");
  await expect(page.locator(".genre-breadcrumb")).toContainText("Graph House");
  await expect(page.locator(".genre-breadcrumb-path")).toHaveText([
    "Graph House › Graph Jazz House",
    "Graph Jazz › Graph Jazz House",
  ]);
  await expect(
    page.locator(".genre-title h1 + .genre-breadcrumb"),
  ).toBeVisible();
  await page
    .locator(".genre-breadcrumb")
    .getByRole("link", { name: "Graph House", exact: true })
    .click();
  await expect(page.locator("#page-title")).toHaveText("Graph House");
  await page.goto("/" + genreHashes[2]);

  await reloadDemo(page);
  await page.goto("/" + albumHash);
  await page.locator('[data-action="edit"]').click();
  await expect(page.locator("#genre-selected")).toContainText(
    "Graph Jazz House",
  );
  await expect(
    page.locator("#genre-selected strong").filter({ hasText: /^Graph Jazz$/ }),
  ).toHaveCount(1);
  await page.keyboard.press("Escape");

  for (const hash of genreHashes.slice(0, 2)) {
    await page.goto("/" + hash);
    await expect(
      page.locator(`.genre-albums a[href="${albumHash}"]`),
    ).toHaveCount(1);
    await page.locator('[data-action="edit-catalog-genre"]').click();
    await expect(
      page.getByRole("checkbox", { name: "Graph Jazz House", exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
  }

  await page.goto("/#genres");
  for (const name of ["Graph Jazz", "Graph House"]) {
    await page
      .locator("summary")
      .filter({ has: page.getByText(name, { exact: true }) })
      .click();
  }
  await expect(
    page.locator(`.genre-tree a[href="${genreHashes[2]}"]`),
  ).toHaveCount(2);

  await page.locator('[data-action="new-catalog-genre"]').click();
  const parentNames = await page
    .locator(".genre-parent-name")
    .allTextContents();
  const roots = parentNames.filter((name) => name !== "Graph Jazz House");
  expect(parentNames).toEqual([
    ...roots.sort((a, b) => a.localeCompare(b)),
    "Graph Jazz House",
  ]);
  const fusionOption = page.locator(".genre-parent-option").filter({
    has: page.getByRole("checkbox", {
      name: "Graph Jazz House",
      exact: true,
    }),
  });
  await expect(fusionOption.locator(".genre-parent-path")).toHaveText([
    "Graph House › Graph Jazz House",
    "Graph Jazz › Graph Jazz House",
  ]);
  await fusionOption.locator(".genre-parent-path").first().click();
  await expect(fusionOption.getByRole("checkbox")).toBeChecked();
  await fusionOption.locator(".genre-parent-name").click();
  await expect(fusionOption.getByRole("checkbox")).not.toBeChecked();
  await page.locator("#genre-parent-search").fill("Graph");
  await expect(page.locator(".genre-parent-option:visible")).toHaveCount(3);
  await page
    .getByRole("checkbox", { name: "Graph House", exact: true })
    .check();
  await page.locator("#genre-parent-search").fill("Graph Jazz");
  await expect(
    page.getByRole("checkbox", {
      name: "Graph House",
      exact: true,
      includeHidden: true,
    }),
  ).toBeChecked();
});

test("dedicated instrument editor restores draft categories and commits only on save", async ({
  page,
}) => {
  await openAlbum(page);
  await page.locator('[data-action="edit-instruments"]').click();
  await page.locator("#instrument-query").fill("Draft category instrument");
  const category = page.locator('[name="inline-category"]').first();
  const categoryValue = await category.inputValue();
  await category.check();
  await page.locator('[data-action="create-instrument"]').click();
  await expect(page.locator("#instrument-selected")).toContainText(
    "Draft category instrument",
  );

  await reloadDemo(page);
  await expect(page.locator("#instruments-form")).toBeVisible();
  await expect(page.locator("#instrument-selected")).toContainText(
    "Draft category instrument",
  );
  await page.locator('#instruments-form button[type="submit"]').click();
  await expect(page.locator("#editor")).not.toBeVisible();

  await reloadDemo(page);
  await page.locator('[data-action="edit-instruments"]').click();
  await expect(page.locator("#instrument-selected")).toContainText(
    "Draft category instrument",
  );
  await page
    .getByRole("button", {
      name: "Remove Draft category instrument",
      exact: true,
    })
    .click();
  await page.locator('#instruments-form button[type="submit"]').click();
  await expect(page.locator("#editor")).not.toBeVisible();

  await page.goto("/#instruments");
  await page.locator("#instruments-search").fill("Draft category instrument");
  await page.locator('main a[href^="#instrument/"]').click();
  await page.locator('[data-action="edit-catalog-instrument"]').click();
  await expect(
    page.locator(`[name="category"][value="${categoryValue}"]`),
  ).toBeChecked();
});

test("malformed persisted draft selections do not prevent opening a new editor", async ({
  page,
}) => {
  await openAlbum(page);
  const title = await page.locator("#page-title").textContent();
  await page.locator('[data-action="edit"]').click();
  await page.locator('[name="title"]').fill("Damaged draft");
  await expect(page.locator("[data-draft-status]")).toHaveText(
    "Draft saved on this device",
  );
  await page.evaluate(() => {
    const key = "sleeve:editor-draft:v1:demo";
    const saved = JSON.parse(localStorage.getItem(key)!);
    saved.artists = [null];
    sessionStorage.setItem("damaged-draft", JSON.stringify(saved));
  });
  // Install after pagehide so capturing the old editor cannot repair the payload.
  await page.addInitScript(() => {
    const saved = sessionStorage.getItem("damaged-draft");
    if (saved) localStorage.setItem("sleeve:editor-draft:v1:demo", saved);
  });
  await reloadDemo(page);
  await expect(page.getByRole("button", { name: "Resume draft" })).toBeHidden();
  await page.locator('[data-action="edit"]').click();
  await expect(page.locator('[name="title"]')).toHaveValue(title!);
});

test("vinyl collection and wishlist filters follow saved status and clear correctly", async ({
  page,
}) => {
  await openAlbum(page);
  const title = await page.locator("#page-title").textContent();
  const albumHash = await page.evaluate(() => location.hash);
  for (const status of ["wishlisted", "owned", ""]) {
    await page.locator("#vinyl-status-button").click();
    await page
      .locator(`[data-action="set-vinyl-status"][data-status="${status}"]`)
      .click();
    await expect(page.locator("#vinyl-status-options")).not.toBeVisible();
    await reloadDemo(page);
    if (status)
      await expect(page.locator("#vinyl-status-text")).toHaveText(
        status === "owned" ? "Owned" : "Wishlist",
      );
    await page.evaluate(() => {
      location.hash = "";
    });
    const card = page.locator(`.album-card[href="${albumHash}"]`);
    for (const layout of ["grid", "list"]) {
      await page
        .locator(`[data-action="layout"][data-layout="${layout}"]`)
        .click();
      const badge = card.locator(".album-title .album-vinyl-status");
      if (status) {
        await expect(badge).toBeVisible();
        await expect(badge).toHaveAccessibleName(
          status === "owned" ? "Owned on vinyl" : "Vinyl wishlist",
        );
        const titleBox = await card.locator("strong").boundingBox();
        const badgeBox = await badge.boundingBox();
        expect(badgeBox!.x).toBeGreaterThanOrEqual(
          titleBox!.x + titleBox!.width,
        );
      } else await expect(badge).toHaveCount(0);
    }
    const filters = page.locator(".genre-filter-dropdown");
    await filters.locator("summary").click();
    await page
      .locator(
        `input[name="library-vinyl-status"][value="${status || "owned"}"]`,
      )
      .check();
    const results = page.locator("#library-results");
    if (status) {
      await expect(results).toContainText(title!);
      await expect(page.locator("#library-count")).toContainText("1 of");
      await filters.locator("summary").click();
      await page.locator("#library-query").fill("no-such-vinyl-title");
      await expect(results).toContainText("No matching albums");
      await page
        .getByRole("button", { name: "Clear filters", exact: true })
        .click();
      await expect(page.locator("#library-query")).toHaveValue("");
      await filters.locator("summary").click();
      await expect(
        page.locator('input[name="library-vinyl-status"]:checked'),
      ).toHaveCount(0);
      await page
        .locator(
          `input[name="library-vinyl-status"][value="${status === "owned" ? "wishlisted" : "owned"}"]`,
        )
        .check();
    }
    await expect(results).toContainText("No matching albums");
    await page.goto("/" + albumHash);
    await expect(page.locator("#page-title")).toHaveText(title!);
  }
});

test("vinyl artwork supports keyboard dismissal, current choices, and album edits", async ({
  page,
  isMobile,
}) => {
  await openAlbum(page);
  const change = page.locator("#vinyl-status-button");
  const status = page.locator("#vinyl-status-text");
  const options = page.locator("#vinyl-status-options");
  await expect(status).toHaveText("Not tracked");
  await expect(page.locator(".album-artwork .album-vinyl")).toHaveCount(0);
  await expect(change).toHaveAccessibleName("Track vinyl: Not tracked");
  await change.focus();
  await page.keyboard.press("Enter");
  await expect(options).toBeVisible();
  await expect(
    options.getByRole("button", { name: "Clear status" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(options).not.toBeVisible();
  await expect(change).toBeFocused();
  await change.click();
  await page.locator("#page-title").click();
  await expect(options).not.toBeVisible();
  await change.click();
  await options.getByRole("button", { name: "Add to wishlist" }).click();
  await expect(status).toHaveText("Wishlist");
  await expect(change).toHaveAccessibleName("Track vinyl: Wishlist");
  const disc = page.locator(".album-artwork .album-vinyl");
  if (isMobile) await expect(disc).toBeHidden();
  else {
    await expect(disc).toBeVisible();
    await expect(disc).toHaveCSS("position", "absolute");
    await expect(disc).toHaveCSS("border-radius", "50%");
    const sleeve = await page.locator(".album-sleeve").boundingBox();
    const record = await disc.boundingBox();
    const heart = await page.locator(".album-vinyl-wish").boundingBox();
    expect(record!.width).toBeGreaterThan(0);
    expect(record!.height).toBeCloseTo(record!.width, 0);
    expect(record!.x).toBeGreaterThan(sleeve!.x);
    expect(record!.x).toBeLessThan(sleeve!.x + sleeve!.width);
    expect(record!.x + record!.width).toBeGreaterThan(
      sleeve!.x + sleeve!.width,
    );
    expect(heart!.x).toBeGreaterThan(sleeve!.x + sleeve!.width);
    expect(heart!.x + heart!.width).toBeLessThanOrEqual(
      record!.x + record!.width,
    );
    expect(heart!.y + heart!.height / 2).toBeCloseTo(
      record!.y + record!.height / 2,
      0,
    );
    await page.locator(".album-artwork").hover();
    await expect(disc).toHaveCSS("transform", "none");
  }
  await expect(change).toBeFocused();
  await change.click();
  await expect(
    options.getByRole("button", { name: "Add to wishlist" }),
  ).toHaveAttribute("aria-pressed", "true");
  await options.getByRole("button", { name: "Mark as owned" }).click();
  await expect(status).toHaveText("Owned");
  await expect(change).toHaveAccessibleName("Track vinyl: Owned");
  if (isMobile) await expect(disc).toBeHidden();
  else await expect(disc).toBeVisible();
  const sleeveBox = await page.locator(".album-sleeve").boundingBox();
  const buttonBox = await change.boundingBox();
  expect(sleeveBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();
  expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(
    sleeveBox!.x + sleeveBox!.width,
  );
  expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(
    sleeveBox!.y + sleeveBox!.height,
  );
  await expect(page.locator(".album-vinyl-wish")).toHaveCount(0);
  await page.locator('[data-action="edit"]').click();
  await expect(page.locator('[name="vinylStatus"]')).toHaveCount(0);
  await page.locator('[name="label"]').fill("Updated label");
  await page.locator('#album-form button[type="submit"]').click();
  await reloadDemo(page);
  await expect(status).toHaveText("Owned");
  await change.click();
  await expect(
    options.getByRole("button", { name: "Mark as owned" }),
  ).toHaveAttribute("aria-pressed", "true");
  await options.getByRole("button", { name: "Clear status" }).click();
  await reloadDemo(page);
  await expect(status).toHaveText("Not tracked");
});

test("artist links survive drafts and can be edited and removed", async ({
  page,
  isMobile,
}) => {
  await page.locator('[data-nav="artists"]').click();
  await page.getByRole("button", { name: "Add artist" }).click();
  const form = page.locator("#catalog-artist-form");
  const addLink = form.getByRole("button", { name: "Add link", exact: true });
  const urls = form.getByRole("textbox", { name: "URL", exact: true });
  const labels = form.getByRole("textbox", { name: "Label", exact: true });
  const save = form.getByRole("button", { name: "Save artist" });
  const wikipedia = "https://en.wikipedia.org/wiki/Alice_Coltrane";
  const appleMusic = "https://music.apple.com/us/artist/alice-coltrane/485970";

  await form.getByLabel("Artist name").fill("Artist links test");
  await form.getByRole("combobox", { name: "Country" }).fill("USA");
  await form
    .getByRole("option", { name: "United States", exact: true })
    .click();
  await addLink.click();
  await urls.nth(0).fill(wikipedia);
  await addLink.click();
  await urls.nth(1).fill(wikipedia);
  await save.click();
  await expect(form.getByRole("alert")).toHaveText(
    "Each link must have a different URL.",
  );
  await urls.nth(1).fill(appleMusic);
  await addLink.click();
  await urls.nth(2).fill("https://example.com/bio");
  await addLink.click();
  const discogs = "https://www.discogs.com/artist/29986-Alice-Coltrane";
  await urls.nth(3).fill(discogs);

  await reloadDemo(page);
  await expect(urls.nth(0)).toHaveValue(wikipedia);
  await expect(urls.nth(1)).toHaveValue(appleMusic);
  await save.click();

  const links = page.getByRole("group", { name: "Artist links", exact: true });
  const appleMusicLink = links.getByRole("link", { name: /Apple Music/ });
  await expect(links.getByRole("link").first()).toHaveAttribute(
    "href",
    appleMusic,
  );
  const wikipediaLink = links.getByRole("link", { name: /Wikipedia/ });
  await expect(wikipediaLink).toHaveAttribute("href", wikipedia);
  await expect(links.getByRole("heading")).toHaveCount(0);
  const label = wikipediaLink.getByText("Wikipedia");
  await expect(label).toBeHidden();
  const button = await wikipediaLink.boundingBox();
  expect(button!.width).toBe(isMobile ? 28 : 22);
  const header = page.locator(".artist-page-heading");
  const portrait = await header.locator(".artist-portrait").boundingBox();
  const headerBox = await header.boundingBox();
  expect(portrait!.y + portrait!.height / 2).toBeCloseTo(
    headerBox!.y + headerBox!.height / 2,
    1,
  );
  if (!isMobile) {
    await wikipediaLink.hover();
    await expect(label).toBeVisible();
    const tooltip = await label.boundingBox();
    expect(tooltip!.width).toBeGreaterThan(button!.width);
    expect(button!.y - (tooltip!.y + tooltip!.height)).toBeGreaterThanOrEqual(
      4,
    );
    expect(tooltip!.x + tooltip!.width / 2).toBeCloseTo(
      button!.x + button!.width / 2,
      1,
    );
    await page.mouse.move(0, 0);
    await page.getByRole("link", { name: "Back to artists" }).focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", {
        name: "Browse albums by artists from United States",
      }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(appleMusicLink).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(wikipediaLink).toBeFocused();
    await expect(label).toBeVisible();
  }
  await expect(
    links.getByRole("link", { name: /Apple Music/ }),
  ).toHaveAttribute("href", appleMusic);

  const countryFlag = page.getByRole("link", {
    name: "Browse albums by artists from United States",
  });
  await expect(countryFlag).toHaveAttribute("href", "#library?country=US");
  await expect(countryFlag.locator("img")).toHaveAttribute(
    "src",
    "/flags/us.svg",
  );
  await expect(countryFlag).toHaveText("");
  const flagBounds = await countryFlag.locator("img").boundingBox();
  expect(flagBounds!.width).toBe(button!.width - 2);
  expect(flagBounds!.height).toBe(button!.height - 2);
  await expect(countryFlag.locator("img")).toHaveCSS("border-radius", "50%");
  const divider = page
    .locator(".artist-details")
    .getByText("·", { exact: true });
  await expect(divider).toBeVisible();
  await expect(page.locator(".artist-page-heading .catalog-stats")).toHaveCount(
    0,
  );
  await expect(links.getByRole("link", { name: /Discogs/ })).toHaveAttribute(
    "href",
    discogs,
  );
  const extra = links.getByRole("link", { name: /example.com/ });
  await expect(extra).toBeHidden();
  await links.getByLabel("More links").click();
  await expect(extra).toBeVisible();

  await page.getByRole("button", { name: "Edit artist" }).click();
  await form
    .getByRole("button", { name: "Remove link", exact: true })
    .nth(3)
    .click();
  await form
    .getByRole("button", { name: "Remove link", exact: true })
    .nth(2)
    .click();
  await labels.nth(0).fill("Biography");
  await form
    .getByRole("button", { name: "Remove link", exact: true })
    .nth(1)
    .click();
  await save.click();
  await reloadDemo(page);
  await expect(links.getByRole("link")).toHaveCount(1);
  await expect(links.getByRole("link", { name: /Biography/ })).toHaveAttribute(
    "href",
    wikipedia,
  );

  await page.getByRole("button", { name: "Edit artist" }).click();
  await form.getByRole("button", { name: "Remove link", exact: true }).click();
  await save.click();
  await expect(links).toHaveCount(0);
  await expect(divider).toHaveCount(0);
});
