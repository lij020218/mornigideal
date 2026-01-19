-- Create chat_history table for storing user chat messages
CREATE TABLE IF NOT EXISTS public.chat_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint for user_id and date combination (for upsert)
    CONSTRAINT chat_history_user_date_unique UNIQUE (user_id, date)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON public.chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_date ON public.chat_history(date);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_date ON public.chat_history(user_id, date);

-- Enable RLS
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own chat history" ON public.chat_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat history" ON public.chat_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat history" ON public.chat_history
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat history" ON public.chat_history
    FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions (for service role access without RLS)
GRANT ALL ON public.chat_history TO service_role;
GRANT ALL ON public.chat_history TO authenticated;

-- Add comment
COMMENT ON TABLE public.chat_history IS 'Stores user chat history by date';
