import { supabase } from '@/integrations/supabase/client';

export interface HelpCategory {
  id: string;
  name: string;
  description: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HelpArticle {
  id: string;
  category_id: string;
  title: string;
  content: string;
  video_url?: string;
  image_url?: string;
  tags: string[];
  display_order: number;
  is_published: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface HelpArticleWithCategory extends HelpArticle {
  category: HelpCategory;
}

export const helpService = {
  // Categories
  async getCategories(): Promise<HelpCategory[]> {
    const { data, error } = await supabase
      .from('help_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createCategory(category: Omit<HelpCategory, 'id' | 'created_at' | 'updated_at'>): Promise<HelpCategory> {
    const { data, error } = await supabase
      .from('help_categories')
      .insert(category)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCategory(id: string, updates: Partial<HelpCategory>): Promise<HelpCategory> {
    const { data, error } = await supabase
      .from('help_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('help_categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Articles
  async getArticles(): Promise<HelpArticleWithCategory[]> {
    const { data, error } = await supabase
      .from('help_articles')
      .select(`
        *,
        category:help_categories(*)
      `)
      .eq('is_published', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getArticlesByCategory(categoryId: string): Promise<HelpArticle[]> {
    const { data, error } = await supabase
      .from('help_articles')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_published', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async searchArticles(query: string): Promise<HelpArticleWithCategory[]> {
    const { data, error } = await supabase
      .from('help_articles')
      .select(`
        *,
        category:help_categories(*)
      `)
      .eq('is_published', true)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%,tags.cs.{${query}}`)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getArticle(id: string): Promise<HelpArticleWithCategory> {
    const { data, error } = await supabase
      .from('help_articles')
      .select(`
        *,
        category:help_categories(*)
      `)
      .eq('id', id)
      .eq('is_published', true)
      .single();

    if (error) throw error;
    return data;
  },

  async createArticle(article: Omit<HelpArticle, 'id' | 'created_at' | 'updated_at'>): Promise<HelpArticle> {
    const { data, error } = await supabase
      .from('help_articles')
      .insert(article)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateArticle(id: string, updates: Partial<HelpArticle>): Promise<HelpArticle> {
    const { data, error } = await supabase
      .from('help_articles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteArticle(id: string): Promise<void> {
    const { error } = await supabase
      .from('help_articles')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // File upload for help media
  async uploadHelpMedia(file: File, folder: string = 'images'): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Math.random()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('help-media')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('help-media')
      .getPublicUrl(fileName);

    return data.publicUrl;
  },

  async deleteHelpMedia(url: string): Promise<void> {
    const fileName = url.split('/').pop();
    if (!fileName) return;

    const { error } = await supabase.storage
      .from('help-media')
      .remove([fileName]);

    if (error) throw error;
  }
};