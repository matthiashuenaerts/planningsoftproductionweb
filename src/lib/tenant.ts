export type TenantMode = "public" | "developer" | "tenant";

export type TenantLookup =
  | { mode: "public" }
  | { mode: "developer" }
  | { mode: "tenant"; slug: string };

/**
 * Resolve tenant from a URL pathname.
 * 
 * /                     → public (landing page)
 * /dev, /dev/login      → developer
 * /thonon/...           → tenant with slug "thonon"
 */
export function getTenantFromPath(pathname: string): TenantLookup {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return { mode: "public" };
  }

  if (segments[0] === "dev") {
    return { mode: "developer" };
  }

  // First segment is the tenant slug
  return { mode: "tenant", slug: segments[0] };
}

/** @deprecated Use getTenantFromPath instead */
export function getTenantLookupFromLocation(loc: Location = window.location): TenantLookup {
  return getTenantFromPath(loc.pathname);
}
