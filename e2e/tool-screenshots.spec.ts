import { test, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imgDir = path.resolve(__dirname, "../docs/images");

/** Drop a component onto the canvas. */
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

async function addNode(page: Page, type: string) {
  const canvas = page.locator(".react-flow__viewport");
  await canvas.waitFor();
  const b = (await canvas.boundingBox())!;
  await dropOnCanvas(page, type, b.x + b.width * 0.35, b.y + b.height * 0.5);
}

/** Click a node to select it and open the properties panel. */
async function selectNode(page: Page, index = 0) {
  const node = page.locator(".react-flow__node").nth(index);
  await node.click();
  // Wait for properties panel to appear
  await page.locator("text=Properties").waitFor({ timeout: 3000 });
}

/** Click a tool button in the ToolLauncher by label and wait for the modal to load. */
async function openToolFromPanel(page: Page, label: string) {
  const btn = page.locator(`button:has-text("${label}")`).first();
  await btn.click();
  // Wait for the lazy-loaded modal to render
  await page.locator(".rounded-xl.bg-surface.border-border").first().waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);
}

/** Screenshot the modal dialog. Uses the backdrop's direct child (the card). */
async function screenshotModal(page: Page, filename: string, titleText?: string) {
  // Wait for the modal content to be visible
  if (titleText) {
    await page.getByText(titleText, { exact: false }).first().waitFor({ timeout: 5000 });
  }
  await page.waitForTimeout(400);
  // The modal backdrop is a fixed div, its first child is the card
  const backdrop = page.locator("[class*='fixed'][class*='inset-0'][class*='bg-black']");
  const card = backdrop.locator("> div").first();
  await card.waitFor({ timeout: 5000 });
  await card.screenshot({ path: path.join(imgDir, filename) });
}

// Each test navigates fresh — run in parallel for speed
test.describe.configure({ mode: "parallel" });

