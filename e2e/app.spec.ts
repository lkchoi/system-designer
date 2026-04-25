import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

test("edit node properties via panel", async ({ page }) => {
  await page.goto("/");
  await canvasBounds(page);

  await addNode(page, "database");

  // Click the node to select it and open the properties panel
  await page.locator(".react-flow__node").click();
  await expect(page.getByText("Properties")).toBeVisible();

  // Change the label in the properties panel — the input follows the "Label" text
  const panel = page.locator("aside").filter({ hasText: "Properties" });
  const labelInput = panel.locator("input").first();
  await expect(labelInput).toBeVisible();
  await labelInput.clear();
  await labelInput.fill("users-db");

  // Verify the node label updated on the canvas
  await expect(page.locator(".react-flow__node").getByText("users-db")).toBeVisible();
});

test("delete a node", async ({ page }) => {
  await page.goto("/");
  await canvasBounds(page);

  await addNode(page, "service", 0.3, 0.4);
  await addNode(page, "database", 0.6, 0.4);
  await expect(page.getByText("2 nodes")).toBeVisible();

  // Connect them first
  await connectNodes(page, 0, 1);
  await expect(page.getByText("1 connections")).toBeVisible();

  // Select the first node and press Delete
  await page.locator(".react-flow__node").first().click();
  await page.keyboard.press("Delete");

  // Node and its edge should be removed
  await expect(page.getByText("1 nodes")).toBeVisible();
  await expect(page.getByText("0 connections")).toBeVisible();
});

test("undo and redo", async ({ page }) => {
  await page.goto("/");
  await canvasBounds(page);

  // Add a node then delete it
  await addNode(page, "database");
  await expect(page.getByText("1 nodes")).toBeVisible();

  await page.locator(".react-flow__node").click();
  await page.keyboard.press("Delete");
  await expect(page.getByText("0 nodes")).toBeVisible();

  // Click the Undo button
  await page.locator("[title='Undo (⌘Z)']").click();
  await expect(page.getByText("1 nodes")).toBeVisible();

  // Click the Redo button
  await page.locator("[title='Redo (⌘⇧Z)']").click();
  await expect(page.getByText("0 nodes")).toBeVisible();
});

test("drop a pattern template", async ({ page }) => {
  await page.goto("/");
  await canvasBounds(page);

  // Drop Cache-Aside pattern — creates a container + 3 system nodes + 2 edges
  await addNode(page, "pattern:cache-aside", 0.4, 0.5);

  await expect(page.getByText("4 nodes")).toBeVisible();
  await expect(page.getByText("2 connections")).toBeVisible();
});

test("mode switching", async ({ page }) => {
  await page.goto("/");
  await canvasBounds(page);

  // Default mode is Plan — stress controls should not be visible
  const stressMultiplier = page.getByRole("button", { name: "1x" });
  await expect(stressMultiplier).not.toBeVisible();

  // Switch to Stress mode
  await page.getByRole("button", { name: "Stress" }).click();
  await expect(stressMultiplier).toBeVisible();

  // Switch to Monitor mode — stress controls disappear
  await page.getByRole("button", { name: "Monitor" }).click();
  await expect(stressMultiplier).not.toBeVisible();

  // Switch back to Plan
  await page.getByRole("button", { name: "Plan" }).click();
  await expect(stressMultiplier).not.toBeVisible();
});

test("stress testing toggles failure state", async ({ page }) => {
  await page.goto("/");
  await canvasBounds(page);

  await addNode(page, "service");
  await page.getByRole("button", { name: "Stress" }).click();

  const node = page.locator(".react-flow__node");

  // Click once: healthy → overloaded (yellow border)
  await node.click();
  // Click twice: overloaded → down (OFFLINE overlay)
  await node.click();
  await expect(node.getByText("OFFLINE")).toBeVisible();

  // Click again: down → healthy (OFFLINE disappears)
  await node.click();
  await expect(node.getByText("OFFLINE")).not.toBeVisible();
});

test("export native JSON", async ({ page }) => {
  await page.goto("/");
  await canvasBounds(page);

  // Build a small design
  await addNode(page, "service", 0.3, 0.4);
  await addNode(page, "database", 0.6, 0.4);
  await connectNodes(page, 0, 1);
  await expect(page.getByText("1 connections")).toBeVisible();

  // Wait for auto-save debounce (500ms) before exporting
  await page.waitForTimeout(600);

  // Open export dialog
  await page.locator("[title='Export (⌘E)']").click();
  await expect(page.getByText("Export Design")).toBeVisible();

  // Click JSON format tile and capture download
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /^JSON/ }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/\.json$/);

  // Verify the download contains our nodes and edges
  const content = await download.path().then((p) => fs.readFileSync(p!, "utf-8"));
  const data = JSON.parse(content);
  expect(data.nodes).toHaveLength(2);
  expect(data.edges).toHaveLength(1);
});

