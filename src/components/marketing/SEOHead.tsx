import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface SEOHeadProps {
  title: string;
  description: string;
  path?: string;
  lang?: string;
  keywords?: string;
  ogImage?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const BASE = "https://www.automattion-compass.com";
const DEFAULT_OG_IMAGE = `${BASE}/og-image.jpg`;

/**
 * Updates document <title>, meta tags, canonical, hreflang, OG, Twitter and JSON-LD per page.
 */
const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  path,
  lang,
  keywords,
  ogImage,
  jsonLd,
}) => {
  const location = useLocation();
  const currentPath = path || location.pathname;

  useEffect(() => {
    // Title
    document.title = title;

    // Description
    const setMeta = (selector: string, attr: string, value: string) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]', "content", description);

    // Keywords
    let kwTag = document.querySelector('meta[name="keywords"]');
    if (keywords) {
      if (!kwTag) {
        kwTag = document.createElement("meta");
        kwTag.setAttribute("name", "keywords");
        document.head.appendChild(kwTag);
      }
      kwTag.setAttribute("content", keywords);
    }

    // OG tags
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:url"]', "content", `${BASE}${currentPath}`);
    setMeta('meta[property="og:image"]', "content", ogImage || DEFAULT_OG_IMAGE);

    // Twitter
    setMeta('meta[name="twitter:title"]', "content", title);
    setMeta('meta[name="twitter:description"]', "content", description);
    setMeta('meta[name="twitter:image"]', "content", ogImage || DEFAULT_OG_IMAGE);

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.href = `${BASE}${currentPath}`;

    // Lang attribute
    if (lang) {
      document.documentElement.lang = lang === "nl" ? "nl" : lang === "fr" ? "fr" : "en";
    }

    // Hreflang alternates
    const langs = ["nl", "en", "fr"];
    // Remove existing hreflang links
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
    // Strip ?lang= from path for clean hreflang URLs
    const cleanPath = currentPath.split("?")[0];
    langs.forEach((l) => {
      const link = document.createElement("link");
      link.setAttribute("rel", "alternate");
      link.setAttribute("hreflang", l);
      link.setAttribute("href", `${BASE}${cleanPath}?lang=${l}`);
      document.head.appendChild(link);
    });
    // x-default
    const xDefault = document.createElement("link");
    xDefault.setAttribute("rel", "alternate");
    xDefault.setAttribute("hreflang", "x-default");
    xDefault.setAttribute("href", `${BASE}${cleanPath}?lang=nl`);
    document.head.appendChild(xDefault);

    // JSON-LD injection
    document.querySelectorAll('script[data-seo-jsonld]').forEach((el) => el.remove());
    if (jsonLd) {
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      items.forEach((item) => {
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-seo-jsonld", "true");
        script.textContent = JSON.stringify(item);
        document.head.appendChild(script);
      });
    }

    // Cleanup on unmount
    return () => {
      document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
      document.querySelectorAll('script[data-seo-jsonld]').forEach((el) => el.remove());
    };
  }, [title, description, currentPath, lang, keywords, ogImage, jsonLd]);

  return null;
};

export default SEOHead;
