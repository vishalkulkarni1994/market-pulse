/**
 * Turns an article URL into the form used as the dedupe key:
 * lowercase host, no leading /amp path segment, no query string or fragment,
 * no trailing slash.
 */
export function normalizeUrl(raw: string): string {
  const url = new URL(raw.trim());
  url.search = '';
  url.hash = '';

  let path = url.pathname;
  if (path === '/amp' || path.startsWith('/amp/')) {
    path = path.slice('/amp'.length) || '/';
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  url.pathname = path;

  // The URL class already lowercases the host.
  return url.toString();
}
