import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface SEOHeadProps {
  title: string;
  description: string;
  path?: string;
  lang?: string;
}

/**
 * Updates document <title> and <meta name="description"> per page.
 * Also sets canonical and hreflang for marketing pages.
 */
const SEOHead: React.FC<SEOHeadProps> = ({ title, description, path, lang }) => {
  const location = useLocation();
  const base = "https://www.automattion-compass.com";
  const currentPath = path || location.pathname;

  useEffect(() => {
    // Title
    document.title = title;

    // Description
    let descTag = document.querySelector('meta[name="description"]');
    if (descTag) {
      descTag.setAttribute("content", description);
    }

    // OG tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", title);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", description);
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute("content", `${base}${currentPath}`);

    // Twitter
    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute("content", title);
    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute("content", description);

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) {
      canonical.href = `${base}${currentPath}`;
    }

    // Lang attribute
    if (lang) {
      document.documentElement.lang = lang === "nl" ? "nl" : lang === "fr" ? "fr" : "en";
    }
  }, [title, description, currentPath, lang]);

  return null;
};

export default SEOHead;
