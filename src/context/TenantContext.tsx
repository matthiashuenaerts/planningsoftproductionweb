import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

export type TenantInfo = {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  logo_url: string | null;
  is_active: boolean;
  settings: any;
};

type TenantContextType = {
  tenantSlug: string | null;
  tenant: TenantInfo | null;
  isLoading: boolean;
  error: string | null;
  setSlug: (slug: string) => void;
  refresh: () => Promise<void>;
};

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveTenant = useCallback(async (slug: string) => {
    setIsLoading(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("resolve_tenant", {
      p_slug: slug,
      p_domain: null,
    });

    if (rpcError) {
      setTenant(null);
      setError(rpcError.message);
      setIsLoading(false);
      return;
    }

    const resolved = Array.isArray(data) ? data[0] : data;
    if (!resolved) {
      setTenant(null);
      setError("Tenant not found");
    } else {
      setTenant(resolved as TenantInfo);
    }
    setIsLoading(false);
  }, []);

  const setSlug = useCallback((slug: string) => {
    setTenantSlug(slug);
  }, []);

  useEffect(() => {
    if (tenantSlug) {
      resolveTenant(tenantSlug);
    }
  }, [tenantSlug, resolveTenant]);

  const refresh = useCallback(async () => {
    if (tenantSlug) await resolveTenant(tenantSlug);
  }, [tenantSlug, resolveTenant]);

  return (
    <TenantContext.Provider value={{ tenantSlug, tenant, isLoading, error, setSlug, refresh }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within a TenantProvider");
  return ctx;
};
