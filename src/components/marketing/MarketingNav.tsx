import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Globe } from "lucide-react";
import { useMarketingLang } from "./useMarketingLang";

const langLabels: Record<string, string> = { nl: "NL", en: "EN", fr: "FR" };

const MarketingNav: React.FC = () => {
  const { lang, t, changeLang, supportedLangs } = useMarketingLang();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const links = [
    { to: `/site/features?lang=${lang}`, label: t("nav_features") },
    { to: `/site/solutions?lang=${lang}`, label: t("nav_solutions") },
    { to: `/site/integration?lang=${lang}`, label: t("nav_integration") },
    { to: `/site/contact?lang=${lang}`, label: t("nav_contact") },
  ];

  const isActive = (path: string) => location.pathname === path.split("?")[0];

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0B1120]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to={`/site?lang=${lang}`} className="flex items-center gap-2">
          <img
            src="https://static.wixstatic.com/media/99c033_5bb79e52130d4fa6bbae75d9a22b198d~mv2.png"
            alt="Logo"
            className="h-8 w-auto rounded"
          />
          <span className="font-bold text-lg">
            <span className="text-[#195F85]">AutoMattiOn</span>{" "}
            <span className="text-[#42A5DB]">Compass</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link key={l.to} to={l.to}>
              <Button
                variant="ghost"
                size="sm"
                className={`text-sm ${
                  isActive(l.to)
                    ? "text-white bg-white/10"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {l.label}
              </Button>
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-2">
          {/* Language switcher */}
          <div className="flex items-center gap-1 border border-white/10 rounded-lg px-1 py-0.5">
            <Globe className="h-3.5 w-3.5 text-slate-500 ml-1" />
            {supportedLangs.map((l) => (
              <button
                key={l}
                onClick={() => changeLang(l)}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  lang === l
                    ? "bg-white/10 text-white"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                {langLabels[l]}
              </button>
            ))}
          </div>

          <a href="mailto:info@automattion.com">
            <Button
              size="sm"
              className="bg-gradient-to-r from-[#195F85] to-[#42A5DB] text-white text-sm font-semibold"
            >
              {t("nav_demo")}
            </Button>
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-white"
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-white/10 bg-[#0B1120] px-6 py-4 space-y-2">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="block py-2 text-slate-300 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
          <div className="flex gap-2 pt-2">
            {supportedLangs.map((l) => (
              <button
                key={l}
                onClick={() => { changeLang(l); setOpen(false); }}
                className={`px-3 py-1.5 text-sm rounded ${
                  lang === l
                    ? "bg-white/10 text-white"
                    : "text-slate-500"
                }`}
              >
                {langLabels[l]}
              </button>
            ))}
          </div>
          <a href="mailto:info@automattion.com" className="block pt-2">
            <Button className="w-full bg-gradient-to-r from-[#195F85] to-[#42A5DB] text-white">
              {t("nav_demo")}
            </Button>
          </a>
        </div>
      )}
    </nav>
  );
};

export default MarketingNav;
