-- 1. Remove Groups entirely
DROP TABLE IF EXISTS public.group_messages CASCADE;
DROP TABLE IF EXISTS public.group_invitations CASCADE;
DROP TABLE IF EXISTS public.group_join_requests CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP FUNCTION IF EXISTS public.is_group_admin(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_group_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.add_group_owner_as_member() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_group_member_limit() CASCADE;

-- 2. Study content can live inside a workspace folder
ALTER TABLE public.study_decks ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL;
ALTER TABLE public.study_quizzes ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS study_decks_folder_idx ON public.study_decks(folder_id);
CREATE INDEX IF NOT EXISTS study_quizzes_folder_idx ON public.study_quizzes(folder_id);

-- 3. Team chess: any player in the lobby may update the running game
DROP POLICY IF EXISTS "Players can update their game" ON public.chess_games;
CREATE POLICY "Lobby players can update the game"
ON public.chess_games FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chess_lobby_members m
    WHERE m.lobby_id = chess_games.lobby_id
      AND m.user_id = auth.uid()
      AND m.role = 'player'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chess_lobby_members m
    WHERE m.lobby_id = chess_games.lobby_id
      AND m.user_id = auth.uid()
      AND m.role = 'player'
  )
);

-- host may reassign teams / roles of members in their lobby
DROP POLICY IF EXISTS "Host can update lobby members" ON public.chess_lobby_members;
CREATE POLICY "Host can update lobby members"
ON public.chess_lobby_members FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.chess_lobbies l WHERE l.id = chess_lobby_members.lobby_id AND l.host_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.chess_lobbies l WHERE l.id = chess_lobby_members.lobby_id AND l.host_id = auth.uid()));

-- 4. Remove the temporary sign-up test account
DELETE FROM auth.users WHERE email LIKE 'testflow%@example.com';