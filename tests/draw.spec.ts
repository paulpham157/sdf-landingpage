import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Page, type Request } from "@playwright/test";
import { effectiveHeaders, headerValue, parseHeaders } from "../scripts/headers.mjs";

const artifacts = "/opt/cursor/artifacts";
mkdirSync(artifacts, { recursive: true });

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
    for (const key of keys) {
      if (typeof key !== "string" || !key.startsWith("file:")) continue;
      const value = await new Promise<{ mimeType?: string; dataURL?: string } | undefined>((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (value) files[key] = value;
    }
    return { keys: keys.map(String), scene: scene ?? "", files };
  });
}

function liveElements(scene: string) {
  const parsed = JSON.parse(scene) as { elements?: { type?: string; isDeleted?: boolean; fileId?: string }[] };
  return (parsed.elements ?? []).filter((element) => !element.isDeleted);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test("headers from wrangler match the built _headers file", async ({ page }) => {
  const rules = parseHeaders(readFileSync("dist/_headers", "utf8"));
  const home = await page.request.get("/");
  const draw = await page.request.get("/draw");
  const homeCsp = home.headers()["content-security-policy"];
  const drawCsp = draw.headers()["content-security-policy"];
  expect(headerValue(effectiveHeaders(rules, "/"), "Content-Security-Policy")).toEqual([homeCsp]);
  expect(headerValue(effectiveHeaders(rules, "/draw"), "Content-Security-Policy")).toEqual([drawCsp]);
  expect(draw.headers()["x-content-type-options"]).toBe("nosniff");
  expect(draw.headers()["x-frame-options"]).toBe("DENY");
  expect(draw.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(homeCsp).not.toContain("blob:");
  expect((drawCsp.match(/default-src/g) ?? []).length).toBe(1);
});

test("draw, paste, export, save, and reload stay on this origin", async ({ page }) => {
  const requests = await installPageHooks(page);
  const response = await page.goto("/draw");
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator(".excalidraw")).toBeVisible();
  await page.screenshot({ path: `${artifacts}/draw-empty-1440.png`, fullPage: false });
  const mark = await waitUntilQuiet(page, requests);
  const origin = originOf(page.url());

  await drawRectangle(page);
  await page.screenshot({ path: `${artifacts}/draw-drawing-1440.png`, fullPage: false });
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

test("quota failure shows the not saved notice", async ({ page }) => {
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
  await expect(notice.getByRole("button", { name: "Save to file" })).toBeVisible();
  const download = page.waitForEvent("download");
  await notice.getByRole("button", { name: "Save to file" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.excalidraw$/i);
  await page.screenshot({ path: `${artifacts}/draw-not-saved-1440.png`, fullPage: false });
  const csp = await violations(page);
  expect(csp, JSON.stringify(csp, null, 2)).toEqual([]);
});
