-- Enable real-time for project_messages table
ALTER TABLE public.project_messages REPLICA IDENTITY FULL;

-- Add the table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_messages;