
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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

  const getLangFromPath = (pathname: string) => {
    const langCode = pathname.split('/')[1];
    return availableLanguages.includes(langCode) ? langCode : defaultLang;
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
      const currentPath = location.pathname;
      const newPath = `/${newLang}${currentPath.substring(3)}`;
      navigate(newPath);
    }
  };

  const createLocalizedPath = useCallback((path: string) => {
    if (path.startsWith(`/${lang}`)) return path;
    const newPath = path === '/' ? '' : path;
    return `/${lang}${newPath}`;
  }, [lang]);

  const t = (key: string, replacements?: { [key:string]: string }) => {
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

// Default fallback for when used outside provider (e.g., during initial render)
const defaultLanguageContext: LanguageContextType = {
  lang: 'nl',
  t: (key: string) => key,
  changeLang: () => {},
  createLocalizedPath: (path: string) => `/nl${path === '/' ? '' : path}`,
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  // Return fallback instead of throwing to prevent crashes during edge cases
  if (context === undefined) {
    console.warn('useLanguage used outside LanguageProvider, returning defaults');
    return defaultLanguageContext;
  }
  return context;
};
