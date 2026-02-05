-- Add session_id and title to ai_chats for grouping messages into conversations
ALTER TABLE public.ai_chats 
ADD COLUMN IF NOT EXISTS session_id UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS title TEXT;

-- Create an index for faster lookups by user and session
CREATE INDEX IF NOT EXISTS idx_ai_chats_user_session ON public.ai_chats(user_id, session_id);

-- Update RLS policies to ensure user_id matches
-- (Assuming they weren't fully set up or need verification)
ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ai_chats' AND policyname = 'Users can view their own AI chats'
    ) THEN
        CREATE POLICY "Users can view their own AI chats" 
        ON public.ai_chats FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ai_chats' AND policyname = 'Users can insert their own AI chats'
    ) THEN
        CREATE POLICY "Users can insert their own AI chats" 
        ON public.ai_chats FOR INSERT 
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
