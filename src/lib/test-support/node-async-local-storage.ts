import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Next's request storage uses `globalThis.AsyncLocalStorage` when the module
 * first loads. Node only exposes it from `node:async_hooks`, so a test that
 * enters a request scope (to call a Server Action) has to install it first.
 * This module must be imported before anything that loads `next`.
 */
const globalAls = globalThis as typeof globalThis & {
  AsyncLocalStorage?: typeof AsyncLocalStorage;
};

if (!globalAls.AsyncLocalStorage) {
  globalAls.AsyncLocalStorage = AsyncLocalStorage;
}
