import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import en from '../locales/en.json';
import nl from '../locales/nl.json';
import fr from '../locales/fr.json';

const translations: Record<string, Record<string, string>> = { en, nl, fr };
const availableLanguages = ['en', 'nl', 'fr'];
const defaultLang = 'nl';

interface LanguageContextType {
  lang: string;
  t: (key: string, replacements?: { [key: string]: string }) => string;
  changeLang: (newLang: string) => void;
  createLocalizedPath: (path: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();

  /**
   * Path structure: /:tenant/:lang/...
   * We extract tenant (segment 0) and lang (segment 1) from the pathname.
   */
  const getSegments = (pathname: string) => {
    const segs = pathname.split('/').filter(Boolean);
    return segs;
  };

  const getLangFromPath = (pathname: string) => {
    const segs = getSegments(pathname);
    // For tenant routes: /:tenant/:lang/...
    // segs[0] = tenant, segs[1] = lang
    if (segs.length >= 2 && availableLanguages.includes(segs[1])) {
      return segs[1];
    }
    // For old-style or non-tenant routes, check first segment
    if (segs.length >= 1 && availableLanguages.includes(segs[0])) {
      return segs[0];
    }
    return defaultLang;
  };

  const getTenantFromPath = (pathname: string): string | null => {
    const segs = getSegments(pathname);
    if (segs.length >= 1 && segs[0] !== 'dev' && !availableLanguages.includes(segs[0])) {
      return segs[0];
    }
    return null;
  };

  const [lang, setLang] = useState(getLangFromPath(location.pathname));

  useEffect(() => {
    const currentLang = getLangFromPath(location.pathname);
    if (lang !== currentLang) {
      setLang(currentLang);
    }
  }, [location.pathname, lang]);

  const changeLang = (newLang: string) => {
    if (availableLanguages.includes(newLang)) {
      const tenant = getTenantFromPath(location.pathname);
      const segs = getSegments(location.pathname);

      if (tenant && segs.length >= 2) {
        // Replace lang segment: /:tenant/:oldLang/... -> /:tenant/:newLang/...
        const rest = segs.slice(2).join('/');
        navigate(`/${tenant}/${newLang}${rest ? `/${rest}` : ''}`);
      } else {
        // Fallback
        const currentPath = location.pathname;
        const newPath = `/${newLang}${currentPath.substring(3)}`;
        navigate(newPath);
      }
    }
  };

  const createLocalizedPath = useCallback((path: string) => {
    const tenant = getTenantFromPath(location.pathname);
    const cleanPath = path === '/' ? '' : path;

    if (tenant) {
      // Tenant routes: /:tenant/:lang/path
      return `/${tenant}/${lang}${cleanPath}`;
    }

    // Non-tenant routes (shouldn't normally happen for app pages)
    if (path.startsWith(`/${lang}`)) return path;
    return `/${lang}${cleanPath}`;
  }, [lang, location.pathname]);

  const t = (key: string, replacements?: { [key: string]: string }) => {
    let translation = translations[lang]?.[key] || translations[defaultLang]?.[key] || key;
    if (replacements) {
      Object.keys(replacements).forEach(placeholder => {
        translation = translation.replace(`{{${placeholder}}}`, replacements[placeholder]);
      });
    }
    return translation;
  };

  const value = { lang, t, changeLang, createLocalizedPath };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// Default fallback for when used outside provider
const defaultLanguageContext: LanguageContextType = {
  lang: 'nl',
  t: (key: string) => key,
  changeLang: () => {},
  createLocalizedPath: (path: string) => `/nl${path === '/' ? '' : path}`,
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    console.warn('useLanguage used outside LanguageProvider, returning defaults');
    return defaultLanguageContext;
  }
  return context;
};
