import { QueryClient } from '@tanstack/react-query';

/**
 * Global TanStack Query Client for LifeOS.
 * Configured with optimal caching, stale times, and background revalidation.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
