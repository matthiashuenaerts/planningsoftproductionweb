/**
 * Helper to add tenant_id filtering to Supabase queries.
 * 
 * When a developer user browses a specific tenant, RLS bypasses tenant isolation.
 * This helper ensures explicit tenant filtering at the application level.
 *
 * Usage in components:
 *   const { tenant } = useTenant();
 *   const data = await workstationService.getAll(tenant?.id);
 */

/**
 * Appends .eq('tenant_id', tenantId) to a Supabase query builder when tenantId is provided.
 * Uses `any` cast to avoid deep type instantiation issues with Supabase's complex generic types.
 */
export function applyTenantFilter(query: any, tenantId?: string | null): any {
  if (tenantId) {
    return query.eq('tenant_id', tenantId);
  }
  return query;
}
