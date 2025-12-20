-- Create table for PDF annotations
CREATE TABLE public.pdf_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  annotations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, file_name, page_number)
);

-- Enable Row Level Security
ALTER TABLE public.pdf_annotations ENABLE ROW LEVEL SECURITY;

-- Create policies for access (allow all authenticated users for now)
CREATE POLICY "Users can view all PDF annotations" 
ON public.pdf_annotations 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Users can create PDF annotations" 
ON public.pdf_annotations 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update PDF annotations" 
ON public.pdf_annotations 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Users can delete PDF annotations" 
ON public.pdf_annotations 
FOR DELETE 
TO authenticated
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_pdf_annotations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_pdf_annotations_updated_at
BEFORE UPDATE ON public.pdf_annotations
FOR EACH ROW
EXECUTE FUNCTION public.update_pdf_annotations_updated_at();