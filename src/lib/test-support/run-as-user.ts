import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external.js";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external.js";
import { RequestCookies } from "next/dist/server/web/spec-extension/cookies.js";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createSessionToken } from "@/lib/auth/session-token";

/**
 * Run a server action inside a fake request: `cookies()` sees a session cookie for userId
 * (or none when userId is null). Import "@/lib/test-support/node-async-local-storage" first.
 */
export const runAsUser = async <T>(
  userId: string | null,
  task: () => Promise<T>,
  options: { onboarded?: boolean; pathname?: string } = {},
): Promise<T> => {
  process.env.AUTH_SECRET ??= "test-secret-for-run-as-user";
  const pathname = options.pathname ?? "/titulos/test";
  const cookie = userId
    ? `${SESSION_COOKIE_NAME}=${await createSessionToken(
        { id: userId, email: `${userId}@filmia.test`, name: "Test" },
        { onboarded: options.onboarded ?? true, sessionVersion: 0 },
      )}`
    : "";
  const headerList = new Headers(cookie ? { cookie } : {});
  const requestCookies = new RequestCookies(headerList);
  const workStore = {
    page: pathname,
    route: pathname,
    forceStatic: false,
    dynamicShouldError: false,
    incrementalCache: {},
    pendingRevalidatedTags: [] as unknown[],
  };
  const workUnitStore = {
    type: "request" as const,
    phase: "action" as const,
    implicitTags: { tags: [] as string[], expirationsByCacheKind: new Map() },
    url: { pathname, search: "" },
    headers: headerList,
    cookies: requestCookies,
    mutableCookies: requestCookies,
    userspaceMutableCookies: requestCookies,
    rootParams: {},
    resumeDataCache: null,
  };

  return workAsyncStorage.run(workStore as never, () =>
    workUnitAsyncStorage.run(workUnitStore as never, task),
  ) as Promise<T>;
};
