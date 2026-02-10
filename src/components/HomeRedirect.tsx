import React from "react";
import { Navigate } from "react-router-dom";
import { getTenantLookupFromLocation } from "@/lib/tenant";
import LandingPage from "@/pages/LandingPage";

const HomeRedirect: React.FC = () => {
  const lookup = getTenantLookupFromLocation();

  // Base domain: show public landing/marketing page
  if (lookup.mode === "developer") {
    return <LandingPage />;
  }

  // Tenant subdomain: redirect to tenant login
  return <Navigate to="/login" replace />;
};

export default HomeRedirect;
