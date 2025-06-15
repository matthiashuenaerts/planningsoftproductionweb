
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import en from '../locales/en.json';
import nl from '../locales/nl.json';

const translations: Record<string, Record<string, string>> = { en, nl };
const availableLanguages = ['en', 'nl'];
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

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
