import "./asset-path";
/**
 * Scene persistence for /draw.
 *
 * The scene document is `serializeAsJSON(..., "local")`. Image files are stored
 * under separate keys (`file:<id>`) so a stroke does not rewrite every image.
 * The embedded `files` map is removed from the stored scene string; restore
 * merges the separate keys back in before `restore()`.
 *
 * Multi-tab: last write wins. There is no lock, version, or broadcast.
 */
import { restore, serializeAsJSON } from "@excalidraw/excalidraw";
import { FILE_KEY_PREFIX, SCENE_KEY, idbGet, idbKeys, idbWrite } from "./idb";

const PAPER = "#F6F1E8";
const INK = "#2F3640";

/** File ids already stored. Lets a pagehide flush start its transaction immediately. */
let knownFileIds: Set<string> | null = null;

type SceneElements = Parameters<typeof serializeAsJSON>[0];
type SceneAppState = Parameters<typeof serializeAsJSON>[1];
type SceneFiles = Parameters<typeof serializeAsJSON>[2];

export type DrawingInitialData = {
  elements: SceneElements;
  appState: SceneAppState;
  files: SceneFiles;
};

export type LoadedDrawing = {
  initialData: DrawingInitialData;
  /** True when a previous scene was restored. Colors are left as saved. */
  restored: boolean;
  /** False when IndexedDB cannot be opened (private mode or a blocked DB). */
  storageAvailable: boolean;
};

function blankScene(): DrawingInitialData {
  return {
    elements: [],
    appState: {
      viewBackgroundColor: PAPER,
      currentItemStrokeColor: INK,
    },
    files: {},
  };
}

function fileKey(id: string) {
  return `${FILE_KEY_PREFIX}${id}`;
}

async function readFiles(): Promise<SceneFiles> {
  const keys = await idbKeys();
  const files: Record<string, SceneFiles[string]> = {};
  for (const key of keys) {
    if (typeof key !== "string" || !key.startsWith(FILE_KEY_PREFIX)) continue;
    const id = key.slice(FILE_KEY_PREFIX.length);
    const value = await idbGet<SceneFiles[string]>(key);
    if (value && typeof value === "object") files[id] = value;
  }
  return files;
}

export async function loadDrawing(): Promise<LoadedDrawing> {
  let raw: string | undefined;
  try {
    raw = await idbGet<string>(SCENE_KEY);
    const keys = await idbKeys();
    knownFileIds = new Set(
      keys
        .filter((key): key is string => typeof key === "string" && key.startsWith(FILE_KEY_PREFIX))
        .map((key) => key.slice(FILE_KEY_PREFIX.length)),
    );
  } catch {
    knownFileIds = new Set();
    return { initialData: blankScene(), restored: false, storageAvailable: false };
  }
  if (typeof raw !== "string" || raw.length === 0) {
    return { initialData: blankScene(), restored: false, storageAvailable: true };
  }
  try {
    const parsed = JSON.parse(raw) as {
      elements?: SceneElements;
      appState?: SceneAppState;
      files?: SceneFiles;
    };
    const separateFiles = await readFiles();
    const restored = restore(
      {
        elements: parsed.elements ?? [],
        appState: parsed.appState ?? {},
        files: { ...(parsed.files ?? {}), ...separateFiles },
      },
      null,
      null,
    );
    return {
      initialData: {
        elements: restored.elements,
        appState: restored.appState,
        files: restored.files,
      },
      restored: true,
      storageAvailable: true,
    };
  } catch {
    return { initialData: blankScene(), restored: false, storageAvailable: true };
  }
}

export function saveDrawing(
  elements: SceneElements,
  appState: SceneAppState,
  files: SceneFiles,
): Promise<void> {
  const serialized = serializeAsJSON(elements, appState, files, "local");
  const parsed = JSON.parse(serialized) as {
    files?: SceneFiles;
  };
  const embedded = parsed.files ?? {};
  parsed.files = {};
  const scene = JSON.stringify(parsed);
  const live = new Set(Object.keys(embedded));
  const puts: [string, unknown][] = [[SCENE_KEY, scene]];
  for (const [id, file] of Object.entries(embedded)) puts.push([fileKey(id), file]);

  const write = (known: Set<string>) => {
    const stale = [...known].filter((id) => !live.has(id)).map((id) => fileKey(id));
    knownFileIds = live;
    return idbWrite(puts, stale);
  };
  if (knownFileIds) return write(knownFileIds);
  return idbKeys().then((keys) => {
    const known = new Set(
      keys
        .filter((key): key is string => typeof key === "string" && key.startsWith(FILE_KEY_PREFIX))
        .map((key) => key.slice(FILE_KEY_PREFIX.length)),
    );
    return write(known);
  });
}
