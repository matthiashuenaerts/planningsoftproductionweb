import React from "react";
import { Button } from "@/components/ui/button";
import { useMarketingLang } from "@/components/marketing/useMarketingLang";
import { ArrowRight, Mail, Sparkles } from "lucide-react";
import gradientBg from "@/assets/marketing/gradient-bg.jpg";

const MarketingContact: React.FC = () => {
  const { t } = useMarketingLang();

  return (
    <section className="relative py-40 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img src={gradientBg} alt="" className="w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-[#0B1120]/60" />
      </div>
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#195F85]/20 rounded-full blur-[150px]" />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-5 py-2 text-sm text-slate-300 mb-8">
          <Sparkles className="h-4 w-4 text-amber-400" />
          {t("contact_badge") || "Get started today"}
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">{t("contact_title")}</h1>
        
        <p className="text-slate-400 text-lg mb-3 leading-relaxed">
          {t("contact_subtitle")}
        </p>
        <p className="mb-4">
          <code className="text-blue-300 bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 rounded-xl text-sm font-medium">
            yourcompany.automattion-compass.com
          </code>
        </p>
        <p className="text-slate-500 mb-12">
          {t("contact_or")}{" "}
          <a
            href="mailto:info@automattion-compass.com"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-4 transition-colors"
          >
            {t("contact_email")}
          </a>
        </p>
        
        <a href="mailto:info@automattion-compass.com">
          <Button
            size="lg"
            className="bg-gradient-to-r from-[#195F85] to-[#42A5DB] hover:from-[#164f70] hover:to-[#3994c5] text-white px-12 h-16 text-lg font-semibold shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] rounded-2xl"
          >
            <Mail className="mr-3 h-5 w-5" />
            {t("contact_cta")}
            <ArrowRight className="ml-3 h-5 w-5" />
          </Button>
        </a>
      </div>
    </section>
  );
};

export default MarketingContact;
