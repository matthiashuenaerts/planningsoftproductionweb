import React, { useEffect } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useTenant } from "@/context/TenantContext";
import AppOnboardingWizard from "@/components/AppOnboardingWizard";

/**
 * Layout wrapper for /:tenant/* routes.
 * Reads the :tenant URL param and sets it in context.
 * Wraps all tenant pages in the onboarding wizard (settings + tour).
 */
const TenantLayout: React.FC = () => {
  const { tenant } = useParams<{ tenant: string }>();
  const { setSlug } = useTenant();

  useEffect(() => {
    if (tenant) {
      setSlug(tenant);
    }
  }, [tenant, setSlug]);

  return (
    <AppOnboardingWizard>
      <Outlet />
    </AppOnboardingWizard>
  );
};

export default TenantLayout;
