import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const profileQuery = queryOptions({ queryKey: ["profile-settings"], queryFn: async () => {
  const { data: u } = await supabase.auth.getUser();
  const [p, clubs] = await Promise.all([
    supabase.from("profile_settings").select("*").maybeSingle(),
    supabase.from("clubs").select("id,name,full_name,short_name,team_code,logo_path,region_lsc,country_code,owner_id").order("created_at"),
  ]);
  if (p.error) throw p.error; if (clubs.error) throw clubs.error;
  const rawClub = clubs.data?.[0] ?? null;
  const club = rawClub ? {
    ...rawClub,
    code: (rawClub.team_code || rawClub.short_name || "JSWIM").toUpperCase().trim(),
  } : null;
  let logoUrl: string | null = null;
  if (club?.logo_path) { const s = await supabase.storage.from("club-documents").createSignedUrl(club.logo_path, 3600); logoUrl = s.data?.signedUrl ?? null; }
  return { userId: u.user?.id ?? null, settings: p.data, club, logoUrl };
} });

