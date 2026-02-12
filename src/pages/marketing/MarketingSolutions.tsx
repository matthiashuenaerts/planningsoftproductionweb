import React from "react";
import { useMarketingLang } from "@/components/marketing/useMarketingLang";
import { TrendingUp, Truck, RefreshCw, MessageCircle } from "lucide-react";

const solutions = [
  { titleKey: "sol_efficiency_title", problemKey: "sol_efficiency_problem", solutionKey: "sol_efficiency_solution", Icon: TrendingUp },
  { titleKey: "sol_logistics_title", problemKey: "sol_logistics_problem", solutionKey: "sol_logistics_solution", Icon: Truck },
  { titleKey: "sol_flexibility_title", problemKey: "sol_flexibility_problem", solutionKey: "sol_flexibility_solution", Icon: RefreshCw },
  { titleKey: "sol_communication_title", problemKey: "sol_communication_problem", solutionKey: "sol_communication_solution", Icon: MessageCircle },
];

const MarketingSolutions: React.FC = () => {
  const { t } = useMarketingLang();

  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">{t("solutions_title")}</h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">{t("solutions_subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {solutions.map((s) => (
            <div
              key={s.titleKey}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 hover:border-blue-500/20 transition-all"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <s.Icon className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold">{t(s.titleKey)}</h3>
              </div>

              {/* Problem */}
              <div className="mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-1 block">
                  {t("sol_problem")}
                </span>
                <p className="text-slate-400 text-sm leading-relaxed border-l-2 border-red-500/30 pl-4">
                  {t(s.problemKey)}
                </p>
              </div>

              {/* Solution */}
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1 block">
                  {t("sol_solution")}
                </span>
                <p className="text-slate-300 text-sm leading-relaxed border-l-2 border-emerald-500/30 pl-4">
                  {t(s.solutionKey)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MarketingSolutions;
