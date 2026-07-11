
CREATE POLICY "Users read own ai attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ai-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own ai attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ai-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own ai attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ai-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
