import { QueryClient } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

// Per React Query SSR guidance: fresh client per request on the server,
// shared singleton in the browser. Avoids cross-request state leakage in SSR
// (which caused stale data hydration mismatches).
export function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
