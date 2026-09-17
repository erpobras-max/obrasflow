
CREATE POLICY "diario_fotos_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'diario-fotos' AND (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'engenharia') OR public.has_role(auth.uid(),'financeiro')
));
CREATE POLICY "diario_fotos_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'diario-fotos' AND (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'engenharia')
));
CREATE POLICY "diario_fotos_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'diario-fotos' AND (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
  OR public.has_role(auth.uid(),'engenharia')
));
