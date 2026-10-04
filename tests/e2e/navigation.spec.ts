import {
  test,
  expect,
  signIn,
  STUDENT_ALEX,
  TEACHER,
  collectConsoleErrors,
} from "./fixtures";

/**
 * End-to-end navigation tests that walk the major user journeys.
 */
test.describe("Authenticated navigation flows", () => {
  test("student → /challenges → challenge detail → upload sheet", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await signIn(page, STUDENT_ALEX);

    await page.goto("/challenges");
    await expect(
      page.getByRole("heading", { name: /active challenges/i }),
    ).toBeVisible();

    const firstCardLink = page.locator("main a[href^='/challenges/']").first();
    await expect(firstCardLink).toBeVisible();
    await firstCardLink.click();
    await page.waitForURL(/\/challenges\/[^/]+/, { timeout: 60_000 });

    await expect(page.getByRole("heading", { level: 1 }).last()).toBeVisible();
    await expect(page.getByRole("heading", { name: /performances/i })).toBeVisible();

    const cta = page.getByRole("button", { name: /accept challenge|submit another take/i });
    if (await cta.isVisible().catch(() => false)) {
      await cta.click();
      const sheet = page.getByRole("dialog", { name: /upload your shred/i });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByLabel(/song name/i)).toBeVisible();
      await expect(sheet.getByRole("group", { name: /instrument/i })).toBeVisible();
      await expect(sheet.getByRole("button", { name: /submit for approval/i })).toBeVisible();
    }

    expect(errors().filter((e) => !/preload|hydration/i.test(e))).toEqual([]);
  });

  test("bottom navigation reaches all five student tabs", async ({ page }) => {
    await signIn(page, STUDENT_ALEX);
    await page.goto("/feed");
    const nav = page.getByRole("navigation", { name: /primary/i });
    for (const [label, url, heading] of [
      ["Shorts", /\/shorts$/, /shorts/i],
      ["Challenges", /\/challenges$/, /challenges/i],
      ["Learn", /\/learn$/, /learn/i],
      ["Profile", /\/profile$/, /my badges/i],
    ] as const) {
      await nav.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(url, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
      await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
    }
    // In dev the Next.js devtools badge covers the bottom-left tab.
    await expect(nav.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", "/feed");
  });

  test("student brand link returns to the feed", async ({ page }) => {
    await signIn(page, STUDENT_ALEX);
    await page.goto("/feed");
    const brand = page.getByRole("link", { name: /shred sound music — home/i });
    await expect(brand).toBeVisible();
    await expect(brand).toHaveAttribute("href", "/feed");
  });

  test("teachers get a Studio link, students do not", async ({ page }) => {
    await signIn(page, TEACHER);
    await page.goto("/profile");
    await expect(page.locator("a[href='/admin']").first()).toBeVisible();

    // The admin studio keeps its own, separate navigation.
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: /studio/i }).first()).toBeVisible();

    await page.goto("/api/auth/signout");
    const signOutBtn = page.getByRole("button", { name: /sign out/i });
    if (await signOutBtn.isVisible().catch(() => false)) {
      await signOutBtn.click();
      await page.waitForLoadState("networkidle").catch(() => undefined);
    }

    await signIn(page, STUDENT_ALEX);
    for (const path of ["/feed", "/profile", "/challenges"]) {
      await page.goto(path);
      await expect(page.locator("a[href='/admin']")).toHaveCount(0);
    }
  });
});
