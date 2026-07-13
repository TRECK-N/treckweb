
-- 1. Trigger to add owner as member (fix create-group bug)
DROP TRIGGER IF EXISTS trg_add_group_owner_as_member ON public.groups;
CREATE TRIGGER trg_add_group_owner_as_member
AFTER INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.add_group_owner_as_member();

-- 2. updated_at triggers
DROP TRIGGER IF EXISTS trg_groups_updated_at ON public.groups;
CREATE TRIGGER trg_groups_updated_at BEFORE UPDATE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Group visibility columns
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS join_policy TEXT NOT NULL DEFAULT 'open'; -- open | request | invite

-- 4. Attachments on chat message tables
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Make chat_messages.content nullable (voice/attachment-only)
ALTER TABLE public.chat_messages ALTER COLUMN content DROP NOT NULL;
ALTER TABLE public.direct_messages ALTER COLUMN content DROP NOT NULL;
ALTER TABLE public.group_messages ALTER COLUMN content DROP NOT NULL;

-- 5. Allow public groups to be discovered
DROP POLICY IF EXISTS "Groups visible to members or public" ON public.groups;
CREATE POLICY "Groups visible to members or public" ON public.groups
FOR SELECT USING (
  is_public = true OR public.is_group_member(id, auth.uid())
);

-- 6. Group invitations
CREATE TABLE IF NOT EXISTS public.group_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL,
  invited_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, invited_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_invitations TO authenticated;
GRANT ALL ON public.group_invitations TO service_role;
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invitees or admins can view invitations" ON public.group_invitations
FOR SELECT USING (invited_user_id = auth.uid() OR public.is_group_admin(group_id, auth.uid()));

CREATE POLICY "Admins can create invitations" ON public.group_invitations
FOR INSERT WITH CHECK (public.is_group_admin(group_id, auth.uid()) AND invited_by = auth.uid());

CREATE POLICY "Invitee updates own invitation" ON public.group_invitations
FOR UPDATE USING (invited_user_id = auth.uid());

CREATE POLICY "Admins can delete invitations" ON public.group_invitations
FOR DELETE USING (public.is_group_admin(group_id, auth.uid()));

-- 7. Group join requests
CREATE TABLE IF NOT EXISTS public.group_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | declined
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_join_requests TO authenticated;
GRANT ALL ON public.group_join_requests TO service_role;
ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User or admin can see join request" ON public.group_join_requests
FOR SELECT USING (user_id = auth.uid() OR public.is_group_admin(group_id, auth.uid()));

CREATE POLICY "User creates own join request" ON public.group_join_requests
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin updates request" ON public.group_join_requests
FOR UPDATE USING (public.is_group_admin(group_id, auth.uid()));

CREATE POLICY "User cancels own request" ON public.group_join_requests
FOR DELETE USING (user_id = auth.uid() OR public.is_group_admin(group_id, auth.uid()));

-- 8. Songs
CREATE TABLE IF NOT EXISTS public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  cover_url TEXT,
  audio_url TEXT NOT NULL,
  duration_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.songs TO authenticated, anon;
GRANT ALL ON public.songs TO service_role;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Songs readable by all" ON public.songs FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.song_likes (
  user_id UUID NOT NULL,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, song_id)
);
GRANT SELECT, INSERT, DELETE ON public.song_likes TO authenticated;
GRANT ALL ON public.song_likes TO service_role;
ALTER TABLE public.song_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User manages own likes" ON public.song_likes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.recently_played (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.recently_played TO authenticated;
GRANT ALL ON public.recently_played TO service_role;
ALTER TABLE public.recently_played ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User sees own history" ON public.recently_played FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 9. Seed the uploaded songs (idempotent)
INSERT INTO public.songs (title, artist, album, audio_url, cover_url) VALUES
('Cold Dice', 'TRECK Sound', 'TRECK Originals', '/__l5e/assets-v1/9d86dbc7-2436-47c4-abfb-4660a7859cbf/cold-dice.mp3', NULL),
('Midnight Motion', 'TRECK Sound', 'TRECK Originals', '/__l5e/assets-v1/7ce68676-a4b9-47d5-8d5e-51705248d0d9/midnight-motion.mp3', NULL)
ON CONFLICT DO NOTHING;

-- 10. Storage policies for chat-attachments (private, path prefix = uploader user id)
CREATE POLICY "Users upload their own chat files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users read chat attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Users delete their own chat files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 11. Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_invitations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_join_requests;
