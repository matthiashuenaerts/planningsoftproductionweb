import React from "react";
import { Link } from "react-router-dom";
import { useMarketingLang } from "./useMarketingLang";

const MarketingFooter: React.FC = () => {
  const { t } = useMarketingLang();

  return (
    <footer className="border-t border-white/10 py-8 bg-[#0B1120]">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <img
            src="https://static.wixstatic.com/media/99c033_5bb79e52130d4fa6bbae75d9a22b198d~mv2.png"
            alt="Logo"
            className="h-6 w-auto rounded"
          />
          <span className="text-sm text-slate-400">
            © {new Date().getFullYear()} AutoMattiOn Compass. {t("footer_rights")}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/dev/login"
            className="text-sm text-slate-500 hover:text-slate-300 transition"
          >
            {t("footer_developer")}
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default MarketingFooter;
