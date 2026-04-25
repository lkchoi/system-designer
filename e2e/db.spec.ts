import { test, expect } from "@playwright/test";

/**
 * Wait for the app (and its db) to fully initialize, then expose db functions
 * on `window` so subsequent evaluate() calls can use them.
 */
async function setupDB(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.locator(".react-flow__viewport").waitFor();

  // Dynamically import the db module and attach to window for evaluate() calls.
  await page.evaluate(async () => {
    const db = await import("/src/db/index.ts");
    const io = await import("/src/db/io.ts");
    const database = await import("/src/db/database.ts");
    (window as any).__db = db;
    (window as any).__io = io;
    (window as any).__database = database;
  });
}

test.describe("db layer", () => {
  test("create + list designs", async ({ page }) => {
    await setupDB(page);

    const result = await page.evaluate(() => {
      const { createDesign, listDesigns } = (window as any).__db;
      const d1 = createDesign("Design A");
      const d2 = createDesign("Design B");
      const list = listDesigns();
      return { d1, d2, list };
    });

    expect(result.d1.name).toBe("Design A");
    expect(result.d2.name).toBe("Design B");
    expect(result.d1.id).not.toBe(result.d2.id);

    const names = result.list.map((d: any) => d.name);
    expect(names).toContain("Design A");
    expect(names).toContain("Design B");
  });

  test("get + rename design", async ({ page }) => {
    await setupDB(page);

    const result = await page.evaluate(() => {
      const { createDesign, getDesign, renameDesign } = (window as any).__db;
      const d = createDesign("Original");
      const before = getDesign(d.id);
      renameDesign(d.id, "Renamed");
      const after = getDesign(d.id);
      return { before, after };
    });

    expect(result.before.name).toBe("Original");
    expect(result.after.name).toBe("Renamed");
    expect(result.after.updatedAt > result.before.updatedAt).toBe(true);
    expect(result.after.id).toBe(result.before.id);
  });

  test("save + load state round-trip", async ({ page }) => {
    await setupDB(page);

    const result = await page.evaluate(() => {
      const { createDesign, saveDesignState, loadDesignState } = (window as any).__db;
      const d = createDesign("State Test");

      const nodes = [
        { id: "n1", type: "system", position: { x: 100, y: 200 }, data: { label: "api" } },
        { id: "n2", type: "system", position: { x: 300, y: 200 }, data: { label: "db" } },
      ];
      const edges = [{ id: "e1", source: "n1", target: "n2", data: { label: "query" } }];
      const viewport = { x: 50, y: 75, zoom: 1.5 };

      saveDesignState(d.id, nodes, edges, viewport);
      const loaded = loadDesignState(d.id);
      return { saved: { nodes, edges, viewport }, loaded };
    });

    expect(result.loaded.nodes).toHaveLength(2);
    expect(result.loaded.edges).toHaveLength(1);
    expect(result.loaded.nodes[0].position).toEqual({ x: 100, y: 200 });
    expect(result.loaded.edges[0].data.label).toBe("query");
    expect(result.loaded.viewport).toEqual({ x: 50, y: 75, zoom: 1.5 });
  });

  test("flow paths: save, load, delete", async ({ page }) => {
    await setupDB(page);

    const result = await page.evaluate(() => {
      const { createDesign, saveFlowPath, loadDesignState, deleteFlowPath } = (window as any).__db;
      const d = createDesign("Flow Test");

      saveFlowPath(d.id, {
        id: "fp1",
        name: "Login Flow",
        description: "user logs in",
        steps: ["gateway", "auth", "db"],
      });
      saveFlowPath(d.id, {
        id: "fp2",
        name: "Checkout",
        description: "user checks out",
        steps: ["cart", "payment"],
      });

      const before = loadDesignState(d.id);
      deleteFlowPath("fp1");
      const after = loadDesignState(d.id);

      return {
        before: before.flowPaths,
        after: after.flowPaths,
      };
    });

    expect(result.before).toHaveLength(2);
    expect(result.before.map((f: any) => f.name)).toEqual(["Login Flow", "Checkout"]);
    expect(result.after).toHaveLength(1);
    expect(result.after[0].name).toBe("Checkout");
  });

  test("fork design copies state and flow paths", async ({ page }) => {
    await setupDB(page);

    const result = await page.evaluate(() => {
      const {
        createDesign,
        saveDesignState,
        saveFlowPath,
        forkDesign,
        loadDesignState,
        getDesign,
      } = (window as any).__db;

      const src = createDesign("Source");
      saveDesignState(
        src.id,
        [{ id: "n1", type: "system", position: { x: 0, y: 0 }, data: { label: "svc" } }],
        [{ id: "e1", source: "n1", target: "n1", data: {} }],
        { x: 10, y: 20, zoom: 2 },
      );
      saveFlowPath(src.id, {
        id: "fp1",
        name: "Path A",
        description: "",
        steps: ["n1"],
      });

      const forked = forkDesign(src.id, "Forked");
      const forkedDesign = getDesign(forked.id);
      const forkedState = loadDesignState(forked.id);
      const srcState = loadDesignState(src.id);

      return { forked, forkedDesign, forkedState, srcState };
    });

    expect(result.forkedDesign.parentId).toBe(result.forked.parentId);
    expect(result.forkedDesign.parentId).toBeTruthy();
    expect(result.forkedDesign.name).toBe("Forked");

    // State should match
    expect(result.forkedState.nodes).toHaveLength(1);
    expect(result.forkedState.nodes[0].data.label).toBe("svc");
    expect(result.forkedState.edges).toHaveLength(1);
    expect(result.forkedState.viewport).toEqual({ x: 10, y: 20, zoom: 2 });

    // Flow paths should be copied with different IDs
    expect(result.forkedState.flowPaths).toHaveLength(1);
    expect(result.forkedState.flowPaths[0].name).toBe("Path A");
    expect(result.forkedState.flowPaths[0].id).not.toBe(result.srcState.flowPaths[0].id);
  });

  test("delete design removes all associated data", async ({ page }) => {
    await setupDB(page);

    const result = await page.evaluate(() => {
      const {
        createDesign,
        saveDesignState,
        saveFlowPath,
        deleteDesign,
        getDesign,
        listDesigns,
      } = (window as any).__db;

      const d = createDesign("To Delete");
      saveDesignState(
        d.id,
        [{ id: "n1", type: "system", position: { x: 0, y: 0 }, data: {} }],
        [],
        { x: 0, y: 0, zoom: 1 },
      );
      saveFlowPath(d.id, { id: "fp1", name: "Path", description: "", steps: [] });

      deleteDesign(d.id);

      const gone = getDesign(d.id);
      const list = listDesigns();
      const ids = list.map((d: any) => d.id);

      return { gone, containsDeleted: ids.includes(d.id) };
    });

    expect(result.gone).toBeUndefined();
    expect(result.containsDeleted).toBe(false);
  });

  test("export + import round-trip", async ({ page }) => {
    await setupDB(page);

    const result = await page.evaluate(() => {
      const { createDesign, saveDesignState, saveFlowPath, loadDesignState, getDesign } =
        (window as any).__db;
      const { exportDesign, importDesign } = (window as any).__io;

      const src = createDesign("Export Me");
      saveDesignState(
        src.id,
        [
          { id: "n1", type: "system", position: { x: 0, y: 0 }, data: { label: "api" } },
          { id: "n2", type: "system", position: { x: 200, y: 0 }, data: { label: "db" } },
        ],
        [{ id: "e1", source: "n1", target: "n2", data: { label: "sql" } }],
        { x: 5, y: 10, zoom: 1.2 },
      );
      saveFlowPath(src.id, {
        id: "fp1",
        name: "Query Flow",
        description: "desc",
        steps: ["n1", "n2"],
      });

      const json = exportDesign(src.id);
      const imported = importDesign(json);
      const importedDesign = getDesign(imported.id);
      const importedState = loadDesignState(imported.id);

      return { imported, importedDesign, importedState };
    });

    expect(result.importedDesign.name).toBe("Export Me");
    expect(result.importedState.nodes).toHaveLength(2);
    expect(result.importedState.edges).toHaveLength(1);
    expect(result.importedState.edges[0].data.label).toBe("sql");
    expect(result.importedState.viewport).toEqual({ x: 5, y: 10, zoom: 1.2 });
    expect(result.importedState.flowPaths).toHaveLength(1);
    expect(result.importedState.flowPaths[0].name).toBe("Query Flow");
  });

  test("initDB is idempotent", async ({ page }) => {
    await setupDB(page);

    const same = await page.evaluate(async () => {
      const { initDB } = (window as any).__database;
      const db1 = await initDB();
      const db2 = await initDB();
      return db1 === db2;
    });

    expect(same).toBe(true);
  });

  test("getDB returns the initialized instance", async ({ page }) => {
    await setupDB(page);

    const ok = await page.evaluate(() => {
      const { getDB } = (window as any).__database;
      const db = getDB();
      // Verify it's a usable sql.js Database (has an exec method)
      return typeof db.exec === "function";
    });

    expect(ok).toBe(true);
  });
});
