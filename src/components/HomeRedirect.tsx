import React from "react";
import { Navigate } from "react-router-dom";

const HomeRedirect: React.FC = () => {
  return <Navigate to="/site?lang=nl" replace />;
};

export default HomeRedirect;
