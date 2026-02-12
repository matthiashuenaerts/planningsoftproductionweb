import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useMarketingLang } from "@/components/marketing/useMarketingLang";
import thononLogo from "@/assets/thonon-logo.png";
import {
  ArrowRight,
  CheckCircle2,
  Globe,
  Zap,
  Shield,
  BarChart3,
  Layers,
  Monitor,
  Users,
  Cog,
  AlertTriangle,
} from "lucide-react";

const coreIcons = [Monitor, Zap, Cog, BarChart3, Layers, Globe, Shield, Users];

const painIcons = [
  AlertTriangle,
  AlertTriangle,
  AlertTriangle,
  AlertTriangle,
  AlertTriangle,
  AlertTriangle,
  AlertTriangle,
];

const MarketingHome: React.FC = () => {
  const { lang, t } = useMarketingLang();

  const painKeys = [
    "pain_1", "pain_2", "pain_3", "pain_4", "pain_5", "pain_6", "pain_7",
  ];

  const coreKeys = [
    { key: "core_web", desc: "core_web_desc" },
    { key: "core_digital", desc: "core_digital_desc" },
    { key: "core_flex", desc: "core_flex_desc" },
    { key: "core_scale", desc: "core_scale_desc" },
    { key: "core_integrate", desc: "core_integrate_desc" },
    { key: "core_lang", desc: "core_lang_desc" },
    { key: "core_security", desc: "core_security_desc" },
    { key: "core_care", desc: "core_care_desc" },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-500/15 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-sm text-blue-300 mb-8">
            <CheckCircle2 className="h-4 w-4" />
            {t("hero_badge")}
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#42A5DB] to-[#195F85]">
              {t("hero_title_1")}
            </span>
            <br />
            <span className="text-white">{t("hero_title_2")}</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            {t("hero_subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="mailto:info@automattion.com">
              <Button
                size="lg"
                className="bg-gradient-to-r from-[#195F85] to-[#42A5DB] hover:from-[#164f70] hover:to-[#3994c5] text-white px-8 h-12 text-base font-semibold shadow-lg shadow-blue-500/25"
              >
                {t("hero_cta")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
            <Link to="/thonon/nl">
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 hover:bg-white/10 text-white px-6 h-12 text-base font-semibold gap-3"
              >
                <img src={thononLogo} alt="Thonon" className="h-6 w-auto" />
                {t("hero_portal")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* App screenshot */}
      <section className="py-4">
        <div className="max-w-5xl mx-auto px-6">
          <div className="rounded-xl border border-white/10 overflow-hidden shadow-2xl shadow-blue-500/10">
            <img
              src="/images/marketing/hero-overview.jpg"
              alt="AutoMattiOn Compass Overview"
              className="w-full"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* Pain points */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("pain_title")}</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">{t("pain_subtitle")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {painKeys.map((k, i) => (
              <div
                key={k}
                className="flex items-start gap-3 rounded-xl border border-red-500/10 bg-red-500/[0.03] p-5 hover:bg-red-500/[0.06] transition"
              >
                <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-slate-300">{t(k)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core values */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("core_title")}</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">{t("core_subtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {coreKeys.map((c, i) => {
              const Icon = coreIcons[i];
              return (
                <div
                  key={c.key}
                  className="group rounded-xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.06] hover:border-blue-500/30 transition-all duration-300"
                >
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-white mb-2">{t(c.key)}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{t(c.desc)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA to features */}
      <section className="py-16 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Link to={`/site/features?lang=${lang}`}>
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 hover:bg-white/10 text-white px-8 h-12"
            >
              {t("nav_features")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">{t("contact_title")}</h2>
          <p className="text-slate-400 mb-8">
            {t("contact_subtitle")}{" "}
            <code className="text-blue-300">yourcompany.automattion-compass.com</code>
          </p>
          <a href="mailto:info@automattion.com">
            <Button
              size="lg"
              className="bg-gradient-to-r from-[#195F85] to-[#42A5DB] hover:from-[#164f70] hover:to-[#3994c5] text-white px-8 h-12"
            >
              {t("contact_cta")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </div>
      </section>
    </>
  );
};

export default MarketingHome;
