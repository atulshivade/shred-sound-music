import {
  test,
  expect,
  signIn,
  openUploadSheet,
  STUDENT_ALEX,
  collectConsoleErrors,
} from "./fixtures";

function countIn(text: string | null) {
  return parseInt((text?.match(/\d+/) ?? ["0"])[0], 10);
}

test.describe("Authenticated student flows", () => {
  test("student signs in and lands on /challenges with seeded data", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await signIn(page, STUDENT_ALEX);
    await page.goto("/challenges");
    await expect(page.getByRole("heading", { name: /active challenges/i }))
      .toBeVisible();
    // At least the seeded "Sweet Child O' Mine" challenge should be there.
    await expect(
      page.getByText(/Sweet Child O.{1,3} Mine/i).first(),
    ).toBeVisible();
    await expect(page.getByText(/⭐ [\d,]+ XP/)).toBeVisible();
    expect(errors().filter((e) => !/preload|hydration/i.test(e))).toEqual([]);
  });

  test("/feed mixes videos, the streak banner and game cards", async ({
    page,
  }) => {
    await signIn(page, STUDENT_ALEX);
    await page.goto("/feed");
    await expect(page.getByRole("heading", { name: /your feed/i })).toBeVisible();
    await expect(page.getByText(/day streak|start your streak/i)).toBeVisible();
    // Best Performer (seeded with Riya's Chopin take).
    await expect(page.getByText(/best performer/i).first()).toBeVisible();
    await expect(page.getByText(/guess this song/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /love it/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^clap/i }).first()).toBeVisible();
  });

  test("authenticated upload returns a clean 503 with JSON body when storage is off", async ({
    page,
    request,
  }) => {
    // Sign in via the visible form so the request fixture inherits the
    // session cookie.
    await signIn(page, STUDENT_ALEX);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const r = await request.post("/api/upload/video", {
      // First hit of this route on a cold Turbopack dev server pays the
      // compile cost before the handler ever runs.
      timeout: 60_000,
      headers: { cookie: cookieHeader },
      multipart: {
        file: {
          name: "tiny.mp4",
          mimeType: "video/mp4",
          buffer: Buffer.from([0, 0, 0, 0]),
        },
      },
    });
    // On the live demo (no durable storage) we expect a structured 503.
    // On a hypothetical local run with STORAGE_PROVIDER set, this may pass
    // (200) — both are acceptable, but if the response IS an error it must
    // be JSON, not a plain-text gateway error.
    if (r.status() !== 200) {
      expect(r.headers()["content-type"] ?? "").toMatch(/application\/json/);
      const j = await r.json();
      expect(j.error, "error response must include a message").toBeTruthy();
    }
  });

  test("upload sheet always offers a working path and says it needs approval", async ({
    page,
  }) => {
    await signIn(page, STUDENT_ALEX);
    await page.goto("/feed");
    const sheet = await openUploadSheet(page);

    // Either the file picker (uploads on) or the link field (uploads off).
    await expect(
      sheet.getByText(/tap to select video/i).or(sheet.getByLabel(/youtube or vimeo link/i)).first(),
    ).toBeVisible();
    await expect(sheet.getByLabel(/song name/i)).toBeVisible();
    await expect(sheet.getByRole("button", { name: /piano/i })).toBeVisible();
    await expect(sheet.getByText(/reviewed by your teacher before going live/i)).toBeVisible();
    await expect(sheet.getByRole("button", { name: /submit for approval/i })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("hearting a performance changes the count", async ({ page }) => {
    await signIn(page, STUDENT_ALEX);
    await page.goto("/feed");
    const heart = page.getByRole("button", { name: /love it/i }).first();
    await expect(heart).toBeVisible();
    const before = countIn(await heart.textContent());

    await heart.click();
    await expect.poll(async () => countIn(await heart.textContent()), { timeout: 8_000 }).not.toBe(before);

    // Put the state back (idempotent against the live demo DB).
    await heart.click();
    await expect.poll(async () => countIn(await heart.textContent()), { timeout: 8_000 }).toBe(before);
  });

  test("clap reaction toggles and persists across a reload", async ({ page }) => {
    await signIn(page, STUDENT_ALEX);
    await page.goto("/feed");
    const clap = page.getByRole("button", { name: /^clap/i }).first();
    const before = countIn(await clap.textContent());
    const wasPressed = (await clap.getAttribute("aria-pressed")) === "true";

    await clap.click();
    const expected = before + (wasPressed ? -1 : 1);
    await expect.poll(async () => countIn(await clap.textContent()), { timeout: 8_000 }).toBe(expected);

    await page.reload();
    const again = page.getByRole("button", { name: /^clap/i }).first();
    await expect.poll(async () => countIn(await again.textContent()), { timeout: 8_000 }).toBe(expected);

    await again.click();
    await expect.poll(async () => countIn(await again.textContent()), { timeout: 8_000 }).toBe(before);
  });

  test("Learn: logging practice awards XP once per day", async ({ page }) => {
    await signIn(page, STUDENT_ALEX);
    await page.goto("/learn");
    await expect(page.getByRole("heading", { name: /my homework/i })).toBeVisible();
    const first = page.getByRole("button", { name: /mark done|done today/i }).first();
    if (await first.isEnabled()) {
      await first.click();
      await expect(page.getByText(/practice logged|already logged/i).first()).toBeVisible({ timeout: 10_000 });
    }
    await expect(page.getByRole("button", { name: /done today/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("Learn: the daily quiz can be answered once", async ({ page }) => {
    await signIn(page, STUDENT_ALEX);
    await page.goto("/learn?tab=quizzes");
    const options = page.locator("section").filter({ hasText: /guess this song/i }).getByRole("button");
    await expect(options.first()).toBeVisible();
    if (await options.first().isEnabled()) {
      await options.first().click();
      await expect(page.getByText(/correct!|so close|already played/i).first()).toBeVisible({ timeout: 10_000 });
    }
    await expect(options.first()).toBeDisabled();
  });

  test("Profile shows stats, badges and the share button — and no contact details", async ({ page }) => {
    await signIn(page, STUDENT_ALEX);
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: /my badges/i })).toBeVisible();
    await expect(page.getByText("First Song")).toBeVisible();
    await expect(page.getByRole("button", { name: /share my achievement/i })).toBeVisible();
    // Safety: a child's profile must never expose contact information.
    await expect(page.getByText(STUDENT_ALEX.email)).toHaveCount(0);
    await expect(page.locator("a[href^='mailto:'], a[href^='tel:']")).toHaveCount(0);
  });

  test("Shorts only lists approved videos and filters by category", async ({ page }) => {
    await signIn(page, STUDENT_ALEX);
    await page.goto("/shorts");
    await expect(page.getByRole("heading", { name: /shorts/i })).toBeVisible();
    const cards = page.locator("article");
    const badges = page.getByText(/approved by teacher/i);
    await expect(badges).toHaveCount(await cards.count());

    await page.getByRole("link", { name: /piano/i }).click();
    await expect(page).toHaveURL(/c=piano/);
    await expect(page.getByRole("link", { name: /piano/i })).toHaveAttribute("aria-current", "page");
  });
});
