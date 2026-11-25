/**
 * Small IndexedDB key-value store for the drawing page.
 * One database, one object store, last write wins across tabs.
 */

export const DRAW_DB_NAME = "sdf-draw";
export const DRAW_STORE = "kv";
export const SCENE_KEY = "scene";
export const FILE_KEY_PREFIX = "file:";

const VERSION = 1;

let database: IDBDatabase | null = null;
let opening: Promise<IDBDatabase> | null = null;

export function openDrawDb(): Promise<IDBDatabase> {
  if (database) return Promise.resolve(database);
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DRAW_DB_NAME, VERSION);
    } catch (error) {
      opening = null;
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAW_STORE)) db.createObjectStore(DRAW_STORE);
    };
    request.onsuccess = () => {
      database = request.result;
      database.onversionchange = () => {
        database?.close();
        database = null;
        opening = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      opening = null;
      reject(request.error ?? new DOMException("IndexedDB open failed", "UnknownError"));
    };
  });
  return opening;
}

function rejectTransaction(tx: IDBTransaction, reject: (reason: unknown) => void) {
  reject(tx.error ?? new DOMException("IndexedDB transaction failed", "UnknownError"));
}

export function idbGet<T>(key: string): Promise<T | undefined> {
  return openDrawDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        let tx: IDBTransaction;
        let value: T | undefined;
        try {
          tx = db.transaction(DRAW_STORE, "readonly");
          const request = tx.objectStore(DRAW_STORE).get(key);
          request.onsuccess = () => {
            value = request.result as T | undefined;
          };
        } catch (error) {
          reject(error);
          return;
        }
        tx.oncomplete = () => resolve(value);
        tx.onabort = () => rejectTransaction(tx, reject);
        tx.onerror = () => rejectTransaction(tx, reject);
      }),
  );
}

export function idbKeys(): Promise<IDBValidKey[]> {
  return openDrawDb().then(
    (db) =>
      new Promise<IDBValidKey[]>((resolve, reject) => {
        let tx: IDBTransaction;
        let keys: IDBValidKey[] = [];
        try {
          tx = db.transaction(DRAW_STORE, "readonly");
          const request = tx.objectStore(DRAW_STORE).getAllKeys();
          request.onsuccess = () => {
            keys = request.result;
          };
        } catch (error) {
          reject(error);
          return;
        }
        tx.oncomplete = () => resolve(keys);
        tx.onabort = () => rejectTransaction(tx, reject);
        tx.onerror = () => rejectTransaction(tx, reject);
      }),
  );
}

/**
 * Puts and deletes in one transaction. When the database is already open the
 * transaction starts before this function returns, so pagehide can flush.
 */
export function idbWrite(
  puts: [string, unknown][],
  deletes: string[],
  onComplete?: () => void,
): Promise<void> {
  if (!database) {
    return openDrawDb().then(() => idbWrite(puts, deletes));
  }
  const db = database;
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(DRAW_STORE, "readwrite");
      const store = tx.objectStore(DRAW_STORE);
      for (const key of deletes) store.delete(key);
      for (const [key, value] of puts) store.put(value, key);
    } catch (error) {
      reject(error);
      return;
    }
    tx.oncomplete = () => {
      onComplete?.();
      resolve();
    };
    tx.onabort = () => rejectTransaction(tx, reject);
    tx.onerror = () => rejectTransaction(tx, reject);
  });
}
