DROP POLICY IF EXISTS "private club files" ON storage.objects;
CREATE POLICY "private club files" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'club-documents' AND public.has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.owner_id = auth.uid() AND c.id::text = split_part(storage.objects.name,'/',1)))
WITH CHECK (bucket_id = 'club-documents' AND public.has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.owner_id = auth.uid() AND c.id::text = split_part(storage.objects.name,'/',1)));