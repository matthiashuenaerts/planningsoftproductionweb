
import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

const NotFound = () => {
  const location = useLocation();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  // Extract the main section of the route for better navigation suggestions
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const mainSection = pathSegments.length > 1 ? pathSegments[1] : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md p-6">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">{t('notFound.title')}</h1>
        <p className="text-xl text-gray-700 mb-6">{t('notFound.subtitle')}</p>
        <p className="text-gray-500 mb-8">
          {t('notFound.description')}
        </p>
        
        <div className="space-y-3">
          <Button asChild variant="default" className="w-full">
            <Link to={`/${i18n.language}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('notFound.returnHome')}
            </Link>
          </Button>
          
          {mainSection === 'projects' && (
            <Button asChild variant="outline" className="w-full">
              <Link to={`/${i18n.language}/projects`}>
                {t('notFound.viewAllProjects')}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotFound;
