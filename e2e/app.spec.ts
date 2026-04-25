import { test, expect, type Page } from "@playwright/test";

/**
 * Drag a component from the sidebar onto the canvas center.
 * @param itemTitle - The visible title/label of the sidebar item (e.g. "Database")
 * @param dragType  - The type string to pass via dataTransfer (e.g. "database")
 */
async function dragToCanvas(page: Page, itemTitle: string, dragType: string) {
  const item = page.locator(`aside [title="${itemTitle}"][draggable]`);
  const canvas = page.locator(".react-flow__viewport");
  await item.waitFor();
  await canvas.waitFor();

  const src = (await item.boundingBox())!;
  const dst = (await canvas.boundingBox())!;

  const srcX = src.x + src.width / 2;
  const srcY = src.y + src.height / 2;
  const dstX = dst.x + dst.width / 2;
  const dstY = dst.y + dst.height / 2;

  await page.evaluate(
    ({ sx, sy, dx, dy, type }) => {
      const canvasEl = document.querySelector(".react-flow__renderer")!;
      const dt = new DataTransfer();
      dt.setData("application/system-designer", type);

      canvasEl.dispatchEvent(
        new DragEvent("dragover", { dataTransfer: dt, clientX: dx, clientY: dy, bubbles: true }),
      );
      canvasEl.dispatchEvent(
        new DragEvent("drop", { dataTransfer: dt, clientX: dx, clientY: dy, bubbles: true }),
      );
    },
    { sx: srcX, sy: srcY, dx: dstX, dy: dstY, type: dragType },
  );
}

test("app loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/System Designer/i);
});

test("add node from sidebar", async ({ page }) => {
  await page.goto("/");
  await page.locator(".react-flow__viewport").waitFor();

  await expect(page.getByText("0 nodes")).toBeVisible();

  await dragToCanvas(page, "Database", "database");

  await expect(page.getByText("1 nodes")).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
});
