import React from "react";
import { Navigate } from "react-router-dom";
import { getTenantLookupFromLocation } from "@/lib/tenant";

const HomeRedirect: React.FC = () => {
  const lookup = getTenantLookupFromLocation();

  if (lookup.mode === "developer") {
    return <Navigate to="/dev" replace />;
  }

  return <Navigate to="/nl/" replace />;
};

export default HomeRedirect;
