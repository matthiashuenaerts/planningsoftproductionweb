
import React, { useEffect } from 'react';
import { useParams, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const supportedLanguages = ['en', 'nl'];

const LanguageWrapper = () => {
    const { lang } = useParams<{ lang: string }>();
    const { i18n } = useTranslation();
    const location = useLocation();

    useEffect(() => {
        if (lang && supportedLanguages.includes(lang) && i18n.language !== lang) {
            i18n.changeLanguage(lang);
        }
    }, [lang, i18n]);

    if (!lang || !supportedLanguages.includes(lang)) {
        const restOfPath = location.pathname.substring(lang ? `/${lang}`.length : 0);
        return <Navigate to={`/${i18n.fallbackLng}${restOfPath}`} replace />;
    }
    
    return <Outlet />;
};

export default LanguageWrapper;
