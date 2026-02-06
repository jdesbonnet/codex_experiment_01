import { expect, test } from "@playwright/test";

test("renders Cesium map with observation data", async ({ page }) => {
  await page.goto("/app.html", { waitUntil: "domcontentloaded" });

  await page.waitForSelector("#cesiumContainer canvas", {
    state: "visible",
    timeout: 60_000,
  });

  await expect(page.locator("#status")).toHaveText(/observations loaded/, {
    timeout: 60_000,
  });

  await expect(page.locator("#articleTitle")).toHaveText(
    "Select an observation"
  );
});
