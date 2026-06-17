import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";

const enabled = process.env.RUN_SUPABASE_AUTH_INTEGRATION === "1";
const appUrl = process.env.NEXT_APP_URL;
const maybeTest = enabled ? test : test.skip;

function boxesOverlap(first, second) {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

maybeTest("password toggle stays outside the browser credential-control slot", async () => {
  assert.ok(appUrl, "NEXT_APP_URL is required");

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(`${appUrl}/register`);

    const passwordInput = page.getByLabel("Password", { exact: true });
    const passwordToggle = page.getByRole("button", {
      name: "Tampilkan password",
      exact: true,
    });

    const inputBox = await passwordInput.boundingBox();
    const toggleBox = await passwordToggle.boundingBox();
    assert.ok(inputBox);
    assert.ok(toggleBox);

    const gap = toggleBox.x - (inputBox.x + inputBox.width);
    assert.ok(gap >= 7, `expected a visible gap, received ${gap}px`);
    assert.equal(boxesOverlap(inputBox, toggleBox), false);

    const inputPaddingRight = await passwordInput.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).paddingRight),
    );
    assert.ok(inputPaddingRight >= 48);

    await page.evaluate(() => {
      const input = document.querySelector("#password");
      if (!(input instanceof HTMLInputElement)) {
        throw new Error("Password input was not found");
      }

      const rect = input.getBoundingClientRect();
      const credentialSlot = document.createElement("div");
      credentialSlot.dataset.testid = "browser-credential-slot";
      Object.assign(credentialSlot.style, {
        position: "fixed",
        left: `${rect.right - 40}px`,
        top: `${rect.top}px`,
        width: "40px",
        height: `${rect.height}px`,
        pointerEvents: "none",
      });
      document.body.append(credentialSlot);
    });

    const credentialSlotBox = await page.locator('[data-testid="browser-credential-slot"]').boundingBox();
    assert.ok(credentialSlotBox);
    assert.equal(boxesOverlap(credentialSlotBox, toggleBox), false);
  } finally {
    await browser.close();
  }
});
