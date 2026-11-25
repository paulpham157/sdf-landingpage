import { readFileSync } from "node:fs";
import { expect, test, type Page, type Request } from "@playwright/test";
import { effectiveHeaders, headerValue, parseHeaders } from "../scripts/headers.mjs";

type Violation = { directive: string; blocked: string; sample: string };

function originOf(url: string) {
  return new URL(url).origin;
}

function isNetworkRequest(url: string) {
  return !url.startsWith("blob:") && !url.startsWith("data:");
}

async function installPageHooks(page: Page) {
  const requests: Request[] = [];
  page.on("request", (request) => {
    requests.push(request);
  });
  await page.addInitScript(() => {
    const record = (event: SecurityPolicyViolationEvent) => {
      const list = ((window as unknown as { __cspViolations?: Violation[] }).__cspViolations ??= []);
      list.push({
        directive: event.violatedDirective,
        blocked: event.blockedURI,
        sample: event.sample,
      });
    };
    document.addEventListener("securitypolicyviolation", record);
    (window as unknown as { __cspViolations?: Violation[] }).__cspViolations = [];
    // browser-fs-access picks the anchor/input fallback only when these are absent.
    // Defining them as undefined still counts as present and then throws.
    try {
      delete window.showSaveFilePicker;
      delete window.showOpenFilePicker;
    } catch {
      // The built-in save path still falls back when the picker is missing.
    }
  });
  return requests;
}

async function violations(page: Page): Promise<Violation[]> {
  return page.evaluate(
    () => (window as unknown as { __cspViolations?: Violation[] }).__cspViolations ?? [],
  );
}

async function waitUntilQuiet(page: Page, requests: Request[]) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
  return requests.length;
}

async function drawRectangle(page: Page) {
  // The toolbar icon sits on top of the radio input and intercepts pointer events.
  await page.getByTestId("toolbar-rectangle").click({ force: true });
  const canvas = page.locator(".excalidraw canvas").last();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Drawing canvas has no box");
  const x = box.x + box.width * 0.35;
  const y = box.y + box.height * 0.4;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 180, y + 120, { steps: 8 });
  await page.mouse.up();
}

async function pasteImage(page: Page) {
  const pasted = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 24;
    const context = canvas.getContext("2d");
    if (!context) return false;
    context.fillStyle = "#c65a2e";
    context.fillRect(0, 0, 24, 24);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return false;
    const file = new File([blob], "swatch.png", { type: "image/png" });
    const data = new DataTransfer();
    data.items.add(file);
    const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data });
    document.dispatchEvent(event);
    window.dispatchEvent(event);
    document.querySelector(".excalidraw")?.dispatchEvent(event);
    return true;
  });
  expect(pasted).toBe(true);
  await page.waitForTimeout(400);
}

async function readStoredScene(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("sdf-draw");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("kv", "readonly");
    const store = tx.objectStore("kv");
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const scene = await new Promise<string | undefined>((resolve, reject) => {
      const request = store.get("scene");
      request.onsuccess = () => resolve(request.result as string | undefined);
      request.onerror = () => reject(request.error);
    });
    const files: Record<string, { mimeType?: string; dataURL?: string }> = {};
    const backups: unknown[] = [];
    for (const key of keys) {
      if (typeof key !== "string") continue;
      const value = await new Promise<unknown>((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (key.startsWith("file:") && value && typeof value === "object") {
        files[key] = value as { mimeType?: string; dataURL?: string };
      } else if (key.startsWith("scene.corrupt-")) backups.push(value);
    }
    return { keys: keys.map(String), scene: scene ?? "", files, backups };
  });
}

function parsedScene(scene: string) {
  try {
    return JSON.parse(scene) as { elements?: { type?: string; isDeleted?: boolean; fileId?: string }[] };
  } catch {
    return null;
  }
}

