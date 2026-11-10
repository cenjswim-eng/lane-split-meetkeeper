import { supabase } from "@/integrations/supabase/client";
import { activeStandardVersion, versionStandards, type StandardVersion } from "./standard-versions";

export async function loadStandardVersions() {
  const versions: StandardVersion[] = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await supabase.from("standard_versions").select("*").order("imported_at", { ascending: false, nullsFirst: false }).order("id").range(offset, offset + 999);
    if (response.error) throw response.error;
    versions.push(...response.data);
    if (response.data.length < 1000) break;
  }
  const activeVersion = activeStandardVersion(versions);
  return { versions, activeVersion, data: versionStandards(activeVersion), error: null };
}