function normalizePathSegment(path: string | undefined, label: string) {
  const trimmed = (path ?? "").trim();

  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");

  if (withoutTrailingSlash === "/") {
    throw new Error(`${label} must not resolve to root path.`);
  }

  // Keep the value safe to embed in route strings and regexes downstream.
  if (!/^[A-Za-z0-9/_-]+$/.test(withoutTrailingSlash)) {
    throw new Error(`${label} contains unsupported characters.`);
  }

  return withoutTrailingSlash;
}

export function getHiddenAdminRoute(path: string) {
  return normalizePathSegment(path, "Hidden admin route");
}

export function getHiddenAdminApiBase(path: string) {
  return `/api${getHiddenAdminRoute(path)}`;
}

export function getAdminSummaryApiPath(path: string) {
  return `${getHiddenAdminApiBase(path)}/summary`;
}

export function getAdminLoginApiPath(path: string) {
  return `${getHiddenAdminApiBase(path)}/login`;
}

export function getAdminRemovalRequestsApiPath(path: string) {
  return `${getHiddenAdminApiBase(path)}/removal-requests`;
}

export function buildAdminResolveApiPath(path: string, id: number) {
  return `${getAdminRemovalRequestsApiPath(path)}/${id}/resolve`;
}

export function getAdminExportApiPath(path: string) {
  return `${getHiddenAdminApiBase(path)}/export`;
}
