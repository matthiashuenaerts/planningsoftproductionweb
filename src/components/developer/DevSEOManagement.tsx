import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Globe, CheckCircle2, AlertTriangle, ExternalLink, Copy, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PageSEO {
  path: string;
  label: string;
  titles: Record<string, string>;
  descriptions: Record<string, string>;
  keywords: Record<string, string>;
}

const defaultPages: PageSEO[] = [
  {
    path: "/site",
    label: "Home",
    titles: {
      nl: "AutoMattiOn Compass | Productieplanning Software voor Meubelfabrikanten",
      en: "AutoMattiOn Compass | Production Planning Software for Furniture Manufacturers",
      fr: "AutoMattiOn Compass | Logiciel de Planification de Production pour Fabricants de Meubles",
    },
    descriptions: {
      nl: "Het alles-in-één productieplanningsplatform voor meubelfabrikanten. Beheer werkstations, bestellingen, logistiek en teams vanuit één plek.",
      en: "The all-in-one production planning platform for furniture manufacturers. Manage workstations, orders, logistics, and teams from one place.",
      fr: "La plateforme de planification de production tout-en-un pour les fabricants de meubles.",
    },
    keywords: {
      nl: "productieplanning, meubelfabrikant, planningssoftware, werkstationbeheer, Gantt chart, productie software",
      en: "production planning, furniture manufacturer, planning software, workstation management, Gantt chart",
      fr: "planification production, fabricant meubles, logiciel planification, gestion postes travail",
    },
  },
  {
    path: "/site/features",
    label: "Features",
    titles: {
      nl: "Functionaliteiten | AutoMattiOn Compass Productieplanning",
      en: "Features | AutoMattiOn Compass Production Planning",
      fr: "Fonctionnalités | AutoMattiOn Compass Planification",
    },
    descriptions: {
      nl: "Ontdek alle functionaliteiten: projectbeheer, Gantt planning, logistiek, spoedbestellingen, tijdsregistratie en meer.",
      en: "Discover all features: project management, Gantt planning, logistics, rush orders, time registration and more.",
      fr: "Découvrez toutes les fonctionnalités : gestion de projets, Gantt, logistique, commandes urgentes et plus.",
    },
    keywords: {
      nl: "productieplanning functies, Gantt planning, projectbeheer, logistiek software, tijdsregistratie",
      en: "production planning features, Gantt planning, project management, logistics software, time registration",
      fr: "fonctionnalités planification, Gantt, gestion projets, logistique, enregistrement temps",
    },
  },
  {
    path: "/site/solutions",
    label: "Solutions",
    titles: {
      nl: "Oplossingen | AutoMattiOn Compass Productiesoftware",
      en: "Solutions | AutoMattiOn Compass Production Software",
      fr: "Solutions | AutoMattiOn Compass Logiciel de Production",
    },
    descriptions: {
      nl: "Ontdek welke productie-uitdagingen AutoMattiOn Compass oplost: efficiëntie, logistiek, communicatie en flexibiliteit.",
      en: "Discover which production challenges AutoMattiOn Compass solves: efficiency, logistics, communication and flexibility.",
      fr: "Découvrez quels défis de production AutoMattiOn Compass résout.",
    },
    keywords: {
      nl: "productie-uitdagingen, efficiëntie, logistiek optimalisatie, productiesoftware",
      en: "production challenges, efficiency, logistics optimization, production software",
      fr: "défis production, efficacité, optimisation logistique",
    },
  },
  {
    path: "/site/integration",
    label: "Integration",
    titles: {
      nl: "Integratie | AutoMattiOn Compass & CrownBase Pro",
      en: "Integration | AutoMattiOn Compass & CrownBase Pro",
      fr: "Intégration | AutoMattiOn Compass & CrownBase Pro",
    },
    descriptions: {
      nl: "Naadloze koppeling met CrownBase Pro: automatische synchronisatie, orderimport en open API architectuur.",
      en: "Seamless CrownBase Pro integration: automatic sync, order import and open API architecture.",
      fr: "Intégration CrownBase Pro : synchronisation automatique, import de commandes et architecture API ouverte.",
    },
    keywords: {
      nl: "CrownBase Pro integratie, API koppeling, orderimport, synchronisatie",
      en: "CrownBase Pro integration, API connection, order import, synchronization",
      fr: "intégration CrownBase Pro, API, import commandes, synchronisation",
    },
  },
  {
    path: "/site/contact",
    label: "Contact",
    titles: {
      nl: "Contact | AutoMattiOn Compass - Demo Aanvragen",
      en: "Contact | AutoMattiOn Compass - Request a Demo",
      fr: "Contact | AutoMattiOn Compass - Demander une Démo",
    },
    descriptions: {
      nl: "Neem contact op voor een demo van AutoMattiOn Compass. Productieplanning software op maat voor meubelfabrikanten in België.",
      en: "Get in touch for a demo of AutoMattiOn Compass. Custom production planning software for furniture manufacturers in Belgium.",
      fr: "Contactez-nous pour une démo d'AutoMattiOn Compass.",
    },
    keywords: {
      nl: "demo aanvragen, contact, productieplanning België, meubelfabrikant software",
      en: "request demo, contact, production planning Belgium, furniture manufacturer software",
      fr: "demander démo, contact, planification production Belgique",
    },
  },
];

