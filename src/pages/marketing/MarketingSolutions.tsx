import React from "react";
import { useMarketingLang } from "@/components/marketing/useMarketingLang";
import { TrendingUp, Truck, RefreshCw, MessageCircle } from "lucide-react";
import solutionsFactory from "@/assets/marketing/solutions-factory.jpg";
import SEOHead from "@/components/marketing/SEOHead";

const solutions = [
  { titleKey: "sol_efficiency_title", problemKey: "sol_efficiency_problem", solutionKey: "sol_efficiency_solution", Icon: TrendingUp },
  { titleKey: "sol_logistics_title", problemKey: "sol_logistics_problem", solutionKey: "sol_logistics_solution", Icon: Truck },
  { titleKey: "sol_flexibility_title", problemKey: "sol_flexibility_problem", solutionKey: "sol_flexibility_solution", Icon: RefreshCw },
  { titleKey: "sol_communication_title", problemKey: "sol_communication_problem", solutionKey: "sol_communication_solution", Icon: MessageCircle },
];

const seoMeta: Record<string, { title: string; desc: string }> = {
  nl: { title: "Oplossingen | AutoMattiOn Compass Productiesoftware", desc: "Ontdek welke productie-uitdagingen AutoMattiOn Compass oplost: efficiëntie, logistiek, communicatie en flexibiliteit." },
  en: { title: "Solutions | AutoMattiOn Compass Production Software", desc: "Discover which production challenges AutoMattiOn Compass solves: efficiency, logistics, communication and flexibility." },
  fr: { title: "Solutions | AutoMattiOn Compass Logiciel de Production", desc: "Découvrez quels défis de production AutoMattiOn Compass résout : efficacité, logistique, communication et flexibilité." },
};

const MarketingSolutions: React.FC = () => {
  const { lang, t } = useMarketingLang();
  const seo = seoMeta[lang] || seoMeta.nl;

  return (
    <>
      <SEOHead title={seo.title} description={seo.desc} path="/site/solutions" lang={lang} />
      {/* Hero */}
      <section className="relative pt-28 pb-20 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-1/3 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[150px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:80px_80px]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80 mb-4">{t("nav_solutions")}</span>
              <h1 className="text-4xl md:text-5xl font-extrabold mb-5 leading-tight">{t("solutions_title")}</h1>
              <p className="text-slate-400 text-lg leading-relaxed">{t("solutions_subtitle")}</p>
            </div>
            <div className="hidden lg:block">
              <div className="relative group">
                <div className="absolute -inset-3 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                  <img src={solutionsFactory} alt="Solutions" className="w-full" loading="eager" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B1120]/30 via-transparent to-transparent" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution cards */}
      <section className="pb-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {solutions.map((s) => (
              <div
                key={s.titleKey}
                className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-8 hover:border-blue-500/20 hover:bg-white/[0.04] transition-all duration-500"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 flex items-center justify-center group-hover:from-blue-500/30 group-hover:to-cyan-500/20 transition-all">
                    <s.Icon className="h-6 w-6 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold">{t(s.titleKey)}</h3>
                </div>

                {/* Problem */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-red-400/80">
                      {t("sol_problem")}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed pl-4 border-l-2 border-red-500/20">
                    {t(s.problemKey)}
                  </p>
                </div>

                {/* Solution */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400/80">
                      {t("sol_solution")}
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed pl-4 border-l-2 border-emerald-500/20">
                    {t(s.solutionKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default MarketingSolutions;
