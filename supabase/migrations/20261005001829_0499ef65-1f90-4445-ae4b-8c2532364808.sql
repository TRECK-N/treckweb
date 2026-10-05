DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin','moderator','user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,60}$'),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 400),
  category text NOT NULL CHECK (category IN ('Action','Racing','Multiplayer','Puzzle','Sports','Strategy','Casual')),
  thumbnail_url text CHECK (thumbnail_url IS NULL OR thumbnail_url ~ '^https://'),
  official_url text CHECK (official_url IS NULL OR official_url ~ '^https://'),
  embed_url text NOT NULL CHECK (embed_url ~ '^https://(html5\.gamedistribution\.com|html5\.gamemonetize\.co)/'),
  aspect_ratio numeric NOT NULL DEFAULT 1.6,
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.games TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View enabled games" ON public.games FOR SELECT TO authenticated USING (enabled OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert games" ON public.games FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update games" ON public.games FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete games" ON public.games FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.games_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER games_touch BEFORE UPDATE ON public.games FOR EACH ROW EXECUTE FUNCTION public.games_touch();

CREATE TABLE public.game_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id)
);
GRANT SELECT, INSERT, DELETE ON public.game_favorites TO authenticated;
GRANT ALL ON public.game_favorites TO service_role;
ALTER TABLE public.game_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own favorites" ON public.game_favorites FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.game_plays (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  played_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_plays TO authenticated;
GRANT ALL ON public.game_plays TO service_role;
ALTER TABLE public.game_plays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own plays" ON public.game_plays FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

INSERT INTO public.games (slug, title, description, category, thumbnail_url, official_url, embed_url, sort_order)
VALUES ('gd-test-game', 'GameDistribution Test Game', 'Official GameDistribution embed used to test external games inside WebuWeb.', 'Casual',
  'https://img.gamedistribution.com/81d4e83974514ecb98d9e9551e63b929-512x384.jpeg',
  'https://html5.gamedistribution.com/81d4e83974514ecb98d9e9551e63b929/',
  'https://html5.gamedistribution.com/81d4e83974514ecb98d9e9551e63b929/', 0);