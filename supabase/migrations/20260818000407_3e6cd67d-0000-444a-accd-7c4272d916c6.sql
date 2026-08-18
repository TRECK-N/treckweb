REVOKE ALL ON FUNCTION public.chess_cleanup_lobbies() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chess_cleanup_lobbies() TO authenticated;
REVOKE ALL ON FUNCTION public.chess_touch_lobby_emptiness() FROM PUBLIC, anon, authenticated;