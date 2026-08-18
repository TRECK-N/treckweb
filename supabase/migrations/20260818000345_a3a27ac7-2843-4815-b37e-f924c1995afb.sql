-- 1. Multi-answer quiz support
ALTER TABLE public.study_questions ADD COLUMN IF NOT EXISTS correct_indexes integer[];

-- 2. Chess lobby auto-cleanup
ALTER TABLE public.chess_lobbies ADD COLUMN IF NOT EXISTS empty_since timestamp with time zone;

CREATE OR REPLACE FUNCTION public.chess_touch_lobby_emptiness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lobby uuid;
  _count integer;
BEGIN
  _lobby := COALESCE(NEW.lobby_id, OLD.lobby_id);
  SELECT count(*) INTO _count FROM public.chess_lobby_members WHERE lobby_id = _lobby;
  IF _count = 0 THEN
    UPDATE public.chess_lobbies SET empty_since = now() WHERE id = _lobby AND empty_since IS NULL;
  ELSE
    UPDATE public.chess_lobbies SET empty_since = NULL WHERE id = _lobby AND empty_since IS NOT NULL;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS chess_members_emptiness ON public.chess_lobby_members;
CREATE TRIGGER chess_members_emptiness
AFTER INSERT OR DELETE ON public.chess_lobby_members
FOR EACH ROW EXECUTE FUNCTION public.chess_touch_lobby_emptiness();

CREATE OR REPLACE FUNCTION public.chess_cleanup_lobbies()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted integer;
BEGIN
  WITH gone AS (
    DELETE FROM public.chess_lobbies l
    WHERE l.empty_since IS NOT NULL
      AND l.empty_since < now() - interval '1 minute'
      AND NOT EXISTS (SELECT 1 FROM public.chess_lobby_members m WHERE m.lobby_id = l.id)
    RETURNING 1
  )
  SELECT count(*) INTO _deleted FROM gone;
  RETURN _deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.chess_cleanup_lobbies() TO authenticated;

-- mark already-empty lobbies so the cleanup can pick them up
UPDATE public.chess_lobbies l
SET empty_since = now()
WHERE empty_since IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.chess_lobby_members m WHERE m.lobby_id = l.id);