function liveElements(scene: string) {
  return (parsedScene(scene)?.elements ?? []).filter((element) => !element.isDeleted);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test("headers from wrangler match the built _headers file", async ({ page }) => {
  const rules = parseHeaders(readFileSync("dist/_headers", "utf8"));
  const home = await page.request.get("/");
  const draw = await page.request.get("/draw");
  const nested = await page.request.get("/draw/index.html");
  const homeCsp = home.headers()["content-security-policy"];
  const drawCsp = draw.headers()["content-security-policy"];
  expect(headerValue(effectiveHeaders(rules, "/"), "Content-Security-Policy")).toEqual([homeCsp]);
  expect(headerValue(effectiveHeaders(rules, "/draw"), "Content-Security-Policy")).toEqual([drawCsp]);
  expect(headerValue(effectiveHeaders(rules, "/draw/index.html"), "Content-Security-Policy")).toEqual([
    nested.headers()["content-security-policy"],
  ]);
  expect(draw.headers()["x-content-type-options"]).toBe("nosniff");
  expect(draw.headers()["x-frame-options"]).toBe("DENY");
  expect(draw.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(draw.headers()["cross-origin-opener-policy"]).toBe("same-origin");
  expect(draw.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect(nested.headers()["cross-origin-opener-policy"]).toBe("same-origin");
  expect(nested.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect(home.headers()["x-robots-tag"]).toBeUndefined();
  expect(home.headers()["cross-origin-opener-policy"]).toBeUndefined();
  expect(homeCsp).not.toContain("blob:");
  expect((drawCsp.match(/default-src/g) ?? []).length).toBe(1);
});

test("draw, paste, export, save, and reload stay on this origin", async ({ page }, testInfo) => {
  const requests = await installPageHooks(page);
  const response = await page.goto("/draw");
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator(".excalidraw")).toBeVisible();
  await expect(page).toHaveTitle("Scratch drawing tool (not part of SDF)");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Scratch drawing tool. Not part of SDF. Drawings are saved only in this browser and are not sent anywhere.",
  );
  await expect(page.locator(".draw-note")).toContainText(
    "Scratch drawing tool. Not part of SDF. Drawings are saved only in this browser on this device and are not sent anywhere. Clearing your browser data deletes them.",
  );
  const github = page.getByRole("link", { name: "GitHub" });
  await expect(github).toHaveAttribute("target", "_blank");
  await expect(github).toHaveAttribute("rel", /noopener/);
  await expect(github).toHaveAttribute("rel", /noreferrer/);
  await page.screenshot({ path: testInfo.outputPath("draw-empty-1440.png"), fullPage: false });
  const mark = await waitUntilQuiet(page, requests);
  const origin = originOf(page.url());

  await drawRectangle(page);
  await page.screenshot({ path: testInfo.outputPath("draw-drawing-1440.png"), fullPage: false });
  await pasteImage(page);

  await page.getByTestId("main-menu-trigger").click();
  await page.getByTestId("image-export-button").click();
  const pngDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export to PNG" }).click();
  const png = await pngDownload;
  expect(png.suggestedFilename()).toMatch(/\.png$/i);
  await page.keyboard.press("Escape");

  await page.getByTestId("main-menu-trigger").click();
  await page.getByTestId("image-export-button").click();
  const svgDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export to SVG" }).click();
  const svg = await svgDownload;
  expect(svg.suggestedFilename()).toMatch(/\.svg$/i);
  await page.keyboard.press("Escape");

  await page.getByTestId("main-menu-trigger").click();
  await page.getByTestId("json-export-button").click();
  const sceneDownload = page.waitForEvent("download");
  await page.getByRole("dialog").getByRole("button", { name: "Save to file" }).click();
  const sceneFile = await sceneDownload;
  expect(sceneFile.suggestedFilename()).toMatch(/\.excalidraw$/i);
  const savedPath = await sceneFile.path();
  await page.keyboard.press("Escape");

  await page.getByTestId("main-menu-trigger").click();
  await page.getByTestId("load-button").click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Load from file" }).click();
  await (await chooser).setFiles(savedPath);
  await page.waitForTimeout(500);

  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const recorded: string[] = [];
    (window as unknown as { __puts?: string[] }).__puts = recorded;
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      recorded.push(String(key));
      return original.call(this, value, key as IDBValidKey);
    };
  });
  await drawRectangle(page);
  await page.waitForTimeout(900);
  const puts = await page.evaluate(() => (window as unknown as { __puts?: string[] }).__puts ?? []);
  expect(puts.some((key) => key === "scene")).toBe(true);
  expect(puts.some((key) => key.startsWith("file:"))).toBe(false);
  const beforeReload = await readStoredScene(page);
  const beforeElements = liveElements(beforeReload.scene);
  expect(beforeElements.some((element) => element.type === "rectangle")).toBe(true);
  expect(beforeElements.some((element) => element.type === "image")).toBe(true);
  expect(Object.values(beforeReload.files).some((file) => file.dataURL?.startsWith("data:image/"))).toBe(true);
  const beforeReloadIndex = requests.length;

  await page.reload();
  await expect(page.locator(".excalidraw")).toBeVisible();
  await waitUntilQuiet(page, requests);
  const afterReload = await readStoredScene(page);
  const afterElements = liveElements(afterReload.scene);
  expect(afterElements.some((element) => element.type === "rectangle")).toBe(true);
  expect(afterElements.some((element) => element.type === "image")).toBe(true);
  expect(Object.values(afterReload.files).some((file) => file.dataURL?.startsWith("data:image/"))).toBe(true);

  const leaked = requests
    .map((request) => request.url())
    .filter(isNetworkRequest)
    .filter((url) => originOf(url) !== origin);
  // Reload is a navigation and fetches the page again. The idle window is the
  // drawing, paste, export, save, and reopen that happen before that navigation.
  const afterIdle = requests.slice(mark, beforeReloadIndex).map((request) => request.url()).filter(isNetworkRequest);
  const csp = await violations(page);
  expect(csp, JSON.stringify(csp, null, 2)).toEqual([]);
  expect(leaked, JSON.stringify(leaked, null, 2)).toEqual([]);
  expect(afterIdle, JSON.stringify(afterIdle, null, 2)).toEqual([]);
});

