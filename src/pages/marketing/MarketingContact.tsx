import React from "react";
import { Button } from "@/components/ui/button";
import { useMarketingLang } from "@/components/marketing/useMarketingLang";
import { ArrowRight, Mail } from "lucide-react";

const MarketingContact: React.FC = () => {
  const { t } = useMarketingLang();

  return (
    <section className="py-32">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-8">
          <Mail className="h-8 w-8 text-blue-400" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4">{t("contact_title")}</h1>
        <p className="text-slate-400 text-lg mb-2">
          {t("contact_subtitle")}{" "}
          <code className="text-blue-300">yourcompany.automattion-compass.com</code>
        </p>
        <p className="text-slate-500 mb-10">
          {t("contact_or")}{" "}
          <a
            href="mailto:info@automattion.com"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            {t("contact_email")}
          </a>
        </p>
        <a href="mailto:info@automattion.com">
          <Button
            size="lg"
            className="bg-gradient-to-r from-[#195F85] to-[#42A5DB] hover:from-[#164f70] hover:to-[#3994c5] text-white px-10 h-14 text-lg font-semibold shadow-lg shadow-blue-500/25"
          >
            {t("contact_cta")}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </a>
      </div>
    </section>
  );
};

export default MarketingContact;
