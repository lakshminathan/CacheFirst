/*!
 * CacheFirst v0.6.0
 * https://github.com/lakshminathan/CacheFirst
 *
 * Copyright SaasCrafts Foundation and other contributors
 * Released under the MIT license
 * https://github.com/lakshminathan/CacheFirst/blob/main/LICENSE
 *
 * Date: Fri Dec 29 2023 18:40:31 GMT+0530 (India Standard Time)
 */

/**
 * CacheFirst - Cache-first fetch wrapper for web applications
 * Provides caching via localStorage, IndexedDB, or in-memory.
 * Usage: CacheFirst.fetch(url).json(callback).catch(errorCallback)
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
      (global = global || self, factory(global.CacheFirst = {}));
}(this, (function (exports) {

  const databaseName = "HASH_CACHE_DB";
  const objectStoreName = "HASH_CACHE_OB";
  const maxLocalStorageSize = 10_000;
  const isNotBrowser = typeof localStorage != 'object';
  const inMemoryCache = {};
  let catchCallback = (err) => console.error(err);
  const KEY_REGISTRY = 'CF_KEY_REG';

  function loadRegistry() {
    try {
      return JSON.parse(localStorage.getItem(KEY_REGISTRY) || '[]');
    } catch { return []; }
  }
  function saveRegistry(arr) {
    try { localStorage.setItem(KEY_REGISTRY, JSON.stringify(arr)); } catch {}
  }
  function registerKey(key) {
    if (isNotBrowser) return; // skip
    const reg = loadRegistry();
    if (!reg.includes(key)) { reg.push(key); saveRegistry(reg); }
  }
  function unregisterKey(key) {
    if (isNotBrowser) return; // skip
    const reg = loadRegistry().filter(k => k !== key);
    saveRegistry(reg);
  }

  async function deleteFromIndexedDB(key) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await openDB();
        const tx = db.transaction(objectStoreName, 'readwrite');
        tx.objectStore(objectStoreName).delete(key);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = e => { db.close(); reject(e.target.error); };
      } catch (e) { resolve(); }
    });
  }

  async function clearAllIndexedDB() {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await openDB();
        const tx = db.transaction(objectStoreName, 'readwrite');
        const store = tx.objectStore(objectStoreName);
        const request = store.clear();
        request.onsuccess = () => { db.close(); resolve(); };
        request.onerror = e => { db.close(); reject(e.target.error); };
      } catch (e) { resolve(); }
    });
  }

  async function stringify(input) {
    if (input === null || typeof input === 'string') {
      return input;
    }
    let output;
    switch (input.constructor.name) {
      case 'Object':
        output = JSON.stringify(input);
        break;
      case 'Blob':
        output = await blob2string(input);
        break;
      default:
        output = String(input);
    }
    return output;
  }

  // Improved error handling for blob2string
  function blob2string(data) {
    if (data === null) return null;
    return new Promise((resolve, reject) => {
      data.text().then(resolve).catch(reject);
    });
  }

  async function sha256(input) {
    input = await stringify(input);
    const data = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function storeObjectInIndexedDB(key, value) {
    const db = await openDB();
    const transaction = db.transaction(objectStoreName, 'readwrite');
    await transaction.objectStore(objectStoreName).put({ key, value });
    await transaction.complete;
    db.close();
  }

  // Improved retrieveObjectFromIndexedDB for error handling
  async function retrieveObjectFromIndexedDB(key) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await openDB();
        const transaction = db.transaction(objectStoreName, 'readonly');
        const request = transaction.objectStore(objectStoreName).get(key);
        request.onsuccess = function (event) {
          const data = event?.target?.result?.value;
          resolve(data ? data : {});
        };
        request.onerror = function (event) {
          reject(event.target.error);
        };
        transaction.oncomplete = function () {
          db.close();
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  async function retrieveFromCache(key) {
    if (isNotBrowser) {
      return inMemoryCache[key] || {};
    } else if (localStorage[key]) {
      return JSON.parse(localStorage[key]);
    } else {
      return retrieveObjectFromIndexedDB(key);
    }
  }

  function canStoreInLocalStorage(value) {
    if (['Object', 'String'].includes(value.constructor.name) && (JSON.stringify(value)).length < maxLocalStorageSize) {
      return true;
    }
    return false;
  }

  function storeInCache(key, value) {
    value.storedAt = Date.now();
    registerKey(key);
    if (isNotBrowser) {
      inMemoryCache[key] = value;
    } else if (canStoreInLocalStorage(value.data)) {
      localStorage[key] = JSON.stringify(value);
    } else {
      localStorage.removeItem(key);
      storeObjectInIndexedDB(key, value);
    }
  }

  async function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = event => {
        const db = event.target.result;
        db.createObjectStore(objectStoreName, { keyPath: 'key' });
      };
      request.onsuccess = event => resolve(event.target.result);
      request.onerror = event => reject(event.target.error);
    });
  }

  function _fetch() {
    let args = Array.from(arguments);
    let cacheOptions = {};
    if (args.length > 2 && typeof args[2] === 'object') {
      cacheOptions = args.pop();
    } else if (args.length === 2 && args[1] && typeof args[1] === 'object' && (args[1].cacheKey || args[1].ttl)) {
      cacheOptions = args.pop();
    }
    let _fetchPromise = fetchwrapper(args, cacheOptions);
    function responseHandlerFn(callback, fn) {
      _fetchPromise.then(async data => {
        if (data.cachedResponse !== undefined) { // cached and valid
            callback(data.cachedResponse, false);
        }
        let resolvedResponse = await data.response;
        if (!resolvedResponse.ok) {
          catchCallback(resolvedResponse);
          return;
        }
        let resolvedData = await resolvedResponse[fn]();
        if (resolvedData) {
          callback(resolvedData, true, resolvedResponse);
        }
      });
    }
    let commonFunctions = {
      catch: (callback) => { catchCallback = callback; }
    };
    return {
      json: (callback) => { responseHandlerFn(callback, "json"); return commonFunctions; },
      text: (callback) => { responseHandlerFn(callback, "text"); return commonFunctions; },
      blob: (callback) => { responseHandlerFn(callback, "blob"); return commonFunctions; },
      arrayBuffer: (callback) => { responseHandlerFn(callback, "arrayBuffer"); return commonFunctions; }
    };
  }

  // Improved fetchwrapper: better error handling, comments
  async function fetchwrapper(callArgs, cacheOptions) {
    const { cacheKey, ttl } = cacheOptions || {};
    const requestHash = cacheKey || await sha256(callArgs);
    const cachedObj = await retrieveFromCache(requestHash);
    let cachedResponse = cachedObj.data;
    const cachedResponseHash = cachedObj.hash;
    let expired = false;
    if (cachedObj && ttl && cachedObj.storedAt && (Date.now() - cachedObj.storedAt) > ttl) {
      expired = true;
      cachedResponse = undefined;
      // proactively remove stale entry
      clear(requestHash).catch(()=>{});
    }
    const response = new Promise((resolve, reject) => {
      try {
        let request = new Request(...callArgs);
        let url = new URL(request.url);
        url.searchParams.set('userLocalTime', Date());
        let requestWithoutCache = new Request(url.toString(), request);
        fetch(requestWithoutCache).then(async newResponseOriginal => {
          const resolveProxy = {};
          let newResponseClone = newResponseOriginal.clone();
          for (const property in Object.getPrototypeOf(newResponseClone)) {
            if (typeof newResponseClone[property] == 'function') {
              resolveProxy[property] = async () => {
                try {
                  const data = await newResponseOriginal[property]();
                  const responseText = await newResponseClone.text();
                  const hash = await sha256(property + responseText);
                  const newCachedResponse = { hash, data, ttl };
                  storeInCache(requestHash, newCachedResponse);
                  if (hash == cachedResponseHash) { return; }
                  return data;
                } catch (err) { catchCallback(err); return null; }
              }
            } else { resolveProxy[property] = newResponseClone[property]; }
          }
          resolve(resolveProxy);
        }).catch(err => { catchCallback(err); reject(err); })
      } catch (err) { catchCallback(err); reject(err); }
    });
    return { response, cachedResponse };
  }
  async function clear(key) {
    if (!key) return;
    try { localStorage.removeItem(key); } catch {}
    delete inMemoryCache[key];
    await deleteFromIndexedDB(key);
    unregisterKey(key);
  }
  async function clearAll() {
    const reg = isNotBrowser ? Object.keys(inMemoryCache) : loadRegistry();
    for (const k of reg) {
      try { localStorage.removeItem(k); } catch {}
      delete inMemoryCache[k];
      await deleteFromIndexedDB(k);
    }
    await clearAllIndexedDB();
    if (!isNotBrowser) saveRegistry([]);
  }
  function setCatch(fn){ catchCallback = fn; }

  exports.fetch = _fetch;
  exports.clear = clear;
  exports.clearAll = clearAll;
  exports.setCatch = setCatch;
})));