test("offline after load still draws without requests", async ({ page, context }) => {
  const requests = await installPageHooks(page);
  await page.goto("/draw");
  await expect(page.locator(".excalidraw")).toBeVisible();
  const mark = await waitUntilQuiet(page, requests);
  await context.setOffline(true);
  await drawRectangle(page);
  await pasteImage(page);
  await page.getByTestId("main-menu-trigger").click();
  await page.getByTestId("image-export-button").click();
  const pngDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export to PNG" }).click();
  expect((await pngDownload).suggestedFilename()).toMatch(/\.png$/i);
  await page.waitForTimeout(800);
  const stored = await readStoredScene(page);
  expect(liveElements(stored.scene).some((element) => element.type === "rectangle")).toBe(true);
  const csp = await violations(page);
  const after = requests.slice(mark).map((request) => request.url()).filter(isNetworkRequest);
  expect(csp, JSON.stringify(csp, null, 2)).toEqual([]);
  expect(after, JSON.stringify(after, null, 2)).toEqual([]);
});

test("quota failure shows the not saved notice", async ({ page }, testInfo) => {
  const requests = await installPageHooks(page);
  await page.goto("/draw");
  await expect(page.locator(".excalidraw")).toBeVisible();
  await waitUntilQuiet(page, requests);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    };
  });
  await drawRectangle(page);
  const notice = page.getByRole("alert");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(/not saved/i);
  await expect(notice).toContainText(/reloading or closing/i);
  await expect(notice).toContainText(/\.excalidraw/i);
  await expect(notice.getByRole("button", { name: "Save to file" })).toBeVisible();
  const download = page.waitForEvent("download");
  await notice.getByRole("button", { name: "Save to file" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.excalidraw$/i);
  const noticeBox = await notice.boundingBox();
  const toolBox = await page.getByTestId("toolbar-rectangle").boundingBox();
  const zoomBox = await page.getByRole("button", { name: "Zoom in" }).boundingBox();
  const strokeBox = await page.getByText("Stroke", { exact: true }).boundingBox();
  expect(noticeBox && toolBox && noticeBox.y >= toolBox.y + toolBox.height).toBeTruthy();
  expect(noticeBox && zoomBox && boxesOverlap(noticeBox, zoomBox)).toBe(false);
  expect(noticeBox && strokeBox && boxesOverlap(noticeBox, strokeBox)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("draw-not-saved-1440.png"), fullPage: false });
  const csp = await violations(page);
  expect(csp, JSON.stringify(csp, null, 2)).toEqual([]);
});

