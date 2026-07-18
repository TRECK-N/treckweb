
-- Chess lobbies
CREATE TABLE public.chess_lobbies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT true,
  code TEXT UNIQUE,
  max_players INT NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting | playing | finished | closed
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  spectators_allowed BOOLEAN NOT NULL DEFAULT true,
  chat_enabled BOOLEAN NOT NULL DEFAULT true,
  time_control_seconds INT, -- null = unlimited
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chess_lobbies TO authenticated;
GRANT ALL ON public.chess_lobbies TO service_role;
ALTER TABLE public.chess_lobbies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view lobbies"
  ON public.chess_lobbies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create lobbies as host"
  ON public.chess_lobbies FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Host can update own lobby"
  ON public.chess_lobbies FOR UPDATE TO authenticated USING (auth.uid() = host_id);
CREATE POLICY "Host can delete own lobby"
  ON public.chess_lobbies FOR DELETE TO authenticated USING (auth.uid() = host_id);

-- Members
CREATE TABLE public.chess_lobby_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lobby_id UUID NOT NULL REFERENCES public.chess_lobbies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'player', -- player | spectator
  team TEXT, -- white | black | null (auto)
  is_ready BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lobby_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chess_lobby_members TO authenticated;
GRANT ALL ON public.chess_lobby_members TO service_role;
ALTER TABLE public.chess_lobby_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members are viewable by authenticated"
  ON public.chess_lobby_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join lobbies as themselves"
  ON public.chess_lobby_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own membership"
  ON public.chess_lobby_members FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users or host can remove membership"
  ON public.chess_lobby_members FOR DELETE TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.chess_lobbies l WHERE l.id = lobby_id AND l.host_id = auth.uid())
  );

-- Games
CREATE TABLE public.chess_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lobby_id UUID NOT NULL REFERENCES public.chess_lobbies(id) ON DELETE CASCADE,
  white_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  black_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn TEXT NOT NULL DEFAULT '',
  turn TEXT NOT NULL DEFAULT 'w',
  status TEXT NOT NULL DEFAULT 'active', -- active | checkmate | draw | resigned | aborted
  result TEXT, -- 1-0 | 0-1 | 1/2-1/2
  draw_offered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chess_games TO authenticated;
GRANT ALL ON public.chess_games TO service_role;
ALTER TABLE public.chess_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Games viewable by authenticated"
  ON public.chess_games FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lobby host can insert game"
  ON public.chess_games FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.chess_lobbies l WHERE l.id = lobby_id AND l.host_id = auth.uid())
  );
CREATE POLICY "Players can update their game"
  ON public.chess_games FOR UPDATE TO authenticated USING (
    auth.uid() = white_id OR auth.uid() = black_id
  );

-- Lobby chat
CREATE TABLE public.chess_lobby_chat (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lobby_id UUID NOT NULL REFERENCES public.chess_lobbies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.chess_lobby_chat TO authenticated;
GRANT ALL ON public.chess_lobby_chat TO service_role;
ALTER TABLE public.chess_lobby_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat viewable by authenticated"
  ON public.chess_lobby_chat FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can post as themselves"
  ON public.chess_lobby_chat FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- updated_at triggers
CREATE TRIGGER chess_lobbies_updated_at BEFORE UPDATE ON public.chess_lobbies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER chess_games_updated_at BEFORE UPDATE ON public.chess_games
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto add host as player member
CREATE OR REPLACE FUNCTION public.chess_add_host_as_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.chess_lobby_members (lobby_id, user_id, role, team)
  VALUES (NEW.id, NEW.host_id, 'player', 'white');
  RETURN NEW;
END; $$;
CREATE TRIGGER chess_lobby_host_member AFTER INSERT ON public.chess_lobbies
  FOR EACH ROW EXECUTE FUNCTION public.chess_add_host_as_member();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chess_lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chess_lobby_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chess_games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chess_lobby_chat;

ALTER TABLE public.chess_lobbies REPLICA IDENTITY FULL;
ALTER TABLE public.chess_lobby_members REPLICA IDENTITY FULL;
ALTER TABLE public.chess_games REPLICA IDENTITY FULL;
ALTER TABLE public.chess_lobby_chat REPLICA IDENTITY FULL;
