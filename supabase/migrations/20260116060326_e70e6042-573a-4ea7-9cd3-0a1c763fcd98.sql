-- Create storage bucket for chat files
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', true);

-- Allow authenticated users to upload chat files
CREATE POLICY "Authenticated users can upload chat files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'chat-files' 
  AND auth.uid() IS NOT NULL
);

-- Allow authenticated users to view chat files
CREATE POLICY "Authenticated users can view chat files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-files' AND auth.uid() IS NOT NULL);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own chat files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'chat-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add file columns to chat_messages
ALTER TABLE public.chat_messages
ADD COLUMN file_url TEXT,
ADD COLUMN file_type TEXT, -- 'image', 'audio', 'file'
ADD COLUMN file_name TEXT;