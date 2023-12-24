/*!
 * CacheFirst v0.2.0
 * https://github.com/lakshminathan/CacheFirst
 *
 * Copyright SaasCrafts Foundation and other contributors
 * Released under the MIT license
 * https://github.com/lakshminathan/CacheFirst/blob/main/LICENSE
 *
 * Date: Fri Dec 29 2023 18:40:31 GMT+0530 (India Standard Time)
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

  function blob2string(data) {
    if (data === null) return null;
    return new Promise((resolve, reject) => {
      data.text().then(data => {
        resolve(data);
      });
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

  async function retrieveObjectFromIndexedDB(key) {
    return new Promise(async (resolve, reject) => {
      const db = await openDB();
      const transaction = db.transaction(objectStoreName, 'readonly');
      const result = await transaction.objectStore(objectStoreName).get(key);
      result.onsuccess = function (event) {
        const data = event?.target?.result?.value;
        data ? resolve(data) : resolve({});
      };
      await transaction.complete;
      db.close();
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
    let _fetchPromise = fetchwrapper(...arguments);
    function responseHandlerFn(callback, fn) {
      _fetchPromise.then(async data => {
        if (data.cachedResponse) { // data present in cache
          callback(data.cachedResponse, false);
        }
        let resolvedResponse = await data.response;
        if (!resolvedResponse.ok) {
          catchCallback(resolvedResponse);
          return;
        }
        let resolvedData = await resolvedResponse[fn](); // replaces old data in cache and returns data only if it is different
        if (resolvedData) {
          callback(resolvedData, true, resolvedResponse);
        }
      });
    }
    let commonFunctions = {
      catch: (callback) => {
        catchCallback = callback;
      }
    };
    return {
      json: (callback) => {
        responseHandlerFn(callback, "json");
        return commonFunctions;
      },
      text: (callback) => {
        responseHandlerFn(callback, "text");
        return commonFunctions;
      },
      blob: (callback) => {
        responseHandlerFn(callback, "blob");
        return commonFunctions;
      },
      arrayBuffer: (callback) => {
        responseHandlerFn(callback, "arrayBuffer");
        return commonFunctions;
      }
    };
  }

  async function fetchwrapper() {
    const requestHash = await sha256(arguments);
    const { data: cachedResponse, hash: cachedResponseHash } = await retrieveFromCache(requestHash);
    const response = new Promise((resolve, reject) => {
      let request = new Request(...arguments);
      let url = new URL(request.url);
      url.searchParams.set('userLocalTime', Date());
      let requestWithoutCache = new Request(url.toString(), request); // to prevent browser level caching
      fetch(requestWithoutCache).then(async newResponseOriginal => {
        const resolveProxy = {};
        let newResponseClone = newResponseOriginal.clone();
        for (const property in Object.getPrototypeOf(newResponseClone)) {
          if (typeof newResponseClone[property] == 'function') {
            resolveProxy[property] = async () => {
              const data = await newResponseOriginal[property]();
              const responseText = await newResponseClone.text();
              const hash = await sha256(property + responseText);
              const newCachedResponse = { hash, data };
              storeInCache(requestHash, newCachedResponse);
              if (hash == cachedResponseHash) {
                return;
              }
              return data;
            }
          } else {
            resolveProxy[property] = newResponseClone[property];
          }
        }
        resolve(resolveProxy);
      }).catch(err => {
        catchCallback(err);
      })
    });
    return {
      response,
      cachedResponse
    };
  }
  exports.fetch = _fetch;
})));