const charLimits = {
  title: 60,
  description: 160,
};

const DevSEOManagement: React.FC = () => {
  const [pages, setPages] = useState<PageSEO[]>(defaultPages);
  const [activeLang, setActiveLang] = useState("nl");
  const { toast } = useToast();

  const getTitleStatus = (title: string) => {
    if (title.length === 0) return "empty";
    if (title.length <= charLimits.title) return "good";
    return "warning";
  };

  const getDescStatus = (desc: string) => {
    if (desc.length === 0) return "empty";
    if (desc.length <= charLimits.description) return "good";
    return "warning";
  };

  const updateField = (
    pageIndex: number,
    field: "titles" | "descriptions" | "keywords",
    lang: string,
    value: string
  ) => {
    setPages((prev) => {
      const updated = [...prev];
      updated[pageIndex] = {
        ...updated[pageIndex],
        [field]: { ...updated[pageIndex][field], [lang]: value },
      };
      return updated;
    });
  };

  const copySnippet = (page: PageSEO) => {
    const snippet = `<SEOHead
  title="${page.titles[activeLang] || ""}"
  description="${page.descriptions[activeLang] || ""}"
  path="${page.path}"
  lang={lang}
  keywords="${page.keywords[activeLang] || ""}"
/>`;
    navigator.clipboard.writeText(snippet);
    toast({ title: "Copied!", description: "SEO snippet copied to clipboard." });
  };

  const getGooglePreview = (page: PageSEO) => {
    const title = page.titles[activeLang] || page.titles.nl || "";
    const desc = page.descriptions[activeLang] || page.descriptions.nl || "";
    const url = `https://www.automattion-compass.com${page.path}`;
    return { title, desc, url };
  };

  const overallScore = () => {
    let good = 0;
    let total = 0;
    pages.forEach((p) => {
      ["nl", "en", "fr"].forEach((l) => {
        total += 3; // title, desc, keywords
        if (getTitleStatus(p.titles[l] || "") === "good") good++;
        if (getDescStatus(p.descriptions[l] || "") === "good") good++;
        if ((p.keywords[l] || "").length > 0) good++;
      });
    });
    return Math.round((good / total) * 100);
  };

  const score = overallScore();

  return (
    <div className="space-y-6">
      {/* Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold ${score >= 80 ? "bg-emerald-500/10 text-emerald-500" : score >= 50 ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500"}`}>
                {score}%
              </div>
              <div>
                <p className="font-semibold">SEO Score</p>
                <p className="text-sm text-muted-foreground">
                  {score >= 80 ? "Great! Well optimized." : score >= 50 ? "Room for improvement." : "Needs attention."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Globe className="h-8 w-8 text-blue-500" />
              <div>
                <p className="font-semibold">{pages.length} Pages</p>
                <p className="text-sm text-muted-foreground">3 languages each</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Search className="h-8 w-8 text-violet-500" />
              <div>
                <p className="font-semibold">Quick Links</p>
                <div className="flex gap-2 mt-1">
                  <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                    Search Console <ExternalLink className="h-3 w-3" />
                  </a>
                  <a href="https://pagespeed.web.dev/" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                    PageSpeed <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Language Tabs */}
      <Tabs value={activeLang} onValueChange={setActiveLang}>
        <TabsList>
          <TabsTrigger value="nl">🇧🇪 Nederlands</TabsTrigger>
          <TabsTrigger value="en">🇬🇧 English</TabsTrigger>
          <TabsTrigger value="fr">🇫🇷 Français</TabsTrigger>
        </TabsList>

        {["nl", "en", "fr"].map((lang) => (
          <TabsContent key={lang} value={lang} className="space-y-4 mt-4">
            {pages.map((page, idx) => {
              const preview = getGooglePreview(page);
              const titleLen = (page.titles[lang] || "").length;
              const descLen = (page.descriptions[lang] || "").length;
              const titleStatus = getTitleStatus(page.titles[lang] || "");
              const descStatus = getDescStatus(page.descriptions[lang] || "");

              return (
                <Card key={page.path}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        {page.label}
                        <Badge variant="outline" className="text-xs font-mono">{page.path}</Badge>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => copySnippet(page)}>
                          <Copy className="h-4 w-4 mr-1" /> Copy Snippet
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Google Preview */}
                    <div className="rounded-lg bg-white p-4 border">
                      <div className="flex items-center gap-2 mb-1">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground font-medium">Google Preview</span>
                      </div>
                      <p className="text-sm text-green-700 font-mono truncate">{preview.url}</p>
                      <p className="text-blue-700 text-lg font-medium leading-tight hover:underline cursor-default truncate">
                        {preview.title || "No title set"}
                      </p>
                      <p className="text-sm text-gray-600 line-clamp-2">{preview.desc || "No description set"}</p>
                    </div>

                    {/* Title */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium">Title</label>
                        <span className={`text-xs ${titleStatus === "good" ? "text-emerald-500" : titleStatus === "warning" ? "text-amber-500" : "text-red-500"}`}>
                          {titleStatus === "good" ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <AlertTriangle className="h-3 w-3 inline mr-1" />}
                          {titleLen}/{charLimits.title}
                        </span>
                      </div>
                      <Input
                        value={page.titles[lang] || ""}
                        onChange={(e) => updateField(idx, "titles", lang, e.target.value)}
                        placeholder={`Page title (${lang})`}
                        className="font-mono text-sm"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium">Meta Description</label>
                        <span className={`text-xs ${descStatus === "good" ? "text-emerald-500" : descStatus === "warning" ? "text-amber-500" : "text-red-500"}`}>
                          {descStatus === "good" ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <AlertTriangle className="h-3 w-3 inline mr-1" />}
                          {descLen}/{charLimits.description}
                        </span>
                      </div>
                      <Textarea
                        value={page.descriptions[lang] || ""}
                        onChange={(e) => updateField(idx, "descriptions", lang, e.target.value)}
                        placeholder={`Meta description (${lang})`}
                        className="font-mono text-sm"
                        rows={2}
                      />
                    </div>

                    {/* Keywords */}
                    <div>
                      <label className="text-sm font-medium mb-1 block">Keywords</label>
                      <Input
                        value={page.keywords[lang] || ""}
                        onChange={(e) => updateField(idx, "keywords", lang, e.target.value)}
                        placeholder={`Comma-separated keywords (${lang})`}
                        className="font-mono text-sm"
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>

      {/* SEO Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SEO Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {[
              { done: true, label: "Sitemap.xml present" },
              { done: true, label: "Robots.txt configured" },
              { done: true, label: "Canonical URLs per page" },
              { done: true, label: "Hreflang for NL/EN/FR" },
              { done: true, label: "Open Graph meta tags" },
              { done: true, label: "Twitter Card meta tags" },
              { done: true, label: "JSON-LD SoftwareApplication" },
              { done: true, label: "JSON-LD FAQPage (Home)" },
              { done: true, label: "JSON-LD Organization" },
              { done: true, label: "JSON-LD BreadcrumbList" },
              { done: true, label: "Semantic HTML (h1, sections)" },
              { done: true, label: "Alt text on images" },
              { done: true, label: "Mobile responsive viewport" },
              { done: true, label: "Multilingual content (3 languages)" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <CheckCircle2 className={`h-4 w-4 ${item.done ? "text-emerald-500" : "text-muted-foreground"}`} />
                <span className={item.done ? "" : "text-muted-foreground"}>{item.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DevSEOManagement;
