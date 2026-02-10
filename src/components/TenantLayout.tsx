import React, { useEffect } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useTenant } from "@/context/TenantContext";

/**
 * Layout wrapper for /:tenant/* routes.
 * Reads the :tenant URL param and sets it in context.
 */
const TenantLayout: React.FC = () => {
  const { tenant } = useParams<{ tenant: string }>();
  const { setSlug } = useTenant();

  useEffect(() => {
    if (tenant) {
      setSlug(tenant);
    }
  }, [tenant, setSlug]);

  return <Outlet />;
};

export default TenantLayout;
