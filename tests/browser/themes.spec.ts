import { test, expect } from "@playwright/test";

const palettes = {
  editorial: "rgb(245, 241, 232)",
  sage: "rgb(24, 27, 23)",
  walnut: "rgb(35, 26, 21)",
  prism: "rgb(16, 17, 24)",
  nocturne: "rgb(33, 19, 28)",
  soul: "rgb(226, 187, 130)",
};

test("themes switch immediately, style every page, and persist through refresh", async ({
  page,
}) => {
  await page.goto("/#profile");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "walnut");
  await page.locator("#auth-demo").click();
  await expect(page.locator("#theme-select option")).toHaveText([
    "Walnut",
    "Sage",
    "Prism",
    "Soul",
    "Nocturne",
    "Editorial",
  ]);

  for (const [theme, background] of Object.entries(palettes)) {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.locator("#theme-select").selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      background,
    );
    await expect(page.locator(".chart-bar").first()).toHaveCSS(
      "background-color",
      await page
        .locator("html")
        .evaluate((el) =>
          getComputedStyle(el).getPropertyValue("--color-accent").trim(),
        )
        .then((hex) => {
          const color = hex.replace("#", "");
          return `rgb(${[0, 2, 4].map((i) => parseInt(color.slice(i, i + 2), 16)).join(", ")})`;
        }),
    );
    await expect(page.locator(".masthead")).toHaveCSS(
      "background-image",
      "none",
    );
    for (const selector of [".button.primary", ".chart-bar"]) {
      await expect(page.locator(selector).first()).toHaveCSS(
        "background-image",
        theme === "prism" ? /linear-gradient/ : "none",
      );
    }

    expect(
      await page.evaluate(() => localStorage.getItem("sleeve-theme")),
    ).toBe(theme);

    await page.reload();
    // Theme applies on the auth screen too, before entering the library.
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      background,
    );
    await page.locator("#auth-demo").click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.locator("#theme-select")).toHaveValue(theme);
    await expect(page.locator("#page-title")).toHaveCSS(
      "font-family",
      /^("?Newsreader"?|Georgia|"?Inter"?|"?Space Grotesk"?|"?Cormorant Garamond"?|"?Fraunces"?)/,
    );
    await page.screenshot({
      path: `test-results/theme-${theme}-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page.locator("#theme-select").focus();
    await expect(page.locator("#theme-select")).toHaveCSS(
      "outline-style",
      "solid",
    );

    await page.getByRole("button", { name: "Close settings" }).click();

    for (const destination of ["artists", "genres", "instruments", ""]) {
      await page.evaluate((hash) => {
        location.hash = hash;
      }, destination);
      await expect(page.locator("#page-title")).toBeVisible();
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        background,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    if (theme === "soul") {
      await page
        .getByRole("button", { name: "List view", exact: true })
        .click();
      await expect(page.locator(".album-list .album-card").first()).toHaveCSS(
        "background-color",
        "rgba(0, 0, 0, 0)",
      );
      await page.screenshot({
        path: `test-results/theme-soul-list-${test.info().project.name}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Grid view", exact: true })
        .click();
    }

    await page.locator('a[href^="#album/"]').first().click();
    await expect(page.locator(".album-artwork")).toBeVisible();
    const starFill = page.locator(".detail-rating .star-fill").first();
    await expect(starFill).toBeVisible();
    const starGradient = await starFill.evaluate(
      (el) => getComputedStyle(el, "::after").backgroundImage,
    );
    if (theme === "prism") {
      expect(starGradient).toMatch(/linear-gradient/);
      const positions = await page
        .locator(".detail-rating .star-fill")
        .evaluateAll((stars) =>
          stars.map(
            (star) => getComputedStyle(star, "::after").backgroundPositionX,
          ),
        );
      expect(positions).toEqual(["0%", "25%", "50%", "75%", "100%"]);
      expect(
        await starFill.evaluate(
          (el) => getComputedStyle(el, "::after").maskImage,
        ),
      ).toContain("data:image/svg+xml");
    } else expect(starGradient).toBe("none");
    await page.screenshot({
      path: `test-results/theme-${theme}-ratings-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page.locator('[data-action="edit"]').click();
    await expect(page.locator("#editor")).toBeVisible();
    const expected = await page.locator("html").evaluate((el) => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = "var(--color-surface-raised)";
      el.append(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    });
    await expect(page.locator("#editor")).toHaveCSS(
      "background-color",
      expected,
    );
    await page.keyboard.press("Escape");
    await expect(page.locator("#editor")).toBeHidden();
    await page.getByRole("link", { name: "Profile", exact: true }).click();
  }
});

test("invalid stored themes and unavailable storage use a usable default", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("sleeve-theme", "invalid"),
  );
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "walnut");
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("Storage blocked");
    };
    Storage.prototype.setItem = () => {
      throw new Error("Storage blocked");
    };
  });
  await page.goto("/#profile");
  await page.locator("#auth-demo").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "walnut");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.locator("#theme-select").selectOption("prism");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "prism");
});

for (const removedTheme of ["midnight", "modern"]) {
  test(`removed ${removedTheme} preference falls back to Walnut`, async ({
    page,
  }) => {
    await page.addInitScript((theme) => {
      localStorage.setItem("sleeve-theme", theme);
    }, removedTheme);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "walnut");
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      palettes.walnut,
    );
  });
}

test("saved Retro preferences load Soul", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sleeve-theme", "retro"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "soul");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    palettes.soul,
  );
});
