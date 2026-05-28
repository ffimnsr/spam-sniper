function normalizePathSegment(path: string, label: string) {
  const trimmed = path.trim();

  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");

  if (withoutTrailingSlash === "/") {
    throw new Error(`${label} must not resolve to root path.`);
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

export function getAdminRemovalRequestsApiPath(path: string) {
  return `${getHiddenAdminApiBase(path)}/removal-requests`;
}

export function buildAdminResolveApiPath(path: string, id: number) {
  return `${getAdminRemovalRequestsApiPath(path)}/${id}/resolve`;
}

export function getAdminExportApiPath(path: string) {
  return `${getHiddenAdminApiBase(path)}/export`;
}
