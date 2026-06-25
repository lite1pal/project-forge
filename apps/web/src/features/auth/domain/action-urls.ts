export function buildAuthActionUrl(
  apiBaseUrl: string,
  path: string,
  query?: Record<string, string | undefined>
) {
  const url = new URL(path, apiBaseUrl);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}
