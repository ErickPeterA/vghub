import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin as generatedSupabaseAdmin } from "../integrations/supabase/client.server";

/** Server-only compatibility alias while the transferred schema is restored. */
export const supabaseAdmin = generatedSupabaseAdmin as unknown as SupabaseClient<any, "public", any>;