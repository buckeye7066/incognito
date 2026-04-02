import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: true,
			retry: 1,
			staleTime: 30 * 1000,
			gcTime: 10 * 60 * 1000,
		},
	},
});
