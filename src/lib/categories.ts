import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel, SWIM_CATEGORIES, type SwimCategory } from "@/lib/standard-rules";

/** The account's own categories; falls back to the default list when none were customized. */
export const categoriesQuery = queryOptions({
  queryKey: ["swim-categories"],
  queryFn: async (): Promise<{ custom: boolean; list: SwimCategory[] }> => {
    const { data, error } = await supabase.from("swim_categories").select("name, age_min, age_max, sort").order("sort");
    if (error) throw error;
    if (!data?.length) return { custom: false, list: [...SWIM_CATEGORIES] };
    return { custom: true, list: data.map((c) => ({ name: c.name, age_min: c.age_min, age_max: c.age_max, label: categoryLabel(c.name, c.age_min, c.age_max) })) };
  },
});

export function useSwimCategories(): SwimCategory[] {
  return useQuery(categoriesQuery).data?.list ?? [...SWIM_CATEGORIES];
}
