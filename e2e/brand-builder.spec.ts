import { expect, test } from "@playwright/test";
import { samplePlaybook } from "../src/features/brand-builder/examples";

test("operator can see the brand builder workflow", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Operator access" })).toBeVisible();
  await page.getByLabel("Access code").fill("admin");
  await page.getByRole("button", { name: "Enter OFM OS" }).click();
  await expect(
    page.getByRole("heading", { name: "Today's operation, at a glance." }),
  ).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Brand Builder", exact: true }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Cami Rose", { timeout: 20_000 });
  await expect(page.getByLabel("Select 3 photos")).toBeAttached();
  await expect(page.getByRole("button", { name: "Generate 3 routes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry with GPT-5.5" })).toHaveCount(0);
  expect(browserErrors.filter((error) => error.includes("Hydration failed"))).toEqual([]);
});

test("restores a saved session without hydration errors", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("ofms.operatorSession", "admin");
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Today's operation, at a glance." }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "CyberData" })).toBeVisible();
  expect(browserErrors.filter((error) => error.includes("Hydration failed"))).toEqual([]);
});

test("mobile navigation keeps the Brand Builder usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.localStorage.setItem("ofms.operatorSession", "admin");
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Brand Builder", exact: true }).click();

  await expect(
    page.locator("#main-content").getByRole("heading", { name: "Brand Builder", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("Cami Rose");
  const viewportHasNoHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(viewportHasNoHorizontalOverflow).toBe(true);
});

test("operator selects, edits, saves and curates a route", async ({ page }) => {
  let saveBody: { feedback?: Array<{ reason: string }> } | null = null;
  let reviewBody: { status?: string; scope?: string } | null = null;
  await page.addInitScript(() => {
    window.localStorage.setItem("ofms.operatorSession", "admin");
  });
  await page.route("**/api/brand-builder/generate", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, output: samplePlaybook, provider: "openai/gpt-5.5" }),
    });
  });
  await page.route("**/api/brand-builder/save", async (route) => {
    saveBody = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, persisted: true }),
    });
  });
  await page.route("**/api/brand-builder/learning", async (route) => {
    if (route.request().method() === "PATCH") {
      reviewBody = route.request().postDataJSON();
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        entries: [
          {
            id: "2cbf6435-1684-46df-bbf2-614ec9e56915",
            profileName: "Cami Rose",
            fieldPath: "routes.1.discoveryBio",
            beforeValue: samplePlaybook.routes[1].discoveryBio,
            afterValue: `${samplePlaybook.routes[1].discoveryBio} Dm me after the show.`,
            reason: "The CTA needed to continue the runway scene.",
            scope: "archetype",
            status: "pending",
            archetypeKey: "woman yoga model",
            createdAt: "2026-06-23T00:00:00Z",
          },
        ],
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Brand Builder", exact: true }).click();
  await page.getByLabel("Select 3 photos").setInputFiles([
    { name: "one.jpg", mimeType: "image/jpeg", buffer: Buffer.from("one") },
    { name: "two.jpg", mimeType: "image/jpeg", buffer: Buffer.from("two") },
    { name: "three.jpg", mimeType: "image/jpeg", buffer: Buffer.from("three") },
  ]);
  await page.getByRole("button", { name: "Generate 3 routes" }).click();
  await page.getByRole("button", { name: "Use this route" }).first().click();

  const routeBios = page.getByLabel("Discovery bio");
  await routeBios.nth(1).fill(`${samplePlaybook.routes[1].discoveryBio} Dm me after the show.`);
  await page.getByLabel("Why did you change route 2?").fill(
    "The CTA needed to continue the runway scene.",
  );
  await page.getByRole("button", { name: "Save to CyberData" }).click();
  await expect.poll(() => saveBody?.feedback?.[0]?.reason).toBe(
    "The CTA needed to continue the runway scene.",
  );

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText("The CTA needed to continue the runway scene.")).toBeVisible();
  await page.getByRole("button", { name: "Approve for archetype" }).click();
  await expect.poll(() => reviewBody).toMatchObject({
    status: "approved",
    scope: "archetype",
  });
});
