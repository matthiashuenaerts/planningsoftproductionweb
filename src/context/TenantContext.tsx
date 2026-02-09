import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTenantLookupFromLocation, type TenantLookup } from "@/lib/tenant";

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
  lookup: TenantLookup;
  tenant: TenantInfo | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const lookup = useMemo(() => getTenantLookupFromLocation(), []);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [isLoading, setIsLoading] = useState(lookup.mode === "tenant");
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (lookup.mode !== "tenant") return;

    setIsLoading(true);
    setError(null);

    const { data, error } = await supabase.rpc("resolve_tenant", {
      p_slug: lookup.slug ?? null,
      p_domain: lookup.domain ?? null,
    });

    if (error) {
      setTenant(null);
      setError(error.message);
      setIsLoading(false);
      return;
    }

    const resolved = Array.isArray(data) ? data[0] : data;

    if (!resolved) {
      setTenant(null);
      setError("Tenant not found");
      setIsLoading(false);
      return;
    }

    setTenant(resolved as TenantInfo);
    setIsLoading(false);
  };

  useEffect(() => {
    if (lookup.mode === "tenant") {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TenantContext.Provider value={{ lookup, tenant, isLoading, error, refresh }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within a TenantProvider");
  return ctx;
};