test("browse libraries and publish library are not available", async ({ page }) => {
  const requests = await installPageHooks(page);
  await page.goto("/draw");
  await expect(page.locator(".excalidraw")).toBeVisible();
  await page.getByTitle("Library").click();
  const browse = page.locator(".library-menu-browse-button");
  await expect(browse).toHaveCount(1);
  await expect(browse).toBeHidden();
  const menu = page.getByTestId("dropdown-menu-button");
  if ((await menu.count()) > 0) await menu.first().click();
  await expect(page.getByTestId("lib-dropdown--remove")).toBeHidden();
  await expect(page.getByText("Publish library", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Select an item on canvas to add it here.", { exact: true })).toBeVisible();
  await expect(page.getByText("public repository")).toHaveCount(0);
  const origin = originOf(page.url());
  const leaked = requests.map((request) => request.url()).filter(isNetworkRequest).filter((url) => originOf(url) !== origin);
  const csp = await violations(page);
  expect(csp, JSON.stringify(csp, null, 2)).toEqual([]);
  expect(leaked, JSON.stringify(leaked, null, 2)).toEqual([]);
});

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test("a corrupt saved scene is kept and offered for download", async ({ page }) => {
  const raw = '{"elements":[this is not json';
  const image = {
    mimeType: "image/png",
    id: "img-kept",
    dataURL: "data:image/png;base64,aaaa",
    created: 1,
  };
  await page.goto("/");
  await page.evaluate(async ({ value, file }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("sdf-draw", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("kv")) request.result.createObjectStore("kv");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      const store = tx.objectStore("kv");
      store.put(value, "scene");
      store.put(file, `file:${file.id}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { value: raw, file: image });
  await page.goto("/draw");
  const notice = page.getByRole("alert").filter({ hasText: /could not open the saved drawing/i });
  await expect(notice).toBeVisible();
  await page.waitForTimeout(1200);
  const download = page.waitForEvent("download");
  await notice.getByRole("button", { name: "Download raw file" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.excalidraw$/i);
  const downloaded = JSON.parse(readFileSync(await file.path(), "utf8")) as {
    corruptScene?: string;
    files?: Record<string, { dataURL?: string }>;
  };
  expect(downloaded.corruptScene).toBe(raw);
  expect(downloaded.files?.["img-kept"]?.dataURL).toBe(image.dataURL);
  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("sdf-draw");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = (key: IDBValidKey) =>
      new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction("kv", "readonly");
        const request = tx.objectStore("kv").get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const tx = db.transaction("kv", "readonly");
      const request = tx.objectStore("kv").getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const corruptKey = keys.find((key) => String(key).startsWith("scene.corrupt-"));
    return {
      corrupt: corruptKey ? await read(corruptKey) : null,
      scene: await read("scene"),
      image: await read("file:img-kept"),
    };
  });
  const backup = stored.corrupt as { raw?: string; files?: Record<string, { dataURL?: string }> };
  expect(backup.raw).toBe(raw);
  expect(backup.files?.["img-kept"]?.dataURL).toBe(image.dataURL);
  expect(stored.scene).not.toBe(raw);
  expect((stored.image as { dataURL?: string } | undefined)?.dataURL).toBe(image.dataURL);
});

test("a reload keeps backup images and deletes images that are not in the backup", async ({ page }) => {
  const raw = '{"elements":[this is not json';
  const image = {
    mimeType: "image/png",
    id: "img-kept",
    dataURL: "data:image/png;base64,bbbb",
    created: 2,
  };
  const extra = {
    mimeType: "image/png",
    id: "img-extra",
    dataURL: "data:image/png;base64,cccc",
    created: 3,
  };
  await page.goto("/");
  await page.evaluate(async ({ value, file }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("sdf-draw", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("kv")) request.result.createObjectStore("kv");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      const store = tx.objectStore("kv");
      store.put(value, "scene");
      store.put(file, `file:${file.id}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { value: raw, file: image });
  await page.goto("/draw");
  await expect(page.getByRole("alert").filter({ hasText: /could not open the saved drawing/i })).toBeVisible();
  await expect
    .poll(async () => {
      const stored = await readStoredScene(page);
      const backup = stored.backups[0] as { raw?: string; files?: Record<string, { dataURL?: string }> } | undefined;
      return (
        parsedScene(stored.scene) !== null &&
        backup?.files?.["img-kept"]?.dataURL === image.dataURL &&
        backup?.files?.["img-extra"] === undefined
      );
    })
    .toBe(true);
  await page.evaluate(async (file) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("sdf-draw");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(file, `file:${file.id}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, extra);
  await page.reload();
  await expect(page.locator(".excalidraw")).toBeVisible();
  await drawRectangle(page);
  await expect
    .poll(async () => liveElements((await readStoredScene(page)).scene).some((element) => element.type === "rectangle"))
    .toBe(true);
  const stored = await readStoredScene(page);
  const backup = stored.backups.find(
    (record) => (record as { raw?: string }).raw === raw,
  ) as { raw?: string; files?: Record<string, { dataURL?: string }> } | undefined;
  expect(stored.files["file:img-kept"]?.dataURL).toBe(image.dataURL);
  expect(stored.files["file:img-extra"]).toBeUndefined();
  expect(backup?.files?.["img-kept"]?.dataURL).toBe(image.dataURL);
  expect(backup?.files?.["img-extra"]).toBeUndefined();
});

test("the not saved notice stays readable on a phone", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installPageHooks(page);
  await page.goto("/draw");
  await expect(page.locator(".excalidraw")).toBeVisible();
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    };
  });
  await drawRectangle(page);
  const notice = page.getByRole("alert");
  await expect(notice).toBeVisible();
  const noticeBox = await notice.boundingBox();
  const footerBox = await page.getByRole("contentinfo").boundingBox();
  expect(noticeBox).toBeTruthy();
  expect(footerBox).toBeTruthy();
  expect(noticeBox!.width).toBeGreaterThan(300);
  expect(boxesOverlap(noticeBox!, footerBox!)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("draw-not-saved-390.png"), fullPage: false });
});

test("a second tab puts an image back when its cache still thinks the file is stored", async ({ page }) => {
  await installPageHooks(page);
  await page.goto("/draw");
  await expect(page.locator(".excalidraw")).toBeVisible();
  await drawRectangle(page);
  await pasteImage(page);
  await expect
    .poll(async () => (await readStoredScene(page)).keys.some((key) => key.startsWith("file:")))
    .toBe(true);
  const pageB = await page.context().newPage();
  await pageB.setViewportSize({ width: 1440, height: 900 });
  await installPageHooks(pageB);
  await pageB.goto("/draw");
  await expect(pageB.locator(".excalidraw")).toBeVisible();
  await expect
    .poll(async () => (await readStoredScene(pageB)).keys.some((key) => key.startsWith("file:")))
    .toBe(true);
  await pageB.waitForTimeout(1000);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("sdf-draw");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const tx = db.transaction("kv", "readonly");
      const request = tx.objectStore("kv").getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      const store = tx.objectStore("kv");
      for (const key of keys) {
        if (String(key).startsWith("file:")) store.delete(key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  expect((await readStoredScene(page)).keys.some((key) => key.startsWith("file:"))).toBe(false);
  await drawRectangle(pageB);
  await expect
    .poll(async () => (await readStoredScene(pageB)).keys.some((key) => key.startsWith("file:")))
    .toBe(true);
  const restored = await readStoredScene(pageB);
  expect(Object.values(restored.files).some((file) => file.dataURL?.startsWith("data:image/"))).toBe(true);
});
