import { test, expect, type Page } from "@playwright/test";

/** Drop a component onto the canvas at (clientX, clientY) via synthetic DragEvent. */
async function dropOnCanvas(page: Page, type: string, clientX: number, clientY: number) {
  await page.evaluate(
    ({ x, y, t }) => {
      const el = document.querySelector(".react-flow__renderer")!;
      const dt = new DataTransfer();
      dt.setData("application/system-designer", t);
      el.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, clientX: x, clientY: y, bubbles: true }));
      el.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, clientX: x, clientY: y, bubbles: true }));
    },
    { x: clientX, y: clientY, t: type },
  );
}

/** Get the canvas bounding box. */
async function canvasBounds(page: Page) {
  const canvas = page.locator(".react-flow__viewport");
  await canvas.waitFor();
  return (await canvas.boundingBox())!;
}

/** Add a system node to the canvas at a relative position (0-1) within the canvas. */
async function addNode(page: Page, type: string, relX = 0.35, relY = 0.5) {
  const b = await canvasBounds(page);
  await dropOnCanvas(page, type, b.x + b.width * relX, b.y + b.height * relY);
}

test("app loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/System Designer/i);
});

test("add node from sidebar", async ({ page }) => {
  await page.goto("/");
  await canvasBounds(page);

  await expect(page.getByText("0 nodes")).toBeVisible();

  await addNode(page, "database");

  await expect(page.getByText("1 nodes")).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
});

/** Drag from a handle on the source node to a handle on the target node. */
async function connectNodes(page: Page, sourceIdx: number, targetIdx: number) {
  const nodes = page.locator(".react-flow__node");
  const sourceHandle = nodes.nth(sourceIdx).locator(".system-handle").nth(3); // bottom
  const targetHandle = nodes.nth(targetIdx).locator(".system-handle").nth(1); // left

  await sourceHandle.hover({ force: true });
  const srcBox = (await sourceHandle.boundingBox())!;
  const tgtBox = (await targetHandle.boundingBox())!;

  await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(tgtBox.x + tgtBox.width / 2, tgtBox.y + tgtBox.height / 2, { steps: 5 });
  await page.mouse.up();
}

test("connect two nodes", async ({ page }) => {
  await page.goto("/");
  await canvasBounds(page);

  await addNode(page, "service", 0.3, 0.4);
  await addNode(page, "database", 0.6, 0.4);
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.getByText("0 connections")).toBeVisible();

  await connectNodes(page, 0, 1);

  await expect(page.getByText("1 connections")).toBeVisible();
});

test("connection validation rejects incompatible nodes", async ({ page }) => {
  await page.goto("/");
  await canvasBounds(page);

  // cron and client cannot connect to each other
  await addNode(page, "cron", 0.3, 0.4);
  await addNode(page, "client", 0.6, 0.4);
  await expect(page.locator(".react-flow__node")).toHaveCount(2);

  await connectNodes(page, 0, 1);

  // Connection should be rejected — still 0
  await expect(page.getByText("0 connections")).toBeVisible();
});
