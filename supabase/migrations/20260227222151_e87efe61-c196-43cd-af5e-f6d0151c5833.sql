
-- Master competition categories table
CREATE TABLE public.master_competition_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nama_kategori text NOT NULL,
  kelompok_umur text NOT NULL,
  jenis_kelamin text NOT NULL DEFAULT 'putra',
  berat_min numeric NULL,
  berat_max numeric NULL,
  keterangan text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.master_competition_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view master categories"
  ON public.master_competition_categories FOR SELECT
  USING (true);

CREATE POLICY "Super admin and komite can insert master categories"
  ON public.master_competition_categories FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'komite'::app_role));

CREATE POLICY "Super admin and komite can update master categories"
  ON public.master_competition_categories FOR UPDATE
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'komite'::app_role));

CREATE POLICY "Super admin and komite can delete master categories"
  ON public.master_competition_categories FOR DELETE
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'komite'::app_role));

CREATE TRIGGER update_master_competition_categories_updated_at
  BEFORE UPDATE ON public.master_competition_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
