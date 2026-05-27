// src/utils/dbUtils.js

const DB_NAME = 'hungryAppDB';
const DB_VERSION = 1; // Increment this version number if you change the schema
export const OBJECT_STORES = {
  RECEIPT_IMAGES: 'receiptImages',
  OFFLINE_DATA: 'offlineData', // Generic store for other large datasets
  SYNC_QUEUE: 'syncQueue', // Store for pending operations
};

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const dbInstance = event.target.result;
      if (!dbInstance.objectStoreNames.contains(OBJECT_STORES.RECEIPT_IMAGES)) {
        dbInstance.createObjectStore(OBJECT_STORES.RECEIPT_IMAGES, { keyPath: 'id' });
      }
      if (!dbInstance.objectStoreNames.contains(OBJECT_STORES.OFFLINE_DATA)) {
        dbInstance.createObjectStore(OBJECT_STORES.OFFLINE_DATA, { keyPath: 'id' });
      }
      if (!dbInstance.objectStoreNames.contains(OBJECT_STORES.SYNC_QUEUE)) {
        dbInstance.createObjectStore(OBJECT_STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      console.error("IndexedDB error:", event.target.errorCode);
      reject(new Error("Failed to open IndexedDB"));
    };
  });
}

async function getObjectStore(storeName, mode) {
  const database = await openDB();
  const transaction = database.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

export async function put(storeName, data) {
  const store = await getObjectStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

export async function getAll(storeName) {
  const store = await getObjectStore(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

export async function get(storeName, id) {
  const store = await getObjectStore(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

export async function remove(storeName, id) {
  const store = await getObjectStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

export async function clearStore(storeName) {
  const store = await getObjectStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}