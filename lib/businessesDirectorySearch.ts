export const BUSINESSES_DIRECTORY_SEARCH_PARAM = 'q';

export function readBusinessesDirectorySearchQuery(
  searchParams: URLSearchParams | { get: (key: string) => string | null }
): string {
  return searchParams.get(BUSINESSES_DIRECTORY_SEARCH_PARAM) ?? '';
}

export function businessesDirectorySearchPath(query: string, baseParams?: URLSearchParams): string {
  const params = new URLSearchParams(baseParams?.toString() ?? '');
  if (query) params.set(BUSINESSES_DIRECTORY_SEARCH_PARAM, query);
  else params.delete(BUSINESSES_DIRECTORY_SEARCH_PARAM);
  const qs = params.toString();
  return qs ? `/businesses?${qs}` : '/businesses';
}
