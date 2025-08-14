import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, ArrowLeft, Play, ExternalLink, Tag, Plus, Edit, Trash2, Upload, Video, Image, Settings } from 'lucide-react';
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
  const [managementMode, setManagementMode] = useState(false);
  const [editingCategory, setEditingCategory] = useState<HelpCategory | null>(null);
  const [editingArticle, setEditingArticle] = useState<HelpArticleWithCategory | null>(null);
  const { toast } = useToast();
  const { currentEmployee } = useAuth();

  useEffect(() => {
    if (open) {
      loadCategories();
      setSearchQuery('');
      setSelectedCategory(null);
      setSelectedArticle(null);
      setManagementMode(false);
      setEditingCategory(null);
      setEditingArticle(null);
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
    if (editingArticle || editingCategory) {
      setEditingArticle(null);
      setEditingCategory(null);
    } else if (managementMode) {
      setManagementMode(false);
    } else if (selectedArticle) {
      setSelectedArticle(null);
    } else if (selectedCategory) {
      setSelectedCategory(null);
      setArticles([]);
    }
  };

  const handleManageClick = () => {
    setManagementMode(true);
    setSelectedCategory(null);
    setSelectedArticle(null);
    loadCategories();
    loadArticles();
  };

  const handleCategorySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    const categoryData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      display_order: parseInt(formData.get('display_order') as string) || 0,
      is_active: formData.get('is_active') === 'on'
    };

    try {
      if (editingCategory?.id) {
        await helpService.updateCategory(editingCategory.id, categoryData);
        toast({ title: "Success", description: "Category updated successfully" });
      } else {
        await helpService.createCategory(categoryData);
        toast({ title: "Success", description: "Category created successfully" });
      }
      
      setEditingCategory(null);
      loadCategories();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save category",
        variant: "destructive"
      });
    }
  };

  const handleArticleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    const tags = (formData.get('tags') as string).split(',').map(tag => tag.trim()).filter(tag => tag);
    
    const articleData = {
      category_id: formData.get('category_id') as string,
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      video_url: formData.get('video_url') as string || undefined,
      image_url: formData.get('image_url') as string || undefined,
      tags,
      display_order: parseInt(formData.get('display_order') as string) || 0,
      is_published: formData.get('is_published') === 'on'
    };

    try {
      if (editingArticle?.id) {
        await helpService.updateArticle(editingArticle.id, articleData);
        toast({ title: "Success", description: "Article updated successfully" });
      } else {
        await helpService.createArticle(articleData);
        toast({ title: "Success", description: "Article created successfully" });
      }
      
      setEditingArticle(null);
      loadCategories();
      loadArticles();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save article",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await helpService.deleteCategory(id);
      toast({ title: "Success", description: "Category deleted successfully" });
      loadCategories();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive"
      });
    }
  };

  const handleDeleteArticle = async (id: string) => {
    try {
      await helpService.deleteArticle(id);
      toast({ title: "Success", description: "Article deleted successfully" });
      loadArticles();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete article",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = async (file: File, type: 'image' | 'video') => {
    try {
      const url = await helpService.uploadHelpMedia(file, type + 's');
      toast({ title: "Success", description: `${type} uploaded successfully` });
      return url;
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to upload ${type}`,
        variant: "destructive"
      });
      return null;
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

  const renderManagement = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h3 className="text-lg font-semibold">Help Management</h3>
      </div>

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="articles">Articles</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Categories</h4>
            <Button
              size="sm"
              onClick={() => setEditingCategory({
                id: '',
                name: '',
                description: '',
                display_order: 0,
                is_active: true,
                created_at: '',
                updated_at: ''
              })}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Category
            </Button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {categories.map((category) => (
              <Card key={category.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-medium">{category.name}</h5>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditingCategory(category)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(category.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="articles" className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Articles</h4>
            <Button
              size="sm"
              onClick={() => setEditingArticle({
                id: '',
                category_id: '',
                title: '',
                content: '',
                video_url: '',
                image_url: '',
                tags: [],
                display_order: 0,
                is_published: true,
                created_by: '',
                created_at: '',
                updated_at: '',
                category: categories[0] || { id: '', name: '', description: '', display_order: 0, is_active: true, created_at: '', updated_at: '' }
              })}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Article
            </Button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {articles.map((article) => (
              <Card key={article.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-medium">{article.title}</h5>
                    <p className="text-sm text-muted-foreground">{article.category.name}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditingArticle(article)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteArticle(article.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  const renderCategoryForm = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h3 className="text-lg font-semibold">
          {editingCategory?.id ? 'Edit Category' : 'Create Category'}
        </h3>
      </div>

      <form onSubmit={handleCategorySubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            defaultValue={editingCategory?.name}
            required
          />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={editingCategory?.description}
          />
        </div>
        <div>
          <Label htmlFor="display_order">Display Order</Label>
          <Input
            id="display_order"
            name="display_order"
            type="number"
            defaultValue={editingCategory?.display_order || 0}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="is_active"
            name="is_active"
            defaultChecked={editingCategory?.is_active ?? true}
          />
          <Label htmlFor="is_active">Active</Label>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleBack}>
            Cancel
          </Button>
          <Button type="submit">
            {editingCategory?.id ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </div>
  );

  const renderArticleForm = () => {
    const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const url = await handleFileUpload(file, 'video');
        if (url) {
          const videoInput = document.getElementById('video_url') as HTMLInputElement;
          if (videoInput) videoInput.value = url;
        }
      }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const url = await handleFileUpload(file, 'image');
        if (url) {
          const imageInput = document.getElementById('image_url') as HTMLInputElement;
          if (imageInput) imageInput.value = url;
        }
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h3 className="text-lg font-semibold">
            {editingArticle?.id ? 'Edit Article' : 'Create Article'}
          </h3>
        </div>

        <form onSubmit={handleArticleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="category_id">Category</Label>
            <Select name="category_id" defaultValue={editingArticle?.category_id} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={editingArticle?.title}
              required
            />
          </div>
          <div>
            <Label htmlFor="content">Content (Instructions)</Label>
            <Textarea
              id="content"
              name="content"
              defaultValue={editingArticle?.content}
              rows={6}
              placeholder="Write detailed instructions here..."
              required
            />
          </div>
          <div>
            <Label>Video</Label>
            <div className="flex gap-2">
              <Input
                id="video_url"
                name="video_url"
                type="url"
                defaultValue={editingArticle?.video_url}
                placeholder="Video URL or upload below"
              />
              <div>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                  id="video-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('video-upload')?.click()}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload Video
                </Button>
              </div>
            </div>
          </div>
          <div>
            <Label>Image</Label>
            <div className="flex gap-2">
              <Input
                id="image_url"
                name="image_url"
                type="url"
                defaultValue={editingArticle?.image_url}
                placeholder="Image URL or upload below"
              />
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('image-upload')?.click()}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload Image
                </Button>
              </div>
            </div>
          </div>
          <div>
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              name="tags"
              defaultValue={editingArticle?.tags.join(', ')}
              placeholder="tag1, tag2, tag3"
            />
          </div>
          <div>
            <Label htmlFor="display_order">Display Order</Label>
            <Input
              id="display_order"
              name="display_order"
              type="number"
              defaultValue={editingArticle?.display_order || 0}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="is_published"
              name="is_published"
              defaultChecked={editingArticle?.is_published ?? true}
            />
            <Label htmlFor="is_published">Published</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleBack}>
              Cancel
            </Button>
            <Button type="submit">
              {editingArticle?.id ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Help & Documentation
            {currentEmployee?.role === 'admin' && !managementMode && !editingCategory && !editingArticle && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManageClick}
              >
                <Settings className="h-4 w-4 mr-1" />
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
          ) : editingCategory ? (
            renderCategoryForm()
          ) : editingArticle ? (
            renderArticleForm()
          ) : managementMode ? (
            renderManagement()
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