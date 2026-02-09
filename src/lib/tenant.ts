export type TenantMode = "developer" | "tenant";

export type TenantLookup =
  | { mode: "developer" }
  | { mode: "tenant"; slug?: string; domain?: string };

const BASE_DOMAIN = "automattion-compass.com";

function getTenantOverrideFromQuery(loc: Location): string | null {
  try {
    const params = new URLSearchParams(loc.search);
    return params.get("tenant");
  } catch {
    return null;
  }
}

export function getTenantLookupFromLocation(loc: Location = window.location): TenantLookup {
  const override = getTenantOverrideFromQuery(loc);
  if (override) {
    return { mode: "tenant", slug: override };
  }

  const host = (loc.hostname || "").toLowerCase();

  // Root domain -> developer portal
  if (host === BASE_DOMAIN || host === `www.${BASE_DOMAIN}`) {
    return { mode: "developer" };
  }

  // Subdomain of base domain -> tenant slug
  if (host.endsWith(`.${BASE_DOMAIN}`)) {
    const sub = host.slice(0, -(BASE_DOMAIN.length + 1));
    const slug = sub.split(".")[0];
    if (slug && slug !== "www") {
      return { mode: "tenant", slug };
    }
  }

  // Preview/dev hosts: default to the existing single-tenant slug
  if (
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".netlify.app") ||
    host === "localhost" ||
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1")
  ) {
    return { mode: "tenant", slug: "default" };
  }

  // Otherwise treat as custom domain tenant
  return { mode: "tenant", domain: host };
}
