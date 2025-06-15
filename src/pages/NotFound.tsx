
import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const { t, createLocalizedPath, lang } = useLanguage();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  // Extract the main section of the route for better navigation suggestions
  const pathSegments = location.pathname.split('/').filter(p => p && p !== lang);
  const mainSection = pathSegments.length > 0 ? pathSegments[0] : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md p-6">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">{t('not_found_title')}</h1>
        <p className="text-xl text-gray-700 mb-6">{t('not_found_subtitle')}</p>
        <p className="text-gray-500 mb-8">
          {t('not_found_description')}
        </p>
        
        <div className="space-y-3">
          <Button asChild variant="default" className="w-full">
            <Link to={createLocalizedPath("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('return_to_home')}
            </Link>
          </Button>
          
          {mainSection === 'projects' && (
            <Button asChild variant="outline" className="w-full">
              <Link to={createLocalizedPath("/projects")}>
                {t('view_all_projects')}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotFound;
