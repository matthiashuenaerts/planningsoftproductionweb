import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useMarketingLang } from "@/components/marketing/useMarketingLang";
import SEOHead from "@/components/marketing/SEOHead";
import thononLogo from "@/assets/thonon-logo.png";
import heroDashboard from "@/assets/marketing/hero-dashboard.jpg";
import solutionsFactory from "@/assets/marketing/solutions-factory.jpg";
import featureAnalytics from "@/assets/marketing/feature-analytics.jpg";
import featureTeam from "@/assets/marketing/feature-team.jpg";
import featurePlanning from "@/assets/marketing/feature-planning.jpg";
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
  Star,
  Factory,
  Calendar,
  Truck,
  ClipboardList,
  Clock,
  Package,
  Wrench,
  CalendarDays,
  TrendingUp,
  Settings,
  Database,
  Rocket,
} from "lucide-react";

const seoMeta: Record<string, { title: string; desc: string }> = {
  nl: { title: "AutoMattiOn Compass | Productieplanning Software voor Meubelfabrikanten", desc: "Het alles-in-één productieplanningsplatform voor meubelfabrikanten. Beheer werkstations, bestellingen, logistiek en teams vanuit één plek." },
  en: { title: "AutoMattiOn Compass | Production Planning Software for Furniture Manufacturers", desc: "The all-in-one production planning platform for furniture manufacturers. Manage workstations, orders, logistics, and teams from one place." },
  fr: { title: "AutoMattiOn Compass | Logiciel de Planification de Production pour Fabricants de Meubles", desc: "La plateforme de planification de production tout-en-un pour les fabricants de meubles. Gérez postes de travail, commandes, logistique et équipes." },
};

