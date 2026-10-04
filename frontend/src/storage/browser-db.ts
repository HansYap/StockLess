/**
 * The one browser database (IndexedDB) for everything StockLess keeps on this computer.
 *
 * Every feature opens it through this file so the version number and the list of stores
 * stay in one place. To add a store, add its name to StoreName, bump DB_VERSION and create
 * the store in `upgrade` behind an `oldVersion` check so data already saved is kept.
 */

const DB_NAME = "stockless";
const DB_VERSION = 2;

export type StoreName = "mapping_templates" | "datasets";

/** Creates the stores that did not exist in the browser's previous database version. */
function upgrade(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) db.createObjectStore("mapping_templates", { keyPath: "headersKey" });
  if (oldVersion < 2) {
    const datasets = db.createObjectStore("datasets", { keyPath: "id" });
    datasets.createIndex("shop_and_name", ["shopKey", "nameKey"], { unique: true });
  }
}

/** Runs a multi-request operation in one atomic transaction. */
export function withTransaction<T>(
  stores: readonly StoreName[],
  mode: IDBTransactionMode,
  run: (transaction: IDBTransaction, result: (value: T) => void) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DB_NAME, DB_VERSION);
    opening.onupgradeneeded = (event) => upgrade(opening.result, event.oldVersion);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      let value: T;
      try {
        const transaction = db.transaction([...stores], mode);
        transaction.oncomplete = () => resolve(value);
        transaction.onabort = () => reject(transaction.error ?? new Error("Browser storage transaction failed."));
        transaction.onerror = () => reject(transaction.error ?? new Error("Browser storage transaction failed."));
        run(transaction, (next) => { value = next; });
      } catch (error) {
        reject(error);
      } finally {
        db.close();
      }
    };
  });
}

/** Runs one request in its own transaction and resolves once that transaction commits. */
export function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DB_NAME, DB_VERSION);
    opening.onupgradeneeded = (event) => upgrade(opening.result, event.oldVersion);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      try {
        const transaction = db.transaction(storeName, mode);
        const request = run(transaction.objectStore(storeName));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onabort = () => reject(transaction.error);
      } catch (error) {
        reject(error);
      } finally {
        // Closing waits for the transaction to finish, and never leaves a connection open
        // that would block a later version upgrade or a "Delete everything".
        db.close();
      }
    };
  });
}
