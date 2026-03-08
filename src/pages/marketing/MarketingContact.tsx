import React from "react";
import { Button } from "@/components/ui/button";
import { useMarketingLang } from "@/components/marketing/useMarketingLang";
import { ArrowRight, Mail, Sparkles, Phone, MapPin, Clock } from "lucide-react";
import contactBg from "@/assets/marketing/contact-bg.jpg";
import SEOHead from "@/components/marketing/SEOHead";

const seoMeta: Record<string, { title: string; desc: string }> = {
  nl: { title: "Contact | AutoMattiOn Compass - Demo Aanvragen", desc: "Neem contact op voor een demo van AutoMattiOn Compass. Productieplanning software op maat voor meubelfabrikanten in België." },
  en: { title: "Contact | AutoMattiOn Compass - Request a Demo", desc: "Get in touch for a demo of AutoMattiOn Compass. Custom production planning software for furniture manufacturers in Belgium." },
  fr: { title: "Contact | AutoMattiOn Compass - Demander une Démo", desc: "Contactez-nous pour une démo d'AutoMattiOn Compass. Logiciel de planification sur mesure pour fabricants de meubles en Belgique." },
};

const MarketingContact: React.FC = () => {
  const { lang, t } = useMarketingLang();
  const seo = seoMeta[lang] || seoMeta.nl;

  const contactDetails = [
    { icon: Mail, label: "info@automattion-compass.com", href: "mailto:info@automattion-compass.com" },
    { icon: MapPin, label: t("contact_location") || "Belgium" },
    { icon: Clock, label: t("contact_hours") || "Mon-Fri, 9:00 - 17:00 CET" },
  ];

  return (
    <>
      <SEOHead title={seo.title} description={seo.desc} path="/site/contact" lang={lang} />
      {/* Hero contact */}
      <section className="relative py-40 overflow-hidden">
        <div className="absolute inset-0">
          <img src={contactBg} alt="" className="w-full h-full object-cover opacity-50" />
          <div className="absolute inset-0 bg-[#0B1120]/50" />
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

      {/* Contact details strip */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {contactDetails.map((d, i) => (
              <div key={i} className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-300">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <d.icon className="h-5 w-5 text-blue-400" />
                </div>
                {d.href ? (
                  <a href={d.href} className="text-sm text-slate-300 hover:text-white transition-colors">{d.label}</a>
                ) : (
                  <span className="text-sm text-slate-300">{d.label}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default MarketingContact;