const MarketingHome: React.FC = () => {
  const { lang, t } = useMarketingLang();
  const seo = seoMeta[lang] || seoMeta.nl;

  const painKeys = [
    "pain_1", "pain_2", "pain_3", "pain_4", "pain_5", "pain_6", "pain_7",
  ];

  const coreIcons = [Monitor, Zap, Cog, BarChart3, Layers, Globe, Shield, Users];
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

  const showcaseFeatures = [
    { icon: Factory, title: t("showcase_workstations"), desc: t("showcase_workstations_desc"), img: featureAnalytics },
    { icon: Calendar, title: t("showcase_planning"), desc: t("showcase_planning_desc"), img: featurePlanning },
    { icon: Users, title: t("showcase_team"), desc: t("showcase_team_desc"), img: featureTeam },
  ];

  const modules = [
    { icon: ClipboardList, key: "mod_projects", desc: "mod_projects_desc" },
    { icon: Calendar, key: "mod_planning", desc: "mod_planning_desc" },
    { icon: Truck, key: "mod_logistics", desc: "mod_logistics_desc" },
    { icon: Zap, key: "mod_rush", desc: "mod_rush_desc" },
    { icon: Users, key: "mod_teams", desc: "mod_teams_desc" },
    { icon: Clock, key: "mod_time", desc: "mod_time_desc" },
    { icon: BarChart3, key: "mod_dashboards", desc: "mod_dashboards_desc" },
    { icon: Wrench, key: "mod_broken", desc: "mod_broken_desc" },
    { icon: CalendarDays, key: "mod_hr", desc: "mod_hr_desc" },
  ];

  const proofStats = [
    { value: "40%", key: "proof_stat1", color: "from-emerald-500 to-emerald-400" },
    { value: "8h+", key: "proof_stat2", color: "from-blue-500 to-cyan-400" },
    { value: "25%", key: "proof_stat3", color: "from-violet-500 to-purple-400" },
    { value: "60%", key: "proof_stat4", color: "from-amber-500 to-orange-400" },
  ];

  const howSteps = [
    { icon: Settings, num: "01", title: t("how_step1_title"), desc: t("how_step1_desc") },
    { icon: Database, num: "02", title: t("how_step2_title"), desc: t("how_step2_desc") },
    { icon: Rocket, num: "03", title: t("how_step3_title"), desc: t("how_step3_desc") },
  ];

  return (
    <>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden min-h-[92vh] flex items-center">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[#195F85]/20 rounded-full blur-[150px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[130px] animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 pt-32 pb-20 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-5 py-2 text-sm text-slate-300 mb-8">
                <Star className="h-4 w-4 text-amber-400" />
                {t("hero_badge")}
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#42A5DB] via-[#5BC4F0] to-[#195F85]">
                  {t("hero_title_1")}
                </span>
                <br />
                <span className="text-white">{t("hero_title_2")}</span>
              </h1>

              <p className="text-lg md:text-xl text-slate-400 max-w-xl mb-10 leading-relaxed">
                {t("hero_subtitle")}
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-4 mb-12">
                <a href="mailto:info@automattion-compass.com">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-[#195F85] to-[#42A5DB] hover:from-[#164f70] hover:to-[#3994c5] text-white px-8 h-14 text-base font-semibold shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {t("hero_cta")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </a>
                <Link to="/thonon/nl">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/20 bg-white/5 backdrop-blur-sm hover:bg-white/10 text-white px-6 h-14 text-base font-semibold gap-3 transition-all duration-300 hover:border-white/30"
                  >
                    <img src={thononLogo} alt="Thonon" className="h-6 w-auto" />
                    {t("hero_portal")}
                  </Button>
                </Link>
              </div>

              {/* Trust line */}
              <div className="flex items-center gap-3 text-slate-500 text-sm">
                <div className="flex -space-x-2">
                  {[0,1,2,3].map(i => (
                    <div key={i} className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 border-2 border-[#0B1120] flex items-center justify-center text-[10px] font-bold text-slate-300">
                      {["M","T","K","S"][i]}
                    </div>
                  ))}
                </div>
                <span>{t("hero_trusted")}</span>
              </div>
            </div>

            {/* Hero image */}
            <div className="hidden lg:block">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-[#195F85]/20 to-cyan-500/20 rounded-2xl blur-xl" />
                <div className="relative rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-blue-500/10 bg-white/5 backdrop-blur-sm">
                  <img
                    src={heroDashboard}
                    alt="AutoMattiOn Compass Production Planning Dashboard"
                    className="w-full"
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B1120]/30 via-transparent to-transparent" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="relative z-10 -mt-8 mb-8">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: "9+", label: t("stat_modules") },
              { value: "3", label: t("stat_languages") },
              { value: "24/7", label: t("stat_uptime") },
              { value: "∞", label: t("stat_scalable") },
            ].map((stat, i) => (
              <div key={i} className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center hover:bg-white/[0.06] transition-all duration-300 hover:border-blue-500/20">
                <div className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-28 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/[0.02] to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-blue-400/80 mb-4">{t("how_badge")}</span>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-5 leading-tight">{t("how_title")}</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">{t("how_subtitle")}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-16 left-[16.7%] right-[16.7%] h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

            {howSteps.map((step, i) => (
              <div key={i} className="relative text-center group">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20 flex items-center justify-center mb-6 group-hover:from-blue-500/30 group-hover:to-cyan-500/20 transition-all duration-300 relative z-10">
                  <step.icon className="h-7 w-7 text-blue-400" />
                </div>
                <span className="text-xs font-bold text-blue-400/60 tracking-wider mb-2 block">{step.num}</span>
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SHOWCASE FEATURES (image + text alternating) ── */}
      <section className="py-28 relative">
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-blue-400/80 mb-4">{t("showcase_badge")}</span>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-5 leading-tight">{t("showcase_title")}</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">{t("showcase_subtitle")}</p>
          </div>

          <div className="space-y-24">
            {showcaseFeatures.map((f, i) => {
              const reversed = i % 2 === 1;
              return (
                <div key={i} className={`flex flex-col ${reversed ? "lg:flex-row-reverse" : "lg:flex-row"} gap-12 lg:gap-20 items-center`}>
                  <div className="lg:w-1/2">
                    <div className="relative group">
                      <div className="absolute -inset-3 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="relative rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                        <img src={f.img} alt={f.title} className="w-full transition-transform duration-700 group-hover:scale-[1.02]" loading="lazy" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1120]/40 via-transparent to-transparent" />
                      </div>
                    </div>
                  </div>
                  <div className="lg:w-1/2">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 flex items-center justify-center mb-6">
                      <f.icon className="h-6 w-6 text-blue-400" />
                    </div>
                    <h3 className="text-3xl md:text-4xl font-extrabold mb-4 leading-tight">{f.title}</h3>
                    <p className="text-slate-400 text-lg leading-relaxed">{f.desc}</p>
                    <Link to={`/site/features?lang=${lang}`} className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium mt-6 transition-colors">
                      {t("nav_features")} <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── MODULE GRID ── */}
      <section className="py-28 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-blue-400/80 mb-4">{t("modules_badge")}</span>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-5 leading-tight">{t("modules_title")}</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">{t("modules_subtitle")}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {modules.map((m, i) => (
              <div
                key={i}
                className="group flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.05] hover:border-blue-500/20 transition-all duration-300"
              >
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-500/15 to-cyan-500/10 flex items-center justify-center flex-shrink-0 group-hover:from-blue-500/25 group-hover:to-cyan-500/15 transition-all">
                  <m.icon className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">{t(m.key)}</h4>
                  <p className="text-xs text-slate-500">{t(m.desc)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PAIN POINTS ── */}
      <section className="py-28 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-500/[0.02] to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-red-400/80 mb-4">{t("pain_badge")}</span>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-5 leading-tight">{t("pain_title")}</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">{t("pain_subtitle")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {painKeys.map((k) => (
              <div key={k} className="group flex items-start gap-4 rounded-2xl border border-red-500/10 bg-red-500/[0.02] p-6 hover:bg-red-500/[0.05] hover:border-red-500/20 transition-all duration-300">
                <div className="h-9 w-9 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                </div>
                <span className="text-sm text-slate-300 leading-relaxed">{t(k)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROOF / IMPACT STATS ── */}
      <section className="py-28 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.02] to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/80 mb-4">{t("proof_badge")}</span>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-5 leading-tight">{t("proof_title")}</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">{t("proof_subtitle")}</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {proofStats.map((s, i) => (
              <div key={i} className="text-center group">
                <div className={`text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${s.color} mb-3`}>
                  {s.value}
                </div>
                <p className="text-sm text-slate-400">{t(s.key)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VISUAL DIVIDER ── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="relative rounded-3xl overflow-hidden group">
            <img src={solutionsFactory} alt="Modern furniture manufacturing" className="w-full object-cover h-72 md:h-96 transition-transform duration-700 group-hover:scale-[1.02]" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B1120]/80 via-[#0B1120]/40 to-transparent flex items-center">
              <div className="p-10 md:p-16 max-w-lg">
                <h3 className="text-2xl md:text-4xl font-extrabold mb-4">{t("visual_title")}</h3>
                <p className="text-slate-300 text-base leading-relaxed">{t("visual_desc")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CORE VALUES ── */}
      <section className="py-28 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/[0.02] to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-blue-400/80 mb-4">{t("core_badge")}</span>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-5 leading-tight">{t("core_title")}</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">{t("core_subtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {coreKeys.map((c, i) => {
              const Icon = coreIcons[i];
              return (
                <div key={c.key} className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-7 hover:bg-white/[0.05] hover:border-blue-500/20 transition-all duration-500 hover:-translate-y-1">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 flex items-center justify-center mb-5 group-hover:from-blue-500/30 group-hover:to-cyan-500/20 transition-all duration-300">
                    <Icon className="h-5 w-5 text-blue-400 group-hover:text-blue-300 transition-colors" />
                  </div>
                  <h3 className="font-bold text-white mb-2 text-lg">{t(c.key)}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{t(c.desc)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA to features ── */}
      <section className="py-12">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Link to={`/site/features?lang=${lang}`}>
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 bg-white/5 backdrop-blur-sm hover:bg-white/10 text-white px-10 h-14 text-base font-semibold transition-all duration-300 hover:border-white/30 hover:scale-[1.02]"
            >
              {t("nav_features")}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-32 relative">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#195F85]/15 rounded-full blur-[150px]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-5 leading-tight">{t("contact_title")}</h2>
          <p className="text-slate-400 text-lg mb-3">{t("contact_subtitle")}</p>
          <p className="mb-10">
            <code className="text-blue-300 bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 rounded-xl text-sm font-medium">yourcompany.automattion-compass.com</code>
          </p>
          <a href="mailto:info@automattion-compass.com">
            <Button
              size="lg"
              className="bg-gradient-to-r from-[#195F85] to-[#42A5DB] hover:from-[#164f70] hover:to-[#3994c5] text-white px-10 h-14 text-lg font-semibold shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              {t("contact_cta")}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </a>
        </div>
      </section>
    </>
  );
};

export default MarketingHome;
