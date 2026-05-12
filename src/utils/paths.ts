const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const externalPattern = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

export function withBase(path: string) {
  if (!path || externalPattern.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!basePath) {
    return normalizedPath;
  }

  if (normalizedPath === "/") {
    return `${basePath}/`;
  }

  if (normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`)) {
    return normalizedPath;
  }

  return `${basePath}${normalizedPath}`;
}
