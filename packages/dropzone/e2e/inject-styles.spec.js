import { test, expect } from "@playwright/test";

// The page links no stylesheet at all, so anything that computes to a styled
// value can only have come from the injection -- through the built standalone
// bundle, where the CSS has to have survived bundling as a string.
test.describe("Dropzone with injectStyles", () => {
  test("styles the dropzone without a linked stylesheet", async ({ page }) => {
    await page.goto("/1-basic/inject_styles.html");

    await expect(page.locator("link[rel=stylesheet]")).toHaveCount(0);
    await expect(page.locator("style[data-dropzone]")).toHaveCount(1);

    const minHeight = await page
      .locator(".dropzone")
      .evaluate((el) => getComputedStyle(el).minHeight);
    expect(minHeight).toBe("150px");
  });

  test("puts its stylesheet first so the page can override it", async ({ page }) => {
    await page.goto("/1-basic/inject_styles.html");

    const isFirst = await page.evaluate(
      () => document.head.firstElementChild?.matches("style[data-dropzone]") ?? false,
    );
    expect(isFirst).toBe(true);
  });

  test("adds the basic stylesheet instead when asked", async ({ page }) => {
    await page.goto("/1-basic/inject_styles_basic.html");

    await expect(page.locator("link[rel=stylesheet]")).toHaveCount(0);
    await expect(page.locator("style[data-dropzone]")).toHaveAttribute("data-dropzone", "basic");

    // basic.css sets position: relative on .dropzone; the full sheet does not,
    // and sets a min-height that basic leaves alone. So each is identifiable
    // by what the other lacks.
    const style = await page.locator(".dropzone").evaluate((el) => {
      const s = getComputedStyle(el);
      return { position: s.position, minHeight: s.minHeight };
    });
    expect(style.position).toBe("relative");
    expect(style.minHeight).not.toBe("150px");
  });
});
