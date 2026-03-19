import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Globe, Video, Image, Upload, X, FileVideo, FileImage } from 'lucide-react';
import { helpService, HelpCategory, HelpArticle, HelpArticleWithCategory } from '@/services/helpService';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const DevHelpManagement: React.FC = () => {
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [articles, setArticles] = useState<HelpArticleWithCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [articleDialogOpen, setArticleDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<HelpCategory | null>(null);
  const [editingArticle, setEditingArticle] = useState<HelpArticleWithCategory | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [videoPath, setVideoPath] = useState('');
  const [imagePath, setImagePath] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (editingArticle) {
      setVideoPath(editingArticle.video_url || '');
      setImagePath(editingArticle.image_url || '');
    } else {
      setVideoPath('');
      setImagePath('');
    }
  }, [editingArticle]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [categoriesData, articlesData] = await Promise.all([
        helpService.getGlobalCategories(),
        helpService.getGlobalArticles()
      ]);
      setCategories(categoriesData);
      setArticles(articlesData);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load global help data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, type: 'image' | 'video') => {
    const setUploading = type === 'video' ? setUploadingVideo : setUploadingImage;
    const setPath = type === 'video' ? setVideoPath : setImagePath;
    try {
      setUploading(true);
      const path = await helpService.uploadHelpMedia(file, type + 's');
      setPath(path);
      toast({ title: "Success", description: `${type === 'video' ? 'Video' : 'Image'} uploaded successfully` });
    } catch (error) {
      toast({ title: "Error", description: `Failed to upload ${type}`, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleCategorySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const categoryData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      display_order: parseInt(formData.get('display_order') as string) || 0,
      is_active: formData.get('is_active') === 'on',
      is_global: true
    };

    try {
      if (editingCategory?.id) {
        await helpService.updateCategory(editingCategory.id, categoryData);
        toast({ title: "Success", description: "Global category updated" });
      } else {
        await helpService.createCategory(categoryData);
        toast({ title: "Success", description: "Global category created" });
      }
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      loadData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save category", variant: "destructive" });
    }
  };

  const handleArticleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const tags = (formData.get('tags') as string || '').split(',').map(t => t.trim()).filter(Boolean);
    const articleData = {
      category_id: formData.get('category_id') as string,
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      video_url: videoPath || undefined,
      image_url: imagePath || undefined,
      tags,
      display_order: parseInt(formData.get('display_order') as string) || 0,
      is_published: formData.get('is_published') === 'on',
      is_global: true
    };

    try {
      if (editingArticle?.id) {
        await helpService.updateArticle(editingArticle.id, articleData);
        toast({ title: "Success", description: "Global article updated" });
      } else {
        await helpService.createArticle(articleData);
        toast({ title: "Success", description: "Global article created" });
      }
      setArticleDialogOpen(false);
      setEditingArticle(null);
      loadData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save article", variant: "destructive" });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await helpService.deleteCategory(id);
      toast({ title: "Success", description: "Category deleted" });
      loadData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete category", variant: "destructive" });
    }
  };

  const handleDeleteArticle = async (id: string) => {
    try {
      await helpService.deleteArticle(id);
      toast({ title: "Success", description: "Article deleted" });
      loadData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete article", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-400" />
            Global Help Management
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            These categories and articles are shared across all tenants. Each tenant can also add their own in Settings.
          </p>
        </div>
      </div>

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList className="bg-white/10 border border-white/10">
          <TabsTrigger value="categories" className="data-[state=active]:bg-white/20 text-white">Categories</TabsTrigger>
          <TabsTrigger value="articles" className="data-[state=active]:bg-white/20 text-white">Articles</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-slate-300">Global Categories</h3>
            <Button size="sm" onClick={() => { setEditingCategory(null); setCategoryDialogOpen(true); }}
              className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-1" /> Add Category
            </Button>
          </div>
          <div className="grid gap-3">
            {categories.map((cat) => (
              <Card key={cat.id} className="bg-white/5 border-white/10">
                <CardHeader className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white text-sm flex items-center gap-2">
                        {cat.name}
                        <Badge className="text-[10px] bg-blue-600/40">Global</Badge>
                        {!cat.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                      </CardTitle>
                      <CardDescription className="text-slate-400 text-xs mt-1">{cat.description}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white h-7 w-7 p-0"
                        onClick={() => { setEditingCategory(cat); setCategoryDialogOpen(true); }}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-400 h-7 w-7 p-0">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Global Category</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will delete the category and all its articles for ALL tenants.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteCategory(cat.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
            {!categories.length && <p className="text-slate-400 text-sm">No global categories yet</p>}
          </div>
        </TabsContent>

        <TabsContent value="articles" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-slate-300">Global Articles</h3>
            <Button size="sm" onClick={() => { setEditingArticle(null); setArticleDialogOpen(true); }}
              className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-1" /> Add Article
            </Button>
          </div>
          <div className="grid gap-3">
            {articles.map((article) => (
              <Card key={article.id} className="bg-white/5 border-white/10">
                <CardHeader className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-white text-sm flex items-center gap-2">
                        {article.title}
                        <Badge className="text-[10px] bg-blue-600/40">Global</Badge>
                        {!article.is_published && <Badge variant="secondary" className="text-[10px]">Draft</Badge>}
                        {article.video_url && <Video className="h-3 w-3 text-slate-400" />}
                        {article.image_url && <Image className="h-3 w-3 text-slate-400" />}
                      </CardTitle>
                      <CardDescription className="text-slate-400 text-xs mt-1">
                        Category: {article.category?.name || 'Unknown'}
                      </CardDescription>
                      {article.tags?.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {article.tags.map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] border-white/20 text-slate-300">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white h-7 w-7 p-0"
                        onClick={() => { setEditingArticle(article); setArticleDialogOpen(true); }}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-400 h-7 w-7 p-0">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Global Article</AlertDialogTitle>
                            <AlertDialogDescription>This will remove this article for ALL tenants.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteArticle(article.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
            {!articles.length && <p className="text-slate-400 text-sm">No global articles yet</p>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Global Category' : 'Create Global Category'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCategorySubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={editingCategory?.name} required />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" defaultValue={editingCategory?.description ?? ''} />
            </div>
            <div>
              <Label htmlFor="display_order">Display Order</Label>
              <Input id="display_order" name="display_order" type="number" defaultValue={editingCategory?.display_order || 0} required />
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="is_active" name="is_active" defaultChecked={editingCategory?.is_active ?? true} />
              <Label htmlFor="is_active">Active</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editingCategory ? 'Update' : 'Create'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Article Dialog */}
      <Dialog open={articleDialogOpen} onOpenChange={setArticleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingArticle ? 'Edit Global Article' : 'Create Global Article'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleArticleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="category_id">Category</Label>
              <Select name="category_id" defaultValue={editingArticle?.category_id} required>
                <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={editingArticle?.title} required />
            </div>
            <div>
              <Label htmlFor="content">Content</Label>
              <Textarea id="content" name="content" defaultValue={editingArticle?.content} rows={6} required />
            </div>
            
            {/* Video Upload */}
            <div>
              <Label className="flex items-center gap-2">
                <FileVideo className="h-4 w-4" />
                Video
              </Label>
              <div className="mt-2 space-y-2">
                {videoPath ? (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <Video className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm truncate flex-1">{videoPath}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0"
                      onClick={() => setVideoPath('')}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      id="dev-video-upload"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) await handleFileUpload(file, 'video');
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadingVideo}
                      onClick={() => document.getElementById('dev-video-upload')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingVideo ? 'Uploading...' : 'Upload Video'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <Label className="flex items-center gap-2">
                <FileImage className="h-4 w-4" />
                Image
              </Label>
              <div className="mt-2 space-y-2">
                {imagePath ? (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <Image className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm truncate flex-1">{imagePath}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0"
                      onClick={() => setImagePath('')}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="dev-image-upload"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) await handleFileUpload(file, 'image');
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadingImage}
                      onClick={() => document.getElementById('dev-image-upload')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingImage ? 'Uploading...' : 'Upload Image'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" name="tags" defaultValue={editingArticle?.tags?.join(', ')} />
            </div>
            <div>
              <Label htmlFor="display_order">Display Order</Label>
              <Input id="display_order" name="display_order" type="number" defaultValue={editingArticle?.display_order || 0} required />
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="is_published" name="is_published" defaultChecked={editingArticle?.is_published ?? true} />
              <Label htmlFor="is_published">Published</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setArticleDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editingArticle ? 'Update' : 'Create'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DevHelpManagement;
