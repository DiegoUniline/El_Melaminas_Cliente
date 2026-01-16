-- Create internal chat messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL means broadcast to all
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages sent to them, by them, or broadcast messages
CREATE POLICY "Users can view their messages"
ON public.chat_messages
FOR SELECT
USING (
  sender_id = auth.uid() 
  OR recipient_id = auth.uid() 
  OR recipient_id IS NULL
);

-- Users can send messages
CREATE POLICY "Users can send messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (sender_id = auth.uid());

-- Users can update their own messages (mark as read)
CREATE POLICY "Users can update message read status"
ON public.chat_messages
FOR UPDATE
USING (recipient_id = auth.uid() OR (recipient_id IS NULL AND sender_id != auth.uid()));

-- Admins can delete messages
CREATE POLICY "Admins can delete messages"
ON public.chat_messages
FOR DELETE
USING (is_admin(auth.uid()));

-- Index for faster queries
CREATE INDEX idx_chat_messages_sender ON public.chat_messages(sender_id);
CREATE INDEX idx_chat_messages_recipient ON public.chat_messages(recipient_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at DESC);

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Update profiles RLS to allow viewing all profiles for chat user selection
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);