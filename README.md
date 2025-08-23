# CacheFirst

CacheFirst is a lightweight, isomorphic JavaScript library that provides a cache-first strategy for fetching and storing data in web applications. It supports caching in localStorage, IndexedDB, and in-memory, making it ideal for fast, reliable data access and offline experiences.

Current version: 0.6.0

## Features
- Cache-first fetch API for JSON, Blob, Text, and ArrayBuffer
- Automatic cache key generation (SHA-256 of request arguments)
- Custom cache keys (`cacheKey` option)
- Time-To-Live (TTL) expiration per request (`ttl` option in ms)
- Automatic cache update only when payload changes (content hash compare)
- Multi-tier storage: in-memory (SSR), localStorage (small payloads), IndexedDB (larger)
- Registry-based bulk clear APIs (`clear`, `clearAll`)
- Pluggable error handler (`setCatch` / `.catch()` chain)
- Zero dependencies, UMD build (works with ESM/CJS/global)
- TypeScript definitions included

## Installation
### CDN
```html
<script src="https://unpkg.com/cachefirst@latest/cachefirst.min.js"></script>
```
### NPM
```bash
npm install cachefirst
```

## Basic Usage
```js
CacheFirst.fetch('https://api.example.com/data')
  .json((data, isFresh, response) => {
    console.log('Data', data);
    console.log('Fresh from network?', isFresh);
  })
  .catch(err => console.error(err));
```
`isFresh` is `false` for an immediate cached emission (if present) and `true` when the network response (if different) arrives.

## Advanced Usage
### Custom Cache Key
```js
CacheFirst.fetch('https://api.example.com/user/123', { method: 'GET' }, { cacheKey: 'user:123' })
  .json(cb);
```
### TTL (Expire After 5 Minutes)
```js
CacheFirst.fetch('https://api.example.com/config', { method: 'GET' }, { ttl: 5 * 60 * 1000 })
  .json(cb);
```
### Combined Options (second param RequestInit, third param cache options)
```js
CacheFirst.fetch('https://api.example.com/list', { headers: { 'X-Feature': 'A' } }, { ttl: 10000, cacheKey: 'list:A' })
  .json(cb);
```
### Manual Cache Clearing
```js
await CacheFirst.clear('user:123'); // remove a specific entry
await CacheFirst.clearAll();        // purge everything managed by CacheFirst
```
### Global Error Handler
```js
CacheFirst.setCatch(err => console.warn('CacheFirst error', err));
```
Or per-call chain:
```js
CacheFirst.fetch(url).json(cb).catch(err => console.error(err));
```

## API Reference
### fetch(input, [requestInit], [cacheOptions])
`cacheOptions` supports:
- `cacheKey?: string` custom key overriding auto-hash
- `ttl?: number` milliseconds-to-live; expired entries are purged lazily

Returns a chain object with:
- `.json(handler)`
- `.text(handler)`
- `.blob(handler)`
- `.arrayBuffer(handler)`
- `.catch(handler)` set error callback

Handler signature:
```ts
(data: any, isFresh: boolean, response?: Response) => void
```

### clear(key: string): Promise<void>
Remove a specific cached entry (all tiers).

### clearAll(): Promise<void>
Remove all entries created via CacheFirst.

### setCatch(fn: (err: any) => void): void
Set a global error handler.

## How It Works
1. Derives (or uses provided) cache key.
2. Emits cached data (if present & not expired) immediately.
3. Performs a network fetch with a cache-busting query param (`userLocalTime`).
4. Clones response; reads body twice safely.
5. Hashes body with the response reader function name to detect meaningful changes.
6. Updates cache only if content hash differs.
7. Emits fresh data if changed.

## TypeScript
Basic typings are included (see `index.d.ts`).

## Sample
See `sample.html` for a runnable demonstration.

## Roadmap Ideas
- Stale-while-revalidate mode toggle
- Batch preloading
- Size-based eviction policy
- Optional compression

## License
MIT

## Contributing
PRs and issues welcome.

## Author
Lakshminathan S
