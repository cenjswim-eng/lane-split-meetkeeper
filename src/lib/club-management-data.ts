import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const clubManagementQuery = queryOptions({ queryKey: ["club-management"], queryFn: async () => {
  const [clubs, links] = await Promise.all([
    supabase.from("clubs").select("*").order("name"),
    supabase.from("club_meets").select("*"),
  ]);
  if (clubs.error) throw clubs.error;
  if (links.error) throw links.error;
  return { clubs: clubs.data, links: links.data };
} });