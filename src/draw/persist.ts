import "./asset-path";
/**
 * Scene persistence for /draw.
 *
 * The scene document is `serializeAsJSON(..., "local")`. Image files are stored
 * under separate keys (`file:<id>`) so a stroke does not rewrite every image.
 * A save re-checks which file keys are present in that same transaction, and
 * writes an image again when another tab has deleted it. The cache is updated
 * in the transaction's oncomplete, so a failed write is retried. A scene that
 * could not be parsed does not delete the image keys stored beside it.
 * The embedded `files` map is removed from the stored scene string; restore
 * merges the separate keys back in before `restore()`.
 *
 * A scene that cannot be parsed is copied to `scene.corrupt-<timestamp>` and
 * removed from `scene` in that same transaction. It is not replaced with a
 * blank document. If that copy fails, autosave stays off so the raw value
 * remains under `scene`.
 *
 * Multi-tab: last write wins. There is no lock, version, or broadcast.
 */
import { restore, serializeAsJSON } from "@excalidraw/excalidraw";
import { FILE_KEY_PREFIX, SCENE_KEY, idbGet, idbKeys, idbSaveDrawing, idbWrite } from "./idb";

const PAPER = "#F6F1E8";
const INK = "#2F3640";

/**
 * File ids this tab last saw in the store. A save still re-checks the store
 * inside its own transaction before it skips a put. On a corrupt scene this
 * set is cleared so the blank replacement cannot treat every image as stale.
 */
let knownFileIds: Set<string> | null = null;
/** A corrupt scene must not delete the image keys that were stored beside it. */
let retainStoredFiles = false;

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
  /** Raw scene text when parse or restore threw. Null otherwise. */
  corruptRaw: string | null;
  /** Image files that were stored beside a scene that could not be opened. */
  corruptFiles: SceneFiles | null;
  /** False when a write would destroy a scene that could not be preserved. */
  canAutosave: boolean;
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

function emptyLoad(storageAvailable: boolean): LoadedDrawing {
  return {
    initialData: blankScene(),
    restored: false,
    storageAvailable,
    corruptRaw: null,
    corruptFiles: null,
    canAutosave: storageAvailable,
  };
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

async function keepCorrupt(raw: string): Promise<boolean> {
  try {
    await idbWrite([[`scene.corrupt-${Date.now()}`, raw]], [SCENE_KEY]);
    return true;
  } catch {
    return false;
  }
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
    return emptyLoad(false);
  }
  if (typeof raw !== "string" || raw.length === 0) return emptyLoad(true);
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
      corruptRaw: null,
      corruptFiles: null,
      canAutosave: true,
    };
  } catch {
    knownFileIds = new Set();
    retainStoredFiles = true;
    const files = await readFiles().catch(() => ({}) as SceneFiles);
    const preserved = await keepCorrupt(raw);
    return {
      initialData: blankScene(),
      restored: false,
      storageAvailable: true,
      corruptRaw: raw,
      corruptFiles: files,
      canAutosave: preserved,
    };
  }
}

/** A download of an unreadable scene, with the stored image files embedded. */
export function corruptSceneDownload(raw: string, files: SceneFiles): string {
  const stored = files ?? {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const embedded =
        parsed.files && typeof parsed.files === "object" ? (parsed.files as SceneFiles) : {};
      return JSON.stringify({ ...parsed, files: { ...embedded, ...stored } });
    }
  } catch {
    // The saved text is not JSON. Keep it beside the image files.
  }
  return JSON.stringify({
    type: "excalidraw",
    version: 2,
    source: "https://softwaredecisionfabric.tech/draw",
    elements: [],
    appState: { viewBackgroundColor: PAPER, currentItemStrokeColor: INK },
    files: stored,
    corruptScene: raw,
  });
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
  const known = knownFileIds ?? new Set<string>();
  return idbSaveDrawing(scene, embedded, {
    known,
    deleteMissingFiles: !retainStoredFiles,
    onComplete: () => {
      knownFileIds = live;
    },
  });
}
