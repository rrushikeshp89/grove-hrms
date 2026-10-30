import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { retryUntil, signInAs } from "./helpers";

async function seriousViolations(page: Page) {
  await page.waitForTimeout(1500);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id}: ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(" | ")}`,
    );
}

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

async function openUpload(page: Page) {
  await retryUntil(
    () => page.getByRole("button", { name: "Upload", exact: true }).first().click(),
    () =>
      expect(page.getByRole("dialog", { name: "Upload a document" })).toBeVisible({
        timeout: 1000,
      }),
  );
  return page.getByRole("dialog", { name: "Upload a document" });
}

test.describe("documents", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.skip(({ isMobile }) => isMobile, "changes shared data; desktop runs the flow once");

  let href = "";

  test("someone uploads a file to their own folder and can open it", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/documents");
    await expect(page.getByRole("heading", { name: "Your folder" })).toBeVisible();
    const sheet = await openUpload(page);
    await sheet
      .getByLabel("File")
      .setInputFiles({ name: "salary-proof-2026.pdf", mimeType: "application/pdf", buffer: PDF });
    await expect(sheet.getByLabel("Name")).toHaveValue("salary proof 2026");
    await sheet.getByRole("button", { name: "Upload", exact: true }).click();
    await expect(page.getByText("Document added")).toBeVisible();

    const link = page.getByRole("link", { name: "Open salary proof 2026" });
    await expect(link).toBeVisible();
    href = (await link.getAttribute("href"))!;
    const res = await page.request.get(href);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("a colleague, even a manager, gets nothing", async ({ page }) => {
    await signInAs(page, "TEAM_MANAGER");
    expect((await page.request.get(href)).status()).toBe(404);
    await signInAs(page, "HR_MANAGER");
    expect((await page.request.get(href)).status()).toBe(200);
  });

  test("HR can open anyone's folder from the People tab", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/documents?view=people");
    await expect(page.getByText("Choose someone to open their folder")).toBeVisible();
    await retryUntil(
      () => page.getByRole("combobox", { name: "Whose folder" }).click(),
      () => expect(page.getByPlaceholder("Search people")).toBeVisible({ timeout: 1000 }),
    );
    await page.getByPlaceholder("Search people").fill("Arjun Mehta");
    await expect(page.getByRole("option", { name: /Arjun Mehta/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Arjun Mehta's folder" })).toBeVisible();
    await expect(page.getByText("Employment agreement")).toBeVisible();
    await expect(page.getByText("salary proof 2026")).toBeVisible();
  });

  test("uploads are checked before they're sent", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/documents");
    const sheet = await openUpload(page);
    await sheet.getByLabel("File").setInputFiles({
      name: "installer.exe",
      mimeType: "application/x-msdownload",
      buffer: Buffer.from("MZ"),
    });
    await expect(sheet.getByText("Upload a PDF, image, Word, Excel or text file.")).toBeVisible();
    await sheet
      .getByLabel("File")
      .setInputFiles({ name: "photo.png", mimeType: "application/pdf", buffer: Buffer.from("x") });
    await expect(sheet.getByText("That doesn't look like a .png file.")).toBeVisible();
    await sheet
      .getByLabel("File")
      .setInputFiles({ name: "empty.txt", mimeType: "text/plain", buffer: Buffer.alloc(0) });
    await expect(sheet.getByText("That file is empty.")).toBeVisible();
  });

  test("the owner can delete what they uploaded, but not what HR added", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/documents");
    await expect(page.getByRole("button", { name: "Delete Employment agreement" })).toHaveCount(0);
    await page.getByRole("button", { name: "Delete salary proof 2026" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Document deleted")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open salary proof 2026" })).toHaveCount(0);
    expect((await page.request.get(href)).status()).toBe(404);
  });

  test("everyone can read the policy library; only HR adds to it", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/documents?view=policies");
    await expect(page.getByRole("heading", { name: "Policy library" })).toBeVisible();
    await expect(page.getByText("Leave Policy")).toBeVisible();
    await expect(page.getByText("Code of Conduct")).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload", exact: true })).toHaveCount(0);

    await signInAs(page, "HR_MANAGER");
    await page.goto("/documents?view=policies");
    const sheet = await openUpload(page);
    await sheet
      .getByLabel("File")
      .setInputFiles({ name: "travel-policy.pdf", mimeType: "application/pdf", buffer: PDF });
    await sheet.getByRole("button", { name: "Upload", exact: true }).click();
    await expect(page.getByText("Document added")).toBeVisible();
    await expect(page.getByText("travel policy")).toBeVisible();
  });
});

test.describe("announcements", () => {
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.skip(({ isMobile }) => isMobile, "changes shared data; desktop runs the flow once");

  const everyone = `Hackathon dates confirmed ${Date.now().toString(36)}`;
  const sales = `Sales kickoff logistics ${Date.now().toString(36)}`;

  async function compose(page: Page, headline: string, body: string, team?: string) {
    await page.goto("/announcements/new");
    await page.getByLabel("Headline").fill(headline);
    const editor = page.getByRole("textbox", { name: "Announcement body" });
    await retryUntil(
      async () => {
        await editor.click();
        await page.getByRole("button", { name: "Bold" }).click();
      },
      () =>
        expect(page.getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "true", {
          timeout: 1000,
        }),
    );
    await page.keyboard.type("Save the date: ");
    await page.getByRole("button", { name: "Bold" }).click();
    await page.keyboard.type(body);
    if (team) await page.getByRole("checkbox", { name: team }).click();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Announcement published")).toBeVisible();
    await expect(page).toHaveURL(/\/announcements$/);
  }

  test("HR writes and publishes to everyone, with formatting", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await compose(page, everyone, "The hackathon runs 12 to 16 January, and everyone is invited.");
    const card = page.getByRole("article").filter({ hasText: everyone });
    await expect(card).toBeVisible();
    await expect(card.locator("strong", { hasText: "Save the date:" })).toBeVisible();
  });

  test("it needs a headline and a message", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/announcements/new");
    await retryUntil(
      () => page.getByRole("button", { name: "Publish", exact: true }).click(),
      () => expect(page.getByText("Give it a headline")).toBeVisible({ timeout: 1000 }),
    );
  });

  test("an employee sees it unread, reads it by scrolling, and reacts", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/announcements");
    const card = page.getByRole("article").filter({ hasText: everyone });
    await expect(card.getByRole("img", { name: "Unread" })).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByRole("img", { name: "Unread" })).toHaveCount(0, { timeout: 15_000 });

    const like = card.getByRole("button", { name: /^Helpful/ });
    await retryUntil(
      () => like.click(),
      () => expect(like).toHaveAttribute("aria-pressed", "true", { timeout: 1000 }),
    );
    await page.reload();
    await expect(
      page
        .getByRole("article")
        .filter({ hasText: everyone })
        .getByRole("button", { name: /^Helpful, 1/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("HR sees who has read it", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/announcements");
    const card = page.getByRole("article").filter({ hasText: everyone });
    await expect(card.getByText(/Read by/)).toBeVisible();
    await retryUntil(
      () => card.getByRole("button", { name: /Read by/ }).click(),
      () =>
        expect(page.getByRole("dialog", { name: "Who hasn't read it" })).toBeVisible({
          timeout: 1500,
        }),
    );
    await expect(page.getByRole("dialog").getByRole("listitem").first()).toBeVisible();
  });

  test("a post for one team is visible only to that team and the people team", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await compose(page, sales, "Kickoff is at the Bengaluru office on 7 January.", "Sales");
    await expect(page.getByRole("article").filter({ hasText: sales })).toBeVisible();

    // Arjun is in Engineering.
    await signInAs(page, "EMPLOYEE");
    await page.goto("/announcements");
    await expect(page.getByRole("article").filter({ hasText: everyone })).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: sales })).toHaveCount(0);
  });

  test("drafts stay hidden until they're published", async ({ page }) => {
    const title = `Draft only ${Date.now().toString(36)}`;
    await signInAs(page, "HR_MANAGER");
    await page.goto("/announcements/new");
    await page.getByLabel("Headline").fill(title);
    const editor = page.getByRole("textbox", { name: "Announcement body" });
    await retryUntil(
      () => editor.click(),
      () => expect(editor).toBeFocused({ timeout: 1000 }),
    );
    await page.keyboard.type("This one isn't ready to go out yet, so it stays a draft.");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved")).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Drafts/ })).toBeVisible();
    await expect(
      page.getByRole("article").filter({ hasText: title }).getByText("Draft", { exact: true }),
    ).toBeVisible();

    await signInAs(page, "EMPLOYEE");
    await page.goto("/announcements");
    await expect(page.getByText(title)).toHaveCount(0);
  });
});

test.describe("who can publish", () => {
  test("employees can read announcements but not write them", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/announcements");
    await expect(page.getByRole("link", { name: "New announcement" })).toHaveCount(0);
    await page.goto("/announcements/new");
    await expect(
      page.getByRole("heading", { name: "This page isn't part of your role" }),
    ).toBeVisible();
  });
});

test.describe("accessibility", () => {
  for (const [role, path] of [
    ["EMPLOYEE", "/announcements"],
    ["HR_MANAGER", "/announcements/new"],
    ["EMPLOYEE", "/documents"],
    ["EMPLOYEE", "/documents?view=policies"],
    ["HR_MANAGER", "/documents?view=people"],
  ] as const) {
    test(`${path} as ${role} has no serious axe violations`, async ({ page }) => {
      await signInAs(page, role);
      await page.goto(path);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }
});
