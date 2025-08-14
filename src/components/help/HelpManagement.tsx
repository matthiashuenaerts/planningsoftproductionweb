import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Upload, Video, Image } from 'lucide-react';
import { helpService, HelpCategory, HelpArticle, HelpArticleWithCategory } from '@/services/helpService';
import { useToast } from '@/hooks/use-toast';

export const HelpManagement: React.FC = () => {
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [articles, setArticles] = useState<HelpArticleWithCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [articleDialogOpen, setArticleDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<HelpCategory | null>(null);
  const [editingArticle, setEditingArticle] = useState<HelpArticleWithCategory | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [categoriesData, articlesData] = await Promise.all([
        helpService.getCategories(),
        helpService.getArticles()
      ]);
      setCategories(categoriesData);
      setArticles(articlesData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load help data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    const categoryData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      display_order: parseInt(formData.get('display_order') as string),
      is_active: formData.get('is_active') === 'on'
    };

    try {
      if (editingCategory) {
        await helpService.updateCategory(editingCategory.id, categoryData);
        toast({ title: "Success", description: "Category updated successfully" });
      } else {
        await helpService.createCategory(categoryData);
        toast({ title: "Success", description: "Category created successfully" });
      }
      
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      loadData();
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
      display_order: parseInt(formData.get('display_order') as string),
      is_published: formData.get('is_published') === 'on'
    };

    try {
      if (editingArticle) {
        await helpService.updateArticle(editingArticle.id, articleData);
        toast({ title: "Success", description: "Article updated successfully" });
      } else {
        await helpService.createArticle(articleData);
        toast({ title: "Success", description: "Article created successfully" });
      }
      
      setArticleDialogOpen(false);
      setEditingArticle(null);
      loadData();
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
      loadData();
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
      loadData();
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

  const CategoryDialog = () => (
    <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingCategory ? 'Edit Category' : 'Create Category'}
          </DialogTitle>
        </DialogHeader>
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
              required
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
            <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editingCategory ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  const ArticleDialog = () => (
    <Dialog open={articleDialogOpen} onOpenChange={setArticleDialogOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingArticle ? 'Edit Article' : 'Create Article'}
          </DialogTitle>
        </DialogHeader>
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
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              name="content"
              defaultValue={editingArticle?.content}
              rows={6}
              required
            />
          </div>
          <div>
            <Label htmlFor="video_url">Video URL</Label>
            <Input
              id="video_url"
              name="video_url"
              type="url"
              defaultValue={editingArticle?.video_url}
              placeholder="https://example.com/video.mp4"
            />
          </div>
          <div>
            <Label htmlFor="image_url">Image URL</Label>
            <Input
              id="image_url"
              name="image_url"
              type="url"
              defaultValue={editingArticle?.image_url}
              placeholder="https://example.com/image.jpg"
            />
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
              required
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
            <Button type="button" variant="outline" onClick={() => setArticleDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editingArticle ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Help Management</h2>
      </div>

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="articles">Articles</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Help Categories</h3>
            <Button
              onClick={() => {
                setEditingCategory(null);
                setCategoryDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </div>

          <div className="grid gap-4">
            {categories.map((category) => (
              <Card key={category.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {category.name}
                        {!category.is_active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{category.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingCategory(category);
                          setCategoryDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Category</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this category? This will also delete all articles in this category.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteCategory(category.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="articles" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Help Articles</h3>
            <Button
              onClick={() => {
                setEditingArticle(null);
                setArticleDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Article
            </Button>
          </div>

          <div className="grid gap-4">
            {articles.map((article) => (
              <Card key={article.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {article.title}
                        {!article.is_published && (
                          <Badge variant="secondary">Draft</Badge>
                        )}
                        {article.video_url && (
                          <Video className="h-4 w-4 text-muted-foreground" />
                        )}
                        {article.image_url && (
                          <Image className="h-4 w-4 text-muted-foreground" />
                        )}
                      </CardTitle>
                      <CardDescription>
                        Category: {article.category.name}
                      </CardDescription>
                      {article.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {article.tags.map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingArticle(article);
                          setArticleDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Article</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this article? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteArticle(article.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <CategoryDialog />
      <ArticleDialog />
    </div>
  );
};