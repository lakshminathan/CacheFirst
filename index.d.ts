// Type definitions for CacheFirst 0.6.0
// Project: https://github.com/lakshminathan/CacheFirst
// Definitions by: Auto-generated

export interface CacheOptions {
  cacheKey?: string;
  ttl?: number; // milliseconds
}

export type CacheFirstHandler = (data: any, isFresh: boolean, response?: Response) => void;

export interface ChainEnd {
  catch(cb: (err: any) => void): void;
}

export interface Chain extends ChainEnd {
  json(cb: CacheFirstHandler): ChainEnd;
  text(cb: CacheFirstHandler): ChainEnd;
  blob(cb: CacheFirstHandler): ChainEnd;
  arrayBuffer(cb: CacheFirstHandler): ChainEnd;
}

export function fetch(input: RequestInfo | URL, init?: RequestInit, cacheOptions?: CacheOptions): Chain;
export function clear(key: string): Promise<void>;
export function clearAll(): Promise<void>;
export function setCatch(fn: (err: any) => void): void;

export as namespace CacheFirst;

