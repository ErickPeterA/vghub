import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as generatedSupabase } from "../integrations/supabase/client";

/**
 * Compatibility client for a transferred project whose generated database
 * types currently reflect an empty backend. Runtime queries remain unchanged;
 * once the original schema is restored and types are regenerated, this alias
 * can be removed safely.
 */
export const supabase = generatedSupabase as unknown as SupabaseClient<any, "public", any>;