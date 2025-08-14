import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Search, ArrowLeft, Play, ExternalLink, Tag } from 'lucide-react';
import { helpService, HelpCategory, HelpArticleWithCategory } from '@/services/helpService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const HelpDialog: React.FC<HelpDialogProps> = ({ open, onOpenChange }) => {
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory | null>(null);
  const [articles, setArticles] = useState<HelpArticleWithCategory[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticleWithCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { currentEmployee } = useAuth();

  useEffect(() => {
    if (open) {
      loadCategories();
      setSearchQuery('');
      setSelectedCategory(null);
      setSelectedArticle(null);
    }
  }, [open]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const categoriesData = await helpService.getCategories();
      setCategories(categoriesData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load help categories",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadArticles = async (categoryId?: string) => {
    try {
      setLoading(true);
      let articlesData;
      if (categoryId) {
        const categoryArticles = await helpService.getArticlesByCategory(categoryId);
        articlesData = categoryArticles.map(article => ({
          ...article,
          category: categories.find(cat => cat.id === categoryId)!
        }));
      } else {
        articlesData = await helpService.getArticles();
      }
      setArticles(articlesData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load help articles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadArticles();
      return;
    }

    try {
      setLoading(true);
      const searchResults = await helpService.searchArticles(searchQuery);
      setArticles(searchResults);
      setSelectedCategory(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to search help articles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (category: HelpCategory) => {
    setSelectedCategory(category);
    setSelectedArticle(null);
    loadArticles(category.id);
  };

  const handleBack = () => {
    if (selectedArticle) {
      setSelectedArticle(null);
    } else if (selectedCategory) {
      setSelectedCategory(null);
      setArticles([]);
    }
  };

  const renderCategories = () => (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search help articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} variant="outline">
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3">
        {categories.map((category) => (
          <Card
            key={category.id}
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => handleCategorySelect(category)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{category.name}</CardTitle>
              {category.description && (
                <CardDescription className="text-sm">
                  {category.description}
                </CardDescription>
              )}
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderArticlesList = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h3 className="text-lg font-semibold">
          {selectedCategory ? selectedCategory.name : 'Search Results'}
        </h3>
      </div>

      <div className="space-y-3">
        {articles.map((article) => (
          <Card
            key={article.id}
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => setSelectedArticle(article)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base">{article.title}</CardTitle>
                  {!selectedCategory && (
                    <Badge variant="secondary" className="mt-1">
                      {article.category.name}
                    </Badge>
                  )}
                </div>
                {article.video_url && (
                  <Play className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              {article.tags.length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  <div className="flex gap-1">
                    {article.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {article.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{article.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardHeader>
          </Card>
        ))}
      </div>

      {articles.length === 0 && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          {searchQuery ? 'No articles found for your search.' : 'No articles in this category.'}
        </div>
      )}
    </div>
  );

  const renderArticleDetail = () => {
    if (!selectedArticle) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Badge variant="secondary">{selectedArticle.category.name}</Badge>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold">{selectedArticle.title}</h2>

          {selectedArticle.video_url && (
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              <video
                controls
                className="w-full h-full"
                poster={selectedArticle.image_url}
              >
                <source src={selectedArticle.video_url} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          {selectedArticle.image_url && !selectedArticle.video_url && (
            <div className="rounded-lg overflow-hidden">
              <img
                src={selectedArticle.image_url}
                alt={selectedArticle.title}
                className="w-full max-h-64 object-cover"
              />
            </div>
          )}

          <div className="prose prose-sm max-w-none">
            <div
              dangerouslySetInnerHTML={{
                __html: selectedArticle.content.replace(/\n/g, '<br>')
              }}
            />
          </div>

          {selectedArticle.tags.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Tags</h4>
              <div className="flex flex-wrap gap-1">
                {selectedArticle.tags.map((tag, index) => (
                  <Badge key={index} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Help & Documentation
            {currentEmployee?.role === 'admin' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/settings', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Manage
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : selectedArticle ? (
            renderArticleDetail()
          ) : selectedCategory || searchQuery ? (
            renderArticlesList()
          ) : (
            renderCategories()
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};