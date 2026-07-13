ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS folders_parent_idx ON public.folders(parent_id);