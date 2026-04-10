import { QueryClient } from "@tanstack/react-query";

function isNetworkLikeError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("timeout")
  );
}

export const mobileQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep warm cache for smooth transitions, refresh in background.
      staleTime: 20 * 1000,
      gcTime: 15 * 60 * 1000,
      retry: (failureCount, error) => {
        if (isNetworkLikeError(error)) return false;
        return failureCount < 1;
      },
      networkMode: "online",
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
      refetchInterval: false,
      refetchIntervalInBackground: false,
    },
    mutations: {
      retry: (failureCount, error) => {
        if (isNetworkLikeError(error)) return false;
        return failureCount < 1;
      },
      networkMode: "online",
    },
  },
});
