import React from "react";
import { useMarketingLang } from "@/components/marketing/useMarketingLang";
import { CheckCircle2 } from "lucide-react";
import heroDashboard from "@/assets/marketing/hero-dashboard.jpg";
import SEOHead from "@/components/marketing/SEOHead";

interface FeatureBlock {
  titleKey: string;
  descKey: string;
  bulletsKey: string;
  image: string;
}

const features: FeatureBlock[] = [
  { titleKey: "feat_project_title", descKey: "feat_project_desc", bulletsKey: "feat_project_bullets", image: "/images/marketing/project-management.jpg" },
  { titleKey: "feat_planning_title", descKey: "feat_planning_desc", bulletsKey: "feat_planning_bullets", image: "/images/marketing/planning-gantt.jpg" },
  { titleKey: "feat_rush_title", descKey: "feat_rush_desc", bulletsKey: "feat_rush_bullets", image: "/images/marketing/rush-orders.jpg" },
  { titleKey: "feat_install_title", descKey: "feat_install_desc", bulletsKey: "feat_install_bullets", image: "/images/marketing/installation-planning.jpg" },
  { titleKey: "feat_logistics_title", descKey: "feat_logistics_desc", bulletsKey: "feat_logistics_bullets", image: "/images/marketing/logistics.jpg" },
  { titleKey: "feat_time_title", descKey: "feat_time_desc", bulletsKey: "feat_time_bullets", image: "/images/marketing/time-registration.jpg" },
  { titleKey: "feat_dashboard_title", descKey: "feat_dashboard_desc", bulletsKey: "feat_dashboard_bullets", image: "/images/marketing/dashboards.jpg" },
  { titleKey: "feat_broken_title", descKey: "feat_broken_desc", bulletsKey: "feat_broken_bullets", image: "/images/marketing/broken-parts.jpg" },
  { titleKey: "feat_hr_title", descKey: "feat_hr_desc", bulletsKey: "feat_hr_bullets", image: "/images/marketing/dashboards.jpg" },
];

const MarketingFeatures: React.FC = () => {
  const { t } = useMarketingLang();

  return (
    <>
      {/* Hero header */}
      <section className="relative pt-28 pb-20 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-[#195F85]/15 rounded-full blur-[150px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:80px_80px]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 text-center">
          <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-blue-400/80 mb-4">Product</span>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-5 leading-tight">{t("features_title")}</h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-14">{t("features_subtitle")}</p>
          
          {/* Hero showcase image */}
          <div className="max-w-5xl mx-auto relative group">
            <div className="absolute -inset-2 bg-gradient-to-r from-[#195F85]/20 to-cyan-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-500" />
            <div className="relative rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-blue-500/10">
              <img src={heroDashboard} alt="Features overview" className="w-full" loading="eager" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B1120]/40 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Feature blocks */}
      <section className="pb-28">
        <div className="max-w-7xl mx-auto px-6 space-y-32">
          {features.map((f, i) => {
            const bullets = t(f.bulletsKey).split("|");
            const reversed = i % 2 === 1;
            return (
              <div
                key={f.titleKey}
                className={`flex flex-col ${reversed ? "lg:flex-row-reverse" : "lg:flex-row"} gap-16 items-center`}
              >
                {/* Image */}
                <div className="lg:w-1/2">
                  <div className="relative group">
                    <div className="absolute -inset-3 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-white/[0.02]">
                      <img
                        src={f.image}
                        alt={t(f.titleKey)}
                        className="w-full transition-transform duration-700 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0B1120]/20 via-transparent to-transparent" />
                    </div>
                  </div>
                </div>
                {/* Text */}
                <div className="lg:w-1/2">
                  <span className="inline-block text-xs font-semibold uppercase tracking-[0.15em] text-blue-400/60 mb-3">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h2 className="text-3xl md:text-4xl font-extrabold mb-5 leading-tight">{t(f.titleKey)}</h2>
                  <p className="text-slate-400 mb-8 leading-relaxed text-base">{t(f.descKey)}</p>
                  <ul className="space-y-4">
                    {bullets.map((b, bi) => (
                      <li key={bi} className="flex items-start gap-3">
                        <div className="h-6 w-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle2 className="h-4 w-4 text-blue-400" />
                        </div>
                        <span className="text-slate-300 text-sm leading-relaxed">{b.trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
};

export default MarketingFeatures;
