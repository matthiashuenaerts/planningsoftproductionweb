import React from "react";
import { Outlet } from "react-router-dom";
import MarketingNav from "./MarketingNav";
import MarketingFooter from "./MarketingFooter";

const MarketingLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0B1120] text-white">
      <MarketingNav />
      <Outlet />
      <MarketingFooter />
    </div>
  );
};

export default MarketingLayout;
