import React, { useState, useEffect, useMemo } from 'react';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import DOMPurify from 'dompurify';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, ArrowLeft, Play, Tag, Plus, Edit, Trash2, Upload, Video, Image, Settings, ChevronRight, BookOpen, X, FileVideo, FileImage, FolderOpen, HelpCircle } from 'lucide-react';
import { helpService, HelpCategory, HelpArticleWithCategory } from '@/services/helpService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Sub-component for rendering article media with signed URLs
const ArticleMedia: React.FC<{ article: HelpArticleWithCategory }> = ({ article }) => {
  const signedVideoUrl = useSignedUrl('help-media', article.video_url);
  const signedImageUrl = useSignedUrl('help-media', article.image_url);

  return (
    <>
      {signedVideoUrl && (
        <div className="aspect-video bg-muted rounded-xl overflow-hidden border border-border">
          <video
            controls
            className="w-full h-full"
            poster={signedImageUrl || undefined}
          >
            <source src={signedVideoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      )}

      {signedImageUrl && !article.video_url && (
        <div className="rounded-xl overflow-hidden border border-border">
          <img
            src={signedImageUrl}
            alt={article.title}
            className="w-full object-cover max-h-72"
          />
        </div>
      )}
    </>
  );
};

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
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [videoPath, setVideoPath] = useState('');
  const [imagePath, setImagePath] = useState('');
  const { toast } = useToast();
  const { currentEmployee } = useAuth();
  const isMobile = useIsMobile();

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

  useEffect(() => {
    if (editingArticle) {
      setVideoPath(editingArticle.video_url || '');
      setImagePath(editingArticle.image_url || '');
    } else {
      setVideoPath('');
      setImagePath('');
    }
  }, [editingArticle]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const categoriesData = await helpService.getCategories();
      setCategories(categoriesData);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load help categories", variant: "destructive" });
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
      toast({ title: "Error", description: "Failed to load help articles", variant: "destructive" });
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
      toast({ title: "Error", description: "Failed to search help articles", variant: "destructive" });
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

  const handleFileUpload = async (file: File, type: 'image' | 'video') => {
    const setUploading = type === 'video' ? setUploadingVideo : setUploadingImage;
    const setPath = type === 'video' ? setVideoPath : setImagePath;
    try {
      setUploading(true);
      const path = await helpService.uploadHelpMedia(file, type + 's');
      setPath(path);
      toast({ title: "Success", description: `${type === 'video' ? 'Video' : 'Image'} uploaded` });
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
      is_global: false
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
      toast({ title: "Error", description: "Failed to save category", variant: "destructive" });
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
      video_url: videoPath || undefined,
      image_url: imagePath || undefined,
      tags,
      display_order: parseInt(formData.get('display_order') as string) || 0,
      is_published: formData.get('is_published') === 'on',
      is_global: false
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
      toast({ title: "Error", description: "Failed to save article", variant: "destructive" });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await helpService.deleteCategory(id);
      toast({ title: "Success", description: "Category deleted successfully" });
      loadCategories();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete category", variant: "destructive" });
    }
  };

  const handleDeleteArticle = async (id: string) => {
    try {
      await helpService.deleteArticle(id);
      toast({ title: "Success", description: "Article deleted successfully" });
      loadArticles();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete article", variant: "destructive" });
    }
  };

  const isInBrowseMode = !editingCategory && !editingArticle && !managementMode && !selectedArticle;

  const renderSearchBar = () => (
    <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <HelpCircle className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">How can we help you?</h3>
      </div>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search articles, topics, guides..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!e.target.value.trim()) {
              setArticles([]);
              setSelectedCategory(null);
            }
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="pl-10 h-11 bg-background/80 backdrop-blur-sm border-border/60 rounded-xl text-sm shadow-sm focus-visible:ring-primary/30"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
            onClick={() => {
              setSearchQuery('');
              setArticles([]);
              setSelectedCategory(null);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );

  // ─── USER-FACING VIEWS ───

  const renderCategories = () => (
    <div className="space-y-5">
      {/* Categories Grid */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-1">Browse by topic</p>
        <div className="grid gap-2">
          {categories.map((category, index) => (
            <button
              key={category.id}
              className="group flex items-center gap-3.5 p-3.5 bg-card hover:bg-accent/50 border border-border/60 rounded-xl transition-all duration-150 text-left w-full"
              onClick={() => handleCategorySelect(category)}
            >
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary shrink-0 group-hover:bg-primary/15 transition-colors">
                <FolderOpen className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground">{category.name}</p>
                {category.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{category.description}</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {categories.length === 0 && !loading && (
        <div className="text-center py-8">
          <HelpCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No help topics available yet.</p>
        </div>
      )}
    </div>
  );

  const renderArticlesList = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 w-8 p-0 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h3 className="font-semibold text-base truncate">
            {selectedCategory ? selectedCategory.name : 'Search Results'}
          </h3>
          {selectedCategory?.description && (
            <p className="text-xs text-muted-foreground truncate">{selectedCategory.description}</p>
          )}
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        {articles.map((article) => (
          <button
            key={article.id}
            className="group flex items-center gap-3 p-3.5 bg-card hover:bg-accent/50 border border-border/60 rounded-xl transition-all duration-150 text-left w-full"
            onClick={() => setSelectedArticle(article)}
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">{article.title}</p>
              <div className="flex items-center gap-2 mt-1.5">
                {!selectedCategory && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                    {article.category.name}
                  </Badge>
                )}
                {article.video_url && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
                    <Play className="h-2.5 w-2.5" />
                    Video
                  </Badge>
                )}
                {article.image_url && !article.video_url && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
                    <Image className="h-2.5 w-2.5" />
                    Image
                  </Badge>
                )}
              </div>
              {article.tags.length > 0 && (
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {article.tags.slice(0, 3).map((tag, index) => (
                    <span key={index} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                  {article.tags.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{article.tags.length - 3}</span>
                  )}
                </div>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
          </button>
        ))}
      </div>

      {articles.length === 0 && !loading && (
        <div className="text-center py-10">
          <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {searchQuery ? 'No articles found for your search.' : 'No articles in this category yet.'}
          </p>
        </div>
      )}
    </div>
  );

  const renderArticleDetail = () => {
    if (!selectedArticle) return null;

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 w-8 p-0 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="text-xs">
            {selectedArticle.category.name}
          </Badge>
        </div>

        <div className="space-y-5">
          <h2 className="text-xl font-bold text-foreground leading-tight">{selectedArticle.title}</h2>

          <ArticleMedia article={selectedArticle} />

          <div className="prose prose-sm max-w-none dark:prose-invert">
            <div
              className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  selectedArticle.content.replace(/\n/g, '<br>'),
                  { ALLOWED_TAGS: ['br', 'b', 'i', 'u', 'a', 'p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'strong', 'em', 'span', 'div', 'img'], ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class'] }
                )
              }}
            />
          </div>

          {selectedArticle.tags.length > 0 && (
            <div className="pt-2">
              <Separator className="mb-4" />
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                {selectedArticle.tags.map((tag, index) => (
                  <span key={index} className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── MANAGEMENT VIEWS ───

  const renderManagement = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 w-8 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold text-lg">Help Management</h3>
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
                id: '', name: '', description: '', display_order: 0,
                is_active: true, is_global: false, created_at: '', updated_at: ''
              })}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Category
            </Button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {categories.map((category) => (
              <div key={category.id} className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h5 className="font-medium">{category.name}</h5>
                    <p className="text-sm text-muted-foreground line-clamp-1">{category.description}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setEditingCategory(category)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(category.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="articles" className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Articles</h4>
            <Button
              size="sm"
              onClick={() => setEditingArticle({
                id: '', category_id: '', title: '', content: '',
                video_url: '', image_url: '', tags: [], display_order: 0,
                is_published: true, is_global: false, created_by: '',
                created_at: '', updated_at: '',
                category: categories[0] || { id: '', name: '', description: '', display_order: 0, is_active: true, is_global: false, created_at: '', updated_at: '' }
              })}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Article
            </Button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {articles.map((article) => (
              <div key={article.id} className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h5 className="font-medium">{article.title}</h5>
                    <p className="text-sm text-muted-foreground">{article.category.name}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setEditingArticle(article)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteArticle(article.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  const renderCategoryForm = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 w-8 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold text-lg">
          {editingCategory?.id ? 'Edit Category' : 'Create Category'}
        </h3>
      </div>
      <form onSubmit={handleCategorySubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={editingCategory?.name} required />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" defaultValue={editingCategory?.description} />
        </div>
        <div>
          <Label htmlFor="display_order">Display Order</Label>
          <Input id="display_order" name="display_order" type="number" defaultValue={editingCategory?.display_order || 0} />
        </div>
        <div className="flex items-center space-x-2">
          <Switch id="is_active" name="is_active" defaultChecked={editingCategory?.is_active ?? true} />
          <Label htmlFor="is_active">Active</Label>
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={handleBack}>Cancel</Button>
          <Button type="submit">{editingCategory?.id ? 'Update' : 'Create'}</Button>
        </div>
      </form>
    </div>
  );

  const renderArticleForm = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 w-8 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold text-lg">
          {editingArticle?.id ? 'Edit Article' : 'Create Article'}
        </h3>
      </div>
      <form onSubmit={handleArticleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="category_id">Category</Label>
          <Select name="category_id" defaultValue={editingArticle?.category_id} required>
            <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" defaultValue={editingArticle?.title} required />
        </div>
        <div>
          <Label htmlFor="content">Content (Instructions)</Label>
          <Textarea id="content" name="content" defaultValue={editingArticle?.content} rows={6} placeholder="Write detailed instructions here..." required />
        </div>

        {/* Video Upload */}
        <div>
          <Label className="flex items-center gap-2"><FileVideo className="h-4 w-4" />Video</Label>
          <div className="mt-2">
            {videoPath ? (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <Video className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm truncate flex-1">{videoPath}</span>
                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setVideoPath('')}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <input type="file" accept="video/*" className="hidden" id="help-video-upload"
                  onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleFileUpload(f, 'video'); }} />
                <Button type="button" variant="outline" disabled={uploadingVideo}
                  onClick={() => document.getElementById('help-video-upload')?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingVideo ? 'Uploading...' : 'Upload Video'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Image Upload */}
        <div>
          <Label className="flex items-center gap-2"><FileImage className="h-4 w-4" />Image</Label>
          <div className="mt-2">
            {imagePath ? (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <Image className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm truncate flex-1">{imagePath}</span>
                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setImagePath('')}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <input type="file" accept="image/*" className="hidden" id="help-image-upload"
                  onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleFileUpload(f, 'image'); }} />
                <Button type="button" variant="outline" disabled={uploadingImage}
                  onClick={() => document.getElementById('help-image-upload')?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingImage ? 'Uploading...' : 'Upload Image'}
                </Button>
              </>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input id="tags" name="tags" defaultValue={editingArticle?.tags.join(', ')} placeholder="tag1, tag2, tag3" />
        </div>
        <div>
          <Label htmlFor="display_order">Display Order</Label>
          <Input id="display_order" name="display_order" type="number" defaultValue={editingArticle?.display_order || 0} />
        </div>
        <div className="flex items-center space-x-2">
          <Switch id="is_published" name="is_published" defaultChecked={editingArticle?.is_published ?? true} />
          <Label htmlFor="is_published">Published</Label>
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={handleBack}>Cancel</Button>
          <Button type="submit">{editingArticle?.id ? 'Update' : 'Create'}</Button>
        </div>
      </form>
    </div>
  );

  const dialogClass = isMobile
    ? 'max-w-[calc(100vw-1.5rem)] w-[calc(100vw-1.5rem)] p-4 max-h-[90vh] overflow-hidden flex flex-col'
    : 'max-w-2xl max-h-[80vh]';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span>Help & Documentation</span>
            {currentEmployee?.role === 'admin' && !managementMode && !editingCategory && !editingArticle && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManageClick}
                className="ml-auto"
              >
                <Settings className="h-3.5 w-3.5 mr-1" />
                Manage
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className={isMobile ? 'flex-1 min-h-0' : 'max-h-[60vh]'}>
          <div className="pr-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                <p className="text-xs text-muted-foreground mt-3">Loading...</p>
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
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
