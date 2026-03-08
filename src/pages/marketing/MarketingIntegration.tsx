import React from "react";
import { useMarketingLang } from "@/components/marketing/useMarketingLang";
import { RefreshCw, Download, CheckCircle, Plug, Code } from "lucide-react";
import integrationNetwork from "@/assets/marketing/integration-network.jpg";
import heroDashboard from "@/assets/marketing/hero-dashboard.jpg";
import SEOHead from "@/components/marketing/SEOHead";

const MarketingIntegration: React.FC = () => {
  const { t } = useMarketingLang();

  const integrations = [
    { key: "integration_sync", desc: "integration_sync_desc", Icon: RefreshCw },
    { key: "integration_import", desc: "integration_import_desc", Icon: Download },
    { key: "integration_confirm", desc: "integration_confirm_desc", Icon: CheckCircle },
    { key: "integration_api", desc: "integration_api_desc", Icon: Plug },
  ];

  const techItems = [
    "tech_typescript", "tech_supabase", "tech_react", "tech_tailwind",
    "tech_vite", "tech_netlify", "tech_resend", "tech_mail_detail",
  ];

  return (
    <>
      {/* Hero with network image */}
      <section className="relative pt-28 pb-20 overflow-hidden">
        <div className="absolute inset-0">
          <img src={integrationNetwork} alt="" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-[#0B1120]/70" />
          <div className="absolute top-0 left-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/80 mb-4">{t("nav_integration")}</span>
            <h1 className="text-4xl md:text-6xl font-extrabold mb-5 leading-tight">{t("integration_title")}</h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">{t("integration_subtitle")}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-28">
            <div className="relative group">
              <div className="absolute -inset-3 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                <img
                  src={heroDashboard}
                  alt="CrownBase Pro Integration"
                  className="w-full"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B1120]/30 via-transparent to-transparent" />
              </div>
            </div>
            <div className="space-y-8">
              {integrations.map((item) => (
                <div key={item.key} className="flex gap-5 group">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500/15 to-cyan-500/10 flex items-center justify-center flex-shrink-0 group-hover:from-blue-500/25 group-hover:to-cyan-500/15 transition-all duration-300">
                    <item.Icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-1.5 text-base">{t(item.key)}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{t(item.desc)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tech stack */}
          <div className="border-t border-white/[0.06] pt-20">
            <div className="text-center mb-12">
              <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 mb-4">Stack</span>
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4">{t("tech_title")}</h2>
              <p className="text-slate-400">{t("tech_subtitle")}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
              {techItems.map((k) => (
                <div
                  key={k}
                  className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300"
                >
                  <Code className="h-4 w-4 text-blue-400 mt-1 flex-shrink-0" />
                  <span className="text-sm text-slate-300 leading-relaxed">{t(k)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default MarketingIntegration;