test.describe("tool screenshots", () => {

  test("capacity calculator", async ({ page }) => {
    await page.goto("/");
    await page.locator(".react-flow__viewport").waitFor();
    // Open via hotkey
    await page.keyboard.press("c");
    await screenshotModal(page, "tool-capacity-calculator.png", "Capacity Calculator");
    await page.keyboard.press("Escape");
  });

  test("capacity calculator reference tab", async ({ page }) => {
    await page.goto("/");
    await page.locator(".react-flow__viewport").waitFor();
    await page.keyboard.press("c");
    await page.waitForTimeout(200);
    // Click Reference tab
    await page.locator("button:has-text('Reference')").click();
    await page.waitForTimeout(200);
    await screenshotModal(page, "tool-capacity-calculator-reference.png", "Capacity Calculator");
    await page.keyboard.press("Escape");
  });

  test("cron translator - cron to text", async ({ page }) => {
    await page.goto("/");
    await page.locator(".react-flow__viewport").waitFor();
    await page.keyboard.press("r");
    await screenshotModal(page, "tool-cron-translator.png", "Cron Translator");
    await page.keyboard.press("Escape");
  });

  test("cron translator - text to cron", async ({ page }) => {
    await page.goto("/");
    await page.locator(".react-flow__viewport").waitFor();
    await page.keyboard.press("r");
    await page.waitForTimeout(200);
    await page.locator("button:has-text('Text → Cron')").click();
    await page.waitForTimeout(100);
    const input = page.locator("input[placeholder*='every weekday']");
    await input.fill("every monday at 9:30 am");
    await page.waitForTimeout(200);
    await screenshotModal(page, "tool-cron-translator-text.png", "Cron Translator");
    await page.keyboard.press("Escape");
  });

  test("sla calculator", async ({ page }) => {
    await page.goto("/");
    await page.locator(".react-flow__viewport").waitFor();
    await addNode(page, "service");
    await selectNode(page);
    await openToolFromPanel(page, "SLA Calculator");
    await screenshotModal(page, "tool-sla-calculator.png", "SLA Calculator");
    await page.keyboard.press("Escape");
  });

  test("cache sizer", async ({ page }) => {
    await page.goto("/");
    await page.locator(".react-flow__viewport").waitFor();
    await addNode(page, "cache");
    await selectNode(page);
    await openToolFromPanel(page, "Cache Sizer");
    await screenshotModal(page, "tool-cache-sizer.png", "Cache Sizer");
    await page.keyboard.press("Escape");
  });

  test("jwt inspector", async ({ page }) => {
    await page.goto("/");
    await page.locator(".react-flow__viewport").waitFor();
    await addNode(page, "api-gateway");
    await selectNode(page);
    await openToolFromPanel(page, "JWT Inspector");
    await page.waitForTimeout(200);
    // Paste a sample JWT
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgRG9lIiwiZW1haWwiOiJqYW5lQGV4YW1wbGUuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE4OTM0NTYwMDB9.signature";
    await page.locator("textarea[placeholder*='eyJhbG']").fill(jwt);
    await page.waitForTimeout(300);
    await screenshotModal(page, "tool-jwt-inspector.png", "JWT Inspector");
    await page.keyboard.press("Escape");
  });

  test("partition calculator", async ({ page }) => {
    await page.goto("/");
    await page.locator(".react-flow__viewport").waitFor();
    await addNode(page, "message-queue");
    await selectNode(page);
    await openToolFromPanel(page, "Partition Calculator");
    await screenshotModal(page, "tool-partition-calculator.png", "Partition Calculator");
    await page.keyboard.press("Escape");
  });

  test("connection pool sizer", async ({ page }) => {
    await page.goto("/");
    await page.locator(".react-flow__viewport").waitFor();
    await addNode(page, "database");
    await selectNode(page);
    await openToolFromPanel(page, "Connection Pool Sizer");
    await screenshotModal(page, "tool-connection-pool-sizer.png", "Connection Pool Sizer");
    await page.keyboard.press("Escape");
  });

  test("serverless cost estimator", async ({ page }) => {
    await page.goto("/");
    await page.locator(".react-flow__viewport").waitFor();
    await addNode(page, "serverless");
    await selectNode(page);
    await openToolFromPanel(page, "Serverless Cost Estimator");
    await screenshotModal(page, "tool-serverless-cost-estimator.png", "Serverless Cost Estimator");
    await page.keyboard.press("Escape");
  });

  test("storage growth projector", async ({ page }) => {
    await page.goto("/");
    await page.locator(".react-flow__viewport").waitFor();
    await addNode(page, "storage");
    await selectNode(page);
    await openToolFromPanel(page, "Storage Growth Projector");
    await screenshotModal(page, "tool-storage-growth-projector.png", "Storage Growth Projector");
    await page.keyboard.press("Escape");
  });

  test("replication planner", async ({ page }) => {
    await page.goto("/");
    await page.locator(".react-flow__viewport").waitFor();
    await addNode(page, "database");
    await selectNode(page);
    await openToolFromPanel(page, "Replication Planner");
    await screenshotModal(page, "tool-replication-planner.png", "Replication Planner");
    await page.keyboard.press("Escape");
  });

  test("latency budget calculator", async ({ page }) => {
    await page.goto("/");
    await page.locator(".react-flow__viewport").waitFor();
    await addNode(page, "api-gateway");
    await selectNode(page);
    await openToolFromPanel(page, "Latency Budget");
    await screenshotModal(page, "tool-latency-budget-calculator.png", "Latency Budget Calculator");
    await page.keyboard.press("Escape");
  });

  test("dns ttl advisor", async ({ page }) => {
    await page.goto("/");
    await page.locator(".react-flow__viewport").waitFor();
    await addNode(page, "dns");
    await selectNode(page);
    await openToolFromPanel(page, "DNS TTL Advisor");
    await screenshotModal(page, "tool-dns-ttl-advisor.png", "DNS TTL Advisor");
    await page.keyboard.press("Escape");
  });

  test("payload size estimator", async ({ page }) => {
    await page.goto("/");
    await page.locator(".react-flow__viewport").waitFor();
    await addNode(page, "api-gateway");
    await selectNode(page);
    await openToolFromPanel(page, "Payload Size Estimator");
    await screenshotModal(page, "tool-payload-size-estimator.png", "Payload Size Estimator");
    await page.keyboard.press("Escape");
  });

  test("regex tester", async ({ page }) => {
    await page.goto("/");
    await page.locator(".react-flow__viewport").waitFor();
    await addNode(page, "api-gateway");
    await selectNode(page);
    await openToolFromPanel(page, "Regex Tester");
    await page.waitForTimeout(200);
    // Fill in a pattern and test string
    const patternInput = page.locator("input[placeholder*='\\\\d+']");
    await patternInput.fill("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}");
    const textarea = page.locator("textarea[placeholder*='Enter text']");
    await textarea.fill("Contact us at support@example.com or sales@company.org for help.");
    await page.waitForTimeout(300);
    await screenshotModal(page, "tool-regex-tester.png", "Regex Tester");
    await page.keyboard.press("Escape");
  });

  test("consistent hashing visualizer", async ({ page }) => {
    await page.goto("/");
    await page.locator(".react-flow__viewport").waitFor();
    await addNode(page, "database");
    await selectNode(page);
    await openToolFromPanel(page, "Consistent Hashing");
    // Click "Add node" to show redistribution preview
    await page.locator("button:has-text('+ Add node')").click();
    await page.waitForTimeout(300);
    await screenshotModal(page, "tool-consistent-hashing-visualizer.png", "Consistent Hashing Visualizer");
    await page.keyboard.press("Escape");
  });

  test("shard key analyzer", async ({ page }) => {
    await page.goto("/");
    await page.locator(".react-flow__viewport").waitFor();
    await addNode(page, "database");
    await selectNode(page);
    await openToolFromPanel(page, "Shard Key Analyzer");
    // Load the timestamp example to show warnings
    await page.locator("button:has-text('created_at')").click();
    await page.waitForTimeout(300);
    await screenshotModal(page, "tool-shard-key-analyzer.png", "Shard Key Analyzer");
    await page.keyboard.press("Escape");
  });
});
