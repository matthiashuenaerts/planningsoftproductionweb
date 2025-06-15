
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const RedirectToLang = () => {
  const { i18n } = useTranslation();
  const location = useLocation();

  const targetPath = `/${i18n.language}${location.pathname === '/' ? '' : location.pathname}`;
  
  return <Navigate to={targetPath} replace />;
};

export default RedirectToLang;
