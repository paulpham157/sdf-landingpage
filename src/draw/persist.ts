import "./asset-path";
/**
 * Scene persistence for /draw.
 *
 * The scene document is `serializeAsJSON(..., "local")`. Image files are stored
 * under separate keys (`file:<id>`) so a stroke does not rewrite every image.
 * Only ids that are not already in `knownFileIds` are written. That set is
 * updated in the transaction's oncomplete, so a failed write is retried.
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
  /** Raw scene text when parse or restore threw. Null otherwise. */
  corruptRaw: string | null;
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

function fileKey(id: string) {
  return `${FILE_KEY_PREFIX}${id}`;
}

function emptyLoad(storageAvailable: boolean): LoadedDrawing {
  return {
    initialData: blankScene(),
    restored: false,
    storageAvailable,
    corruptRaw: null,
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
      canAutosave: true,
    };
  } catch {
    const preserved = await keepCorrupt(raw);
    return {
      initialData: blankScene(),
      restored: false,
      storageAvailable: true,
      corruptRaw: raw,
      canAutosave: preserved,
    };
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

  const write = (known: Set<string>) => {
    const stale = [...known].filter((id) => !live.has(id)).map((id) => fileKey(id));
    const puts: [string, unknown][] = [[SCENE_KEY, scene]];
    for (const [id, file] of Object.entries(embedded)) {
      if (!known.has(id)) puts.push([fileKey(id), file]);
    }
    return idbWrite(puts, stale, () => {
      knownFileIds = live;
    });
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
