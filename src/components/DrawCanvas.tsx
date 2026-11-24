import "../draw/asset-path";
import { useEffect, useRef, useState } from "react";
import { Excalidraw, serializeAsJSON } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import "../styles/draw-excalidraw.css";
// Image paste resizes through these packages. Importing them here puts the
// chunks in the first load, so a paste does not fetch anything afterwards.
import "pica";
import "image-blob-reduce";
import { loadDrawing, saveDrawing, type DrawingInitialData } from "../draw/persist";

const SAVE_DELAY_MS = 500;

type SceneElements = Parameters<typeof serializeAsJSON>[0];
type SceneAppState = Parameters<typeof serializeAsJSON>[1];
type SceneFiles = Parameters<typeof serializeAsJSON>[2];
type DrawApi = {
  getSceneElements: () => SceneElements;
  getAppState: () => SceneAppState;
  getFiles: () => SceneFiles;
};

type PendingScene = {
  elements: SceneElements;
  appState: SceneAppState;
  files: SceneFiles;
};

const loaded = loadDrawing();

const uiOptions = {
  canvasActions: {
    toggleTheme: false,
    export: { saveFileToDisk: true },
  },
} as const;

function downloadScene(api: DrawApi) {
  const json = serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), "local");
  const blob = new Blob([json], { type: "application/vnd.excalidraw+json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "drawing.excalidraw";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function DrawCanvas() {
  const apiRef = useRef<DrawApi | null>(null);
  const pendingRef = useRef<PendingScene | null>(null);
  const timerRef = useRef<number | null>(null);
  const allowSaveRef = useRef(false);
  const writeRef = useRef(0);
  const [notSaved, setNotSaved] = useState(false);
  const [initialData] = useState<Promise<DrawingInitialData>>(() => loaded.then((result) => result.initialData));
  const setNotSavedRef = useRef(setNotSaved);
  setNotSavedRef.current = setNotSaved;

  const flushRef = useRef<() => Promise<void>>(async () => {});
  flushRef.current = async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    const token = ++writeRef.current;
    try {
      await saveDrawing(pending.elements, pending.appState, pending.files);
      if (token !== writeRef.current) return;
      if (pendingRef.current === pending) pendingRef.current = null;
      setNotSavedRef.current(false);
    } catch {
      if (token === writeRef.current) setNotSavedRef.current(true);
    }
  };

  const onChange = useRef((elements: SceneElements, appState: SceneAppState, files: SceneFiles) => {
    if (!allowSaveRef.current) return;
    pendingRef.current = { elements, appState, files };
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void flushRef.current();
    }, SAVE_DELAY_MS);
  }).current;

  const onApi = useRef((api: DrawApi) => {
    apiRef.current = api;
  }).current;

  useEffect(() => {
    let live = true;
    void loaded.then((result) => {
      if (!live) return;
      if (!result.storageAvailable) setNotSaved(true);
      // Excalidraw applies initialData in the microtask queued before this one.
      // Waiting a frame keeps that first apply from being written back.
      requestAnimationFrame(() => {
        if (live) allowSaveRef.current = true;
      });
    });
    const onHide = () => {
      void flushRef.current();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flushRef.current();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      live = false;
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      void flushRef.current();
    };
  }, []);

  return (
    <div className="draw-host">
      {notSaved ? (
        <div className="draw-unsaved" role="alert">
          <p>Not saved in this browser. The drawing is still on this page.</p>
          <button
            type="button"
            onClick={() => {
              const api = apiRef.current;
              if (api) downloadScene(api);
            }}
          >
            Save to file
          </button>
        </div>
      ) : null}
      <Excalidraw
        initialData={initialData}
        excalidrawAPI={onApi}
        onChange={onChange}
        theme="light"
        langCode="en"
        aiEnabled={false}
        validateEmbeddable={false}
        UIOptions={uiOptions}
        autoFocus
      />
    </div>
  );
}
