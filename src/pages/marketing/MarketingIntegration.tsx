import React from "react";
import { useMarketingLang } from "@/components/marketing/useMarketingLang";
import { RefreshCw, Download, CheckCircle, Plug, Code } from "lucide-react";

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
      {/* CrownBase Pro integration */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4">{t("integration_title")}</h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">{t("integration_subtitle")}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <div className="rounded-xl border border-white/10 overflow-hidden shadow-xl">
              <img
                src="/images/marketing/crownbase-integration.jpg"
                alt="CrownBase Pro Integration"
                className="w-full"
                loading="lazy"
              />
            </div>
            <div className="space-y-6">
              {integrations.map((item) => (
                <div key={item.key} className="flex gap-4">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <item.Icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">{t(item.key)}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{t(item.desc)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tech stack */}
          <div className="border-t border-white/5 pt-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">{t("tech_title")}</h2>
              <p className="text-slate-400">{t("tech_subtitle")}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {techItems.map((k) => (
                <div
                  key={k}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <Code className="h-4 w-4 text-blue-400 mt-1 flex-shrink-0" />
                  <span className="text-sm text-slate-300">{t(k)}</span>
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
