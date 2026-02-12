import React from "react";
import { useMarketingLang } from "@/components/marketing/useMarketingLang";

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
      {/* Header */}
      <section className="pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">{t("features_title")}</h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">{t("features_subtitle")}</p>
        </div>
      </section>

      {/* Feature blocks */}
      <section className="pb-24">
        <div className="max-w-7xl mx-auto px-6 space-y-24">
          {features.map((f, i) => {
            const bullets = t(f.bulletsKey).split("|");
            const reversed = i % 2 === 1;
            return (
              <div
                key={f.titleKey}
                className={`flex flex-col ${reversed ? "lg:flex-row-reverse" : "lg:flex-row"} gap-12 items-center`}
              >
                {/* Image */}
                <div className="lg:w-1/2">
                  <div className="rounded-xl border border-white/10 overflow-hidden shadow-xl shadow-blue-500/5">
                    <img
                      src={f.image}
                      alt={t(f.titleKey)}
                      className="w-full"
                      loading="lazy"
                    />
                  </div>
                </div>
                {/* Text */}
                <div className="lg:w-1/2">
                  <h2 className="text-2xl md:text-3xl font-bold mb-4">{t(f.titleKey)}</h2>
                  <p className="text-slate-400 mb-6 leading-relaxed">{t(f.descKey)}</p>
                  <ul className="space-y-3">
                    {bullets.map((b, bi) => (
                      <li key={bi} className="flex items-start gap-3">
                        <span className="h-6 w-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="h-2 w-2 rounded-full bg-blue-400" />
                        </span>
                        <span className="text-slate-300 text-sm">{b.trim()}</span>
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
