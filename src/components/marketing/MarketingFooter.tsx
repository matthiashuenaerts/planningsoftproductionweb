import React from "react";
import { Link } from "react-router-dom";
import { useMarketingLang } from "./useMarketingLang";
import { Mail, ArrowUpRight } from "lucide-react";

const MarketingFooter: React.FC = () => {
  const { lang, t } = useMarketingLang();

  const productLinks = [
    { to: `/site/features?lang=${lang}`, label: t("nav_features") },
    { to: `/site/solutions?lang=${lang}`, label: t("nav_solutions") },
    { to: `/site/integration?lang=${lang}`, label: t("nav_integration") },
  ];

  const companyLinks = [
    { to: `/site/contact?lang=${lang}`, label: t("nav_contact") },
    { to: "/dev/login", label: t("footer_developer") },
  ];

  return (
    <footer className="border-t border-white/[0.06] bg-[#060D1B]">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <img
                src="https://static.wixstatic.com/media/99c033_5bb79e52130d4fa6bbae75d9a22b198d~mv2.png"
                alt="Logo"
                className="h-8 w-auto rounded"
              />
              <span className="font-bold text-lg tracking-tight">
                <span className="text-[#42A5DB]">AutoMattiOn</span>{" "}
                <span className="text-white/70">Compass</span>
              </span>
            </div>
            <p className="text-sm text-slate-500 max-w-sm leading-relaxed mb-6">
              {t("hero_subtitle")}
            </p>
            <a
              href="mailto:info@automattion-compass.com"
              className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Mail className="h-4 w-4" />
              info@automattion-compass.com
            </a>
          </div>

          {/* Product links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 mb-4">Product</h4>
            <ul className="space-y-3">
              {productLinks.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-sm text-slate-400 hover:text-white transition-colors duration-200 flex items-center gap-1 group"
                  >
                    {l.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 -translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 mb-4">{t("footer_company") || "Company"}</h4>
            <ul className="space-y-3">
              {companyLinks.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-sm text-slate-400 hover:text-white transition-colors duration-200 flex items-center gap-1 group"
                  >
                    {l.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 -translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/[0.06] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xs text-slate-600">
            © {new Date().getFullYear()} AutoMattiOn Compass. {t("footer_rights")}
          </span>
          <div className="flex items-center gap-6">
            <span className="text-xs text-slate-600">{t("footer_privacy") || "Privacy"}</span>
            <span className="text-xs text-slate-600">{t("footer_terms") || "Terms"}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default MarketingFooter;
