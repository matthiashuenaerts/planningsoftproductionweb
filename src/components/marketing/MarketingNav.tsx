import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Globe, ArrowRight } from "lucide-react";
import { useMarketingLang } from "./useMarketingLang";

const langLabels: Record<string, string> = { nl: "NL", en: "EN", fr: "FR" };

const MarketingNav: React.FC = () => {
  const { lang, t, changeLang, supportedLangs } = useMarketingLang();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const links = [
    { to: `/site/features?lang=${lang}`, label: t("nav_features") },
    { to: `/site/solutions?lang=${lang}`, label: t("nav_solutions") },
    { to: `/site/integration?lang=${lang}`, label: t("nav_integration") },
    { to: `/site/contact?lang=${lang}`, label: t("nav_contact") },
  ];

  const isActive = (path: string) => location.pathname === path.split("?")[0];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled
        ? "bg-[#0B1120]/80 backdrop-blur-xl border-b border-white/[0.06] shadow-lg shadow-black/20"
        : "bg-transparent"
    }`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to={`/site?lang=${lang}`} className="flex items-center gap-2.5 group">
          <img
            src="https://static.wixstatic.com/media/99c033_5bb79e52130d4fa6bbae75d9a22b198d~mv2.png"
            alt="Logo"
            className="h-8 w-auto rounded transition-transform duration-300 group-hover:scale-105"
          />
          <span className="font-bold text-lg tracking-tight">
            <span className="text-[#42A5DB]">AutoMattiOn</span>{" "}
            <span className="text-white/70">Compass</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link key={l.to} to={l.to}>
              <button
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive(l.to)
                    ? "text-white bg-white/10"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                }`}
              >
                {l.label}
              </button>
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-3">
          {/* Language switcher */}
          <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.06] rounded-xl px-1.5 py-1">
            <Globe className="h-3.5 w-3.5 text-slate-500 ml-1 mr-1" />
            {supportedLangs.map((l) => (
              <button
                key={l}
                onClick={() => changeLang(l)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all duration-200 ${
                  lang === l
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                {langLabels[l]}
              </button>
            ))}
          </div>

          <a href="mailto:info@automattion-compass.com">
            <Button
              size="sm"
              className="bg-gradient-to-r from-[#195F85] to-[#42A5DB] text-white text-sm font-semibold h-9 px-5 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/25 transition-all duration-300"
            >
              {t("nav_demo")}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-white/[0.06] bg-[#0B1120]/95 backdrop-blur-xl px-6 py-5 space-y-1 animate-fade-in">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className={`block py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                isActive(l.to)
                  ? "text-white bg-white/10"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <div className="flex gap-2 pt-3 px-4">
            {supportedLangs.map((l) => (
              <button
                key={l}
                onClick={() => { changeLang(l); setOpen(false); }}
                className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${
                  lang === l
                    ? "bg-white/10 text-white"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                {langLabels[l]}
              </button>
            ))}
          </div>
          <div className="pt-3 px-4">
            <a href="mailto:info@automattion-compass.com" className="block">
              <Button className="w-full bg-gradient-to-r from-[#195F85] to-[#42A5DB] text-white h-12 font-semibold">
                {t("nav_demo")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      )}
    </nav>
  );
};

export default MarketingNav;
