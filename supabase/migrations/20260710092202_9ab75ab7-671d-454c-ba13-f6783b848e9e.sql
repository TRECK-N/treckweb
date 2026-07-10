
-- Lock down SECURITY DEFINER helpers (called only by triggers)
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Storage RLS for workspace bucket (per-user folders: workspace/<uid>/...)
CREATE POLICY "Users read own workspace files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'workspace' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload own workspace files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'workspace' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own workspace files" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'workspace' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own workspace files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'workspace' AND (storage.foldername(name))[1] = auth.uid()::text);
