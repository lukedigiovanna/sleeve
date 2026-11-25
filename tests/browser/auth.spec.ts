import { test, expect, type Page } from "@playwright/test";

async function mountAuth(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(async () => {
    const path = "/src/views/authView.ts";
    const { AuthView, renderAuthView } = await import(/* @vite-ignore */ path);
    const root = document.createElement("div");
    document.body.append(root);
    document.querySelector("#app")!.remove();
    root.innerHTML = renderAuthView();
    const fixture = window as any;
    fixture.entries = [];
    fixture.credentials = [];
    fixture.authView = new AuthView(root, {
      enterLibrary: (authenticated?: boolean) =>
        fixture.entries.push(authenticated ?? false),
      authenticate: (...args: unknown[]) => {
        fixture.credentials.push(args);
        return new Promise((resolve, reject) => {
          fixture.finishAuth = resolve;
          fixture.failAuth = reject;
        });
      },
    });
  });
}

async function submit(page: Page): Promise<void> {
  await page.locator("#auth-email").fill("listener@example.com");
  await page.locator("#auth-password").fill("secret-password");
  await page.locator('[type="submit"]').click();
  await expect(page.locator("#auth-form")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#auth-demo")).toBeDisabled();
}

test("sign-in and demo entry retain their distinct navigation contracts", async ({
  page,
}) => {
  await mountAuth(page);
  await page.locator("#auth-demo").click();
  expect(await page.evaluate(() => (window as any).entries)).toEqual([false]);
  const email = page.locator("#auth-email");
  const regularBorder = await email.evaluate(
    (input) => getComputedStyle(input).borderColor,
  );
  await email.focus();
  await expect(email).toHaveCSS("outline-style", "none");
  await expect(email).not.toHaveCSS("border-color", regularBorder);
  await submit(page);
  await page.evaluate(() => (window as any).finishAuth({ session: {} }));
  await expect(page.locator('[type="submit"]')).toBeEnabled();
  expect(await page.evaluate(() => (window as any).entries)).toEqual([
    false,
    true,
  ]);
  expect(await page.evaluate(() => (window as any).credentials)).toEqual([
    ["signin", "listener@example.com", "secret-password"],
  ]);
});

test("sign-up confirmation clears the password and allows sign-in retry", async ({
  page,
}) => {
  await mountAuth(page);
  await page.locator('[data-auth-mode="signup"]').click();
  await expect(page.locator("#auth-password")).toHaveAttribute(
    "minlength",
    "8",
  );
  await submit(page);
  await page.evaluate(() => (window as any).finishAuth({ session: null }));
  await expect(page.locator("#auth-status")).toContainText("Check your email");
  await expect(page.locator("#auth-password")).toHaveValue("");
  expect(await page.evaluate(() => (window as any).entries)).toEqual([]);
  await page.locator('[data-auth-mode="signin"]').click();
  await submit(page);
  await page.evaluate(() => (window as any).finishAuth({ session: null }));
  await expect(page.locator("#auth-status")).toContainText(
    "did not create a session",
  );
  await expect(page.locator('[type="submit"]')).toBeEnabled();
});

for (const outcome of ["success", "failure"]) {
  test(`pending ${outcome} cannot update a disposed or replacement auth view`, async ({
    page,
  }) => {
    await mountAuth(page);
    await submit(page);
    await page.evaluate((outcome) => {
      const fixture = window as any;
      fixture.authView.dispose();
      fixture.oldForm = document.querySelector("#auth-form");
      fixture.oldStatus = document.querySelector("#auth-status");
      fixture.oldForm.parentElement.innerHTML =
        '<p id="replacement">Replacement view</p>';
      if (outcome === "success") fixture.finishAuth({ session: {} });
      else fixture.failAuth(new Error("Late failure"));
    }, outcome);
    await expect(page.locator("#replacement")).toHaveText("Replacement view");
    expect(
      await page.evaluate(() => {
        const fixture = window as any;
        fixture.oldForm.dispatchEvent(
          new Event("submit", { cancelable: true }),
        );
        return {
          entries: fixture.entries,
          submissions: fixture.credentials.length,
          status: fixture.oldStatus.textContent,
          busy: fixture.oldForm.getAttribute("aria-busy"),
        };
      }),
    ).toEqual({ entries: [], submissions: 1, status: "", busy: "true" });
  });
}