test("import design from JSON file", async ({ page }) => {
  await page.goto("/");
  await canvasBounds(page);

  // Create a fixture JSON file
  const fixture = {
    version: 1,
    name: "Imported Design",
    nodes: [
      {
        id: "n1",
        type: "system",
        position: { x: 100, y: 100 },
        data: {
          label: "imported-api",
          description: "",
          componentType: "api-gateway",
          status: "healthy",
          metrics: { cpu: 10, memory: 20, rps: 100, latency: 5 },
          plan: {},
          sharded: false,
          shardKey: "",
          endpoints: [],
          links: [],
          capClassification: "",
          stressFailure: "none",
          capacityPercent: 100,
          consumerRate: 1000,
        },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    flowPaths: [],
  };
  const fixturePath = path.join(__dirname, "test-import.json");
  fs.writeFileSync(fixturePath, JSON.stringify(fixture));

  // Click import and provide the file
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.locator("[title='Import (⌘I)']").click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(fixturePath);

  // The imported design should load with the node visible
  await expect(page.getByText("1 nodes")).toBeVisible();
  await expect(page.locator(".react-flow__node").getByText("imported-api")).toBeVisible();

  // Clean up fixture
  fs.unlinkSync(fixturePath);
});

test("auto-save persists across page reload", async ({ page }) => {
  await page.goto("/");
  await canvasBounds(page);

  await addNode(page, "service", 0.3, 0.4);
  await addNode(page, "database", 0.6, 0.4);
  await expect(page.getByText("2 nodes")).toBeVisible();

  // Wait for auto-save debounce
  await page.waitForTimeout(600);

  // Reload the page
  await page.reload();
  await canvasBounds(page);

  // Nodes should persist
  await expect(page.getByText("2 nodes")).toBeVisible();
});

test("multiple designs with independent state", async ({ page }) => {
  await page.goto("/");
  await canvasBounds(page);

  // Add nodes to the default design
  await addNode(page, "database");
  await expect(page.getByText("1 nodes")).toBeVisible();
  await page.waitForTimeout(600); // wait for auto-save

  // Open design menu and create a new design
  await page.locator("[title='Click to switch designs, double-click to rename']").click();
  await page.getByText("New Design").click();

  // New design should be empty
  await expect(page.getByText("0 nodes")).toBeVisible();

  // Add a different node to the new design
  await addNode(page, "service");
  await addNode(page, "cache");
  await expect(page.getByText("2 nodes")).toBeVisible();
  await page.waitForTimeout(600);

  // Switch back to the first design via the dropdown menu
  await page.locator("[title='Click to switch designs, double-click to rename']").click();
  // The non-active design item lacks the font-semibold class
  const designMenu = page.locator(".absolute").filter({ hasText: "Designs" });
  await designMenu.locator("div.group:not(.font-semibold)").first().click();

  // First design should still have 1 node
  await expect(page.getByText("1 nodes")).toBeVisible();
});

test("sidebar search filters components", async ({ page }) => {
  await page.goto("/");
  await canvasBounds(page);

  const sidebar = page.locator("aside");
  const filterInput = sidebar.getByPlaceholder(/Filter/);

  // Count visible draggable items before filtering
  const allItems = sidebar.locator("[draggable]");
  const initialCount = await allItems.count();
  expect(initialCount).toBeGreaterThan(5);

  // Type a filter term
  await filterInput.fill("data");
  const filteredCount = await allItems.count();
  expect(filteredCount).toBeLessThan(initialCount);
  expect(filteredCount).toBeGreaterThan(0);

  // Clear filter — items should return
  await filterInput.clear();
  await expect(allItems).toHaveCount(initialCount);
});

test("inline label editing on double-click", async ({ page }) => {
  await page.goto("/");
  await canvasBounds(page);

  await addNode(page, "database");
  const node = page.locator(".react-flow__node");

  // Get the auto-generated label text
  const label = node.locator("span.font-semibold");
  const originalText = await label.textContent();
  expect(originalText).toBeTruthy();

  // Double-click the label to enter edit mode
  await label.dblclick();

  // An input should appear
  const input = node.locator("input.font-semibold");
  await expect(input).toBeVisible();

  // Clear and type new name, then press Enter
  await input.fill("my-custom-db");
  await input.press("Enter");

  // Label should update
  await expect(node.getByText("my-custom-db")).toBeVisible();
});